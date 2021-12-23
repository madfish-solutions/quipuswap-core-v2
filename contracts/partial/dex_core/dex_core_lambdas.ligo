const deploy_tez_store : deploy_tez_store_t =
[%Michelson(
  {|
    {
      UNPPAIIR;
      CREATE_CONTRACT
#include "../../compiled/tez_store.tz"
      ;
      PAIR;
    }
  |} : deploy_tez_store_t
)];

(* DEX *)

function launch_exchange(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Launch_exchange(params) -> {
        assert_with_error(params.pair.token_a < params.pair.token_b, DexCore.err_wrong_pair_order);

        const pair_info : (pair_t * nat) = get_pair_info_or_default(
          params.pair,
          s.token_to_id,
          s.pairs,
          s.tokens_count
        );
        const pair : pair_t = pair_info.0;
        const token_id : nat = pair_info.1;

        assert_with_error(params.token_a_in > 0n, DexCore.err_zero_a_in);
        assert_with_error(
          (params.pair.token_b = Tez and Tezos.amount > 0mutez) or params.token_b_in > 0n,
          DexCore.err_zero_b_in
        );
        assert_with_error(pair.total_supply = 0n, DexCore.err_pair_listed);

        const init_shares : nat = Math.min_nat(params.token_a_in, params.token_b_in);

        var updated_pair : pair_t := calc_cumulative_prices(
          pair,
          params.token_a_in,
          params.token_b_in
        );

        updated_pair.total_supply := init_shares;

        if s.tokens_count = token_id
        then {
          s.token_to_id[Bytes.pack(params.pair)] := token_id;
          s.token_metadata[token_id] := record [
            token_id   = token_id;
            token_info = Constants.default_token_metadata;
          ];
          s.tokens_count := s.tokens_count + 1n;

          if params.pair.token_b = Tez
          then {
            const deploy_res : (operation * address) = deploy_tez_store(
              (None : option(key_hash)),
              Tezos.amount,
              get_tez_store_initial_storage(
                params.candidate,
                params.shares_receiver,
                s.baker_registry,
                Tezos.amount / 1mutez,
                token_id,
                s.collecting_period
              )
            );

            updated_pair.tez_store := Some(deploy_res.1);

            const callback_params : launch_callback_t = record [
              vote_params = record [
                voter           = params.shares_receiver;
                candidate       = params.candidate;
                execute_voting  = True;
                votes           = init_shares;
                current_balance = 0n;
                new_balance     = init_shares;
              ];
              tez_store   = deploy_res.1;
            ];

            ops := get_launch_exchange_callback_op(callback_params) # ops;
            ops := deploy_res.0 # ops;
          }
          else skip;
        }
        else skip;

        s.ledger[(params.shares_receiver, token_id)] := init_shares;
        s.tokens[token_id] := params.pair;
        s.pairs[token_id] := updated_pair;

        ops := transfer_token(Tezos.sender, Tezos.self_address, params.token_a_in, params.pair.token_a) # ops;

        if params.pair.token_b =/= Tez
        then ops := transfer_token(Tezos.sender, Tezos.self_address, params.token_b_in, params.pair.token_b) # ops
        else skip;
      }
    | _ -> skip
    end
  } with (ops, s)

function invest_liquidity(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Invest_liquidity(params) -> {
        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);

        assert_with_error(pair.token_a_pool * pair.token_b_pool =/= 0n, DexCore.err_no_liquidity);
        assert_with_error(params.shares =/= 0n, DexCore.err_no_shares_expected);

        const tokens : tokens_t = unwrap(s.tokens[params.pair_id], DexCore.err_pair_not_listed);
        const tokens_a_required : nat = div_ceil(params.shares * pair.token_a_pool, pair.total_supply);
        const tokens_b_required : nat = div_ceil(params.shares * pair.token_b_pool, pair.total_supply);

        assert_with_error(tokens_a_required <= params.token_a_in, DexCore.err_low_token_a_in);
        assert_with_error(
          (tokens.token_b = Tez and tokens_b_required <= Tezos.amount / 1mutez)
            or tokens_b_required <= params.token_b_in,
          DexCore.err_low_token_b_in
        );

        const sender_balance : nat = unwrap_or(s.ledger[(params.shares_receiver, params.pair_id)], 0n);

        s.ledger[(params.shares_receiver, params.pair_id)] := sender_balance + params.shares;

        var updated_pair : pair_t := calc_cumulative_prices(
          pair,
          pair.token_a_pool + tokens_a_required,
          pair.token_b_pool + tokens_b_required
        );

        updated_pair.total_supply := updated_pair.total_supply + params.shares;

        s.pairs[params.pair_id] := updated_pair;

        if tokens.token_b = Tez
        then {
          ops := get_vote_op(
            record [
              voter           = params.shares_receiver;
              candidate       = params.candidate;
              execute_voting  = True;
              votes           = sender_balance + params.shares;
              current_balance = sender_balance;
              new_balance     = unwrap_or(s.ledger[(params.shares_receiver, params.pair_id)], 0n);
            ],
            unwrap(updated_pair.tez_store, DexCore.err_tez_store_404)
          ) # ops;
        }
        else skip;

        ops := transfer_token(Tezos.sender, Tezos.self_address, tokens_a_required, tokens.token_a) # ops;
        ops := invest_tez_or_transfer_tokens(params, tokens_b_required, tokens.token_b, updated_pair.tez_store) # ops;
      }
    | _ -> skip
    end;
  } with (ops, s)

function divest_liquidity(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Divest_liquidity(params) -> {
        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);

        assert_with_error(pair.token_a_pool * pair.token_b_pool =/= 0n, DexCore.err_no_liquidity);

        const sender_balance : nat = unwrap_or(s.ledger[(Tezos.sender, params.pair_id)], 0n);

        assert_with_error(params.shares <= sender_balance, DexCore.err_insufficient_liquidity);

        s.ledger[(Tezos.sender, params.pair_id)] := get_nat_or_fail(sender_balance - params.shares);

        const token_a_divested : nat = pair.token_a_pool * params.shares / pair.total_supply;
        const token_b_divested : nat = pair.token_b_pool * params.shares / pair.total_supply;

        assert_with_error(params.min_token_a_out =/= 0n or params.min_token_b_out =/= 0n, DexCore.err_dust_out);
        assert_with_error(
          token_a_divested >= params.min_token_a_out or token_b_divested >= params.min_token_b_out,
          DexCore.err_high_min_out
        );

        var updated_pair : pair_t := calc_cumulative_prices(
          pair,
          get_nat_or_fail(pair.token_a_pool - token_a_divested),
          get_nat_or_fail(pair.token_b_pool - token_b_divested)
        );

        updated_pair.total_supply := get_nat_or_fail(updated_pair.total_supply - params.shares);

        s.pairs[params.pair_id] := updated_pair;

        const tokens : tokens_t = unwrap(s.tokens[params.pair_id], DexCore.err_pair_not_listed);

        if tokens.token_b = Tez
        then {
          ops := get_vote_op(
            record [
              voter           = Tezos.sender;
              candidate       = params.candidate;
              execute_voting  = True;
              votes           = get_nat_or_fail(sender_balance - params.shares);
              current_balance = sender_balance;
              new_balance     = unwrap_or(s.ledger[(Tezos.sender, params.pair_id)], 0n);
            ],
            unwrap(updated_pair.tez_store, DexCore.err_tez_store_404)
          ) # ops;
        }
        else skip;

        ops := transfer_token(Tezos.self_address, params.liquidity_receiver, token_a_divested, tokens.token_a) # ops;
        ops := divest_tez_or_transfer_tokens(
          params.liquidity_receiver,
          token_b_divested,
          tokens.token_b,
          updated_pair.tez_store
        ) # ops;
      }
    | _ -> skip
    end;
  } with (ops, s)

(*

  DEV: operations order is fully reverted in the implementation because
  operation can be added only to the beginning of the list.

  Execution order of the operations will be the next:

  1) get_balance for token A, receive callback and save it
  2) get_balance for token B, receive callback and save it
  3) optimistically transfer token A to the user
  4) optimistically transfer token B to the user
  5) call flash swap proxy and execute user's lambda
  6) call flash_swap callback

 *)
function flash_swap(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Flash_swap(params) -> {
        assert_with_error(params.referrer =/= Tezos.sender, DexCore.err_can_not_refer_yourself);
        assert_with_error(params.amount_a_out > 0n or params.amount_b_out > 0n, DexCore.err_dust_out);

        const tokens : tokens_t = unwrap(s.tokens[params.pair_id], DexCore.err_pair_not_listed);
        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);

        assert_with_error(params.amount_a_out < pair.token_a_pool, DexCore.err_insufficient_liquidity);
        assert_with_error(params.amount_b_out < pair.token_b_pool, DexCore.err_insufficient_liquidity);

        s.tmp := record [
          pair_id           = params.pair_id;
          amount_a_out      = params.amount_a_out;
          amount_b_out      = params.amount_b_out;
          referrer          = params.referrer;
          token_a_balance_1 = 0n;
          token_b_balance_1 = 0n;
          token_a_balance_2 = 0n;
          token_b_balance_2 = 0n;
        ];

        ops := call_flash_swap_callback(Unit) # ops;
        ops := call_flash_swaps_proxy(params.lambda, s.flash_swaps_proxy) # ops;

        if params.amount_b_out > 0n
        then {
          ops := divest_tez_or_transfer_tokens(
            params.receiver,
            params.amount_b_out,
            tokens.token_b,
            pair.tez_store
          ) # ops;
        }
        else skip;

        if params.amount_a_out > 0n
        then ops := transfer_token(Tezos.self_address, params.receiver, params.amount_a_out, tokens.token_a) # ops
        else skip;

        if tokens.token_b = Tez
        then {
          const tez_store : address = unwrap(pair.tez_store, DexCore.err_tez_store_404);

          s.tmp.token_b_balance_1 := unwrap(
            (Tezos.call_view("get_tez_balance", Unit, tez_store) : option(nat)),
            DexCore.err_tez_store_get_tez_balance_view_404
          );
        }
        else {
          ops := get_balance_op_or_fail(
            Tezos.self_address,
            tokens.token_b,
            (
              get_fa12_balance_callback_1(Tezos.self_address),
              get_fa2_balance_callback_1(Tezos.self_address)
            )
          ) # ops;
        };

        ops := get_balance_op_or_fail(
          Tezos.self_address,
          tokens.token_a,
          (
            get_fa12_balance_callback_1(Tezos.self_address),
            get_fa2_balance_callback_1(Tezos.self_address)
          )
        ) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)

function swap(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Swap(params) -> {
        assert_with_error(params.referrer =/= Tezos.sender, DexCore.err_can_not_refer_yourself);

        const first_swap : swap_slice_t = unwrap(List.head_opt(params.swaps), DexCore.err_empty_route);
        const tokens : tokens_t = unwrap(s.tokens[first_swap.pair_id], DexCore.err_pair_not_listed);
        const token : token_t = case first_swap.direction of
        | A_to_b -> tokens.token_a
        | B_to_a -> tokens.token_b
        end;

        if token =/= Tez
        then ops := transfer_token(Tezos.sender, Tezos.self_address, params.amount_in, token) # ops
        else assert_with_error(params.amount_in =/= Tezos.amount / 1mutez, DexCore.err_wrong_tez_amount);

        const tmp : tmp_swap_t = List.fold(
          swap_internal,
          params.swaps,
          record [
            s         = s;
            operation = (None : option(operation));
            token_in  = token;
            receiver  = params.receiver;
            referrer  = params.referrer;
            amount_in = params.amount_in;
          ]
        );

        assert_with_error(tmp.amount_in >= params.min_amount_out, DexCore.err_high_min_out);

        s := tmp.s;

        ops := unwrap(tmp.operation, DexCore.err_empty_route) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)

function withdraw_profit(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Withdraw_profit(params) -> {
        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);
        const user_balance : nat = unwrap_or(s.ledger[(Tezos.sender, params.pair_id)], 0n);

        ops := get_withdraw_profit_op(
          Tezos.sender,
          params.receiver,
          user_balance,
          user_balance,
          unwrap(pair.tez_store, DexCore.err_tez_store_404)
        ) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)

function claim_tok_interface_fee(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Claim_tok_interface_fee(params) -> {
        const interface_fee : nat = unwrap_or(s.tok_interface_fee[(params.token, Tezos.sender)], 0n);

        assert_with_error(
          params.amount * Constants.precision <= interface_fee,
          DexCore.err_insufficient_interface_fee_balance
        );

        if interface_fee > 0n
        then {
          ops := transfer_token(Tezos.self_address, params.receiver, params.amount, params.token) # ops;

          s.tok_interface_fee[(params.token, Tezos.sender)] := get_nat_or_fail(
            interface_fee - params.amount * Constants.precision
          );
        }
        else skip;
      }
    | _ -> skip
    end
  } with (ops, s)

function claim_tez_interface_fee(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Claim_tez_interface_fee(params) -> {
        const interface_fee : nat = unwrap_or(s.tez_interface_fee[(params.pair_id, Tezos.sender)], 0n);

        assert_with_error(
          params.amount * Constants.precision <= interface_fee,
          DexCore.err_insufficient_interface_fee_balance
        );

        if interface_fee > 0n
        then {
          const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);
          const divest_params : divest_tez_t = record [
            receiver     = (get_contract(params.receiver) : contract(unit));
            user         = Tezos.sender;
            amt          = params.amount;
          ];

          ops := get_divest_tez_op(divest_params, unwrap(pair.tez_store, DexCore.err_tez_store_404)) # ops;
        }
        else skip;
      }
    | _ -> skip
    end
  } with (ops, s)

function withdraw_auction_fee(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Withdraw_auction_fee(token) -> {
        const auction_fee : nat = unwrap_or(s.auction_fee[token], 0n);
        const reward : nat = auction_fee * s.fees.withdraw_fee_reward / Constants.precision;
        const params : receive_fee_t = record [
          token = token;
          fee   = auction_fee;
        ];

        ops := get_auction_receive_fee_op(params, s.auction) # ops;
        ops := transfer_token(Tezos.self_address, s.auction, get_nat_or_fail(auction_fee - reward), token) # ops;
        ops := transfer_token(Tezos.self_address, Tezos.sender, reward, token) # ops;

        s.auction_fee[token] := 0n;
      }
    | _ -> skip
    end
  } with (ops, s)

(* ADMIN *)

function set_admin(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_admin(admin) -> {
        only_admin(s.admin);

        s.pending_admin := admin;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function confirm_admin(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Confirm_admin -> {
        only_pending_admin(s.pending_admin);

        s.admin := s.pending_admin;
        s.pending_admin := Constants.zero_address;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function set_flash_swaps_proxy(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_flash_swaps_proxy(flash_swaps_proxy) -> {
        only_admin(s.admin);

        s.flash_swaps_proxy := flash_swaps_proxy;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function set_auction(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_auction(auction) -> {
        only_admin(s.admin);

        s.auction := auction;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function add_managers(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Add_managers(params) -> {
        only_admin(s.admin);

        function add_manager(
          var s         : storage_t;
          const param   : add_manager_t)
                        : storage_t is
          block {
            s.managers := Set.update(param.manager, param.add, s.managers);
          } with s;

        s := List.fold(add_manager, params, s);
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function set_fees(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_fees(fees) -> {
        only_admin(s.admin);

        s.fees := fees;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function set_cycle_duration(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_cycle_duration(cycle_duration) -> {
        only_admin(s.admin);

        s.cycle_duration := cycle_duration;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function set_voting_period(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_voting_period(voting_period) -> {
        only_admin(s.admin);

        s.voting_period := voting_period;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function set_collecting_period(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_collecting_period(collecting_period) -> {
        only_admin(s.admin);

        s.collecting_period := collecting_period;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function update_token_metadata(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Update_token_metadata(params) -> {
        only_manager(s.managers);

        function upd_token_metadata(
          var metadata  : token_metadata_t;
          const pair    : metadata_pair_t)
                        : token_metadata_t is
          block {
            metadata.token_info[pair.key] := pair.value;
          } with metadata;

        var metadata : token_metadata_t := unwrap(s.token_metadata[params.token_id], DexCore.err_pair_not_listed);

        metadata := List.fold(upd_token_metadata, params.token_info, metadata);

        s.token_metadata[params.token_id] := metadata;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function ban(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
      Ban(params) -> {
        only_admin(s.admin);

        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);

        ops := get_ban_baker_op(params.ban_params, unwrap(pair.tez_store, DexCore.err_tez_store_404)) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)
