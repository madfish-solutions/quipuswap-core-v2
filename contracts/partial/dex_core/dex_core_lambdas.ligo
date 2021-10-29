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
    var ops: list(operation) := nil;

    case action of
    | Launch_exchange(params) -> {
        assert_with_error(params.pair.token_a < params.pair.token_b, DexCore.err_wrong_pair_order);

        const pair_info : (pair_t * nat) = get_pair_info(params.pair, s.token_to_id, s.pairs, s.tokens_count);
        const pair : pair_t = pair_info.0;
        const token_id : nat = pair_info.1;

        assert_with_error(params.token_a_in >= 1n, DexCore.err_zero_a_in);
        assert_with_error(
          (params.pair.token_b =/= Tez and Tezos.amount >= 1mutez) or params.token_b_in >= 1n,
          DexCore.err_zero_b_in
        );
        assert_with_error(pair.total_supply = 0n, DexCore.err_pair_listed);

        const init_shares : nat = Math.min_nat(params.token_a_in, params.token_b_in);

        var (updated_pair, last_block_timestamp) := calc_cumulative_prices(
          pair,
          s.last_block_timestamp,
          params.token_a_in,
          params.token_b_in
        );

        s.last_block_timestamp := last_block_timestamp;

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
              0mutez,
              get_tez_store_initial_storage(
                params.candidate,
                params.shares_recipient,
                Tezos.amount / 1mutez,
                init_shares,
                s.cycle_duration,
                s.baker_registry
              )
            );

            updated_pair.tez_store := Some(deploy_res.1);

            ops := deploy_res.0 # ops;
          }
          else skip;
        }
        else skip;

        s.ledger[(params.shares_recipient, token_id)] := init_shares;
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
    var ops: list(operation) := nil;

    case action of
    | Invest_liquidity(params) -> {
        const pair : pair_t = get_pair(params.pair_id, s.pairs);

        assert_with_error(pair.token_a_pool * pair.token_b_pool =/= 0n, DexCore.err_no_liquidity);
        assert_with_error(params.shares =/= 0n, DexCore.err_no_shares_expected);

        const tokens : tokens_t = get_tokens(params.pair_id, s.tokens);
        const tokens_a_required : nat = div_ceil(params.shares * pair.token_a_pool, pair.total_supply);
        const tokens_b_required : nat = div_ceil(params.shares * pair.token_b_pool, pair.total_supply);

        assert_with_error(tokens_a_required <= params.token_a_in, DexCore.err_low_token_a_in);
        assert_with_error(
          (tokens.token_b =/= Tez and tokens_b_required <= Tezos.amount / 1mutez)
            or tokens_b_required <= params.token_b_in,
          DexCore.err_low_token_b_in
        );

        const sender_balance : nat = get_token_balance(params.shares_recipient, params.pair_id, s.ledger);

        s.ledger[(params.shares_recipient, params.pair_id)] := sender_balance + params.shares;

        var (updated_pair, last_block_timestamp) := calc_cumulative_prices(
          pair,
          s.last_block_timestamp,
          pair.token_a_pool + tokens_a_required,
          pair.token_b_pool + tokens_b_required
        );

        s.last_block_timestamp := last_block_timestamp;

        updated_pair.total_supply := updated_pair.total_supply + params.shares;

        s.pairs[params.pair_id] := updated_pair;

        if tokens.token_b = Tez
        then {
          ops := get_vote_op(
            record [
              voter          = params.shares_recipient;
              candidate      = params.candidate;
              votes          = sender_balance + params.shares;
              cycle_duration = s.cycle_duration;
            ],
            get_tez_store_or_fail(updated_pair.tez_store)
          ) # ops;
        }
        else skip;

        ops := transfer_token(Tezos.sender, Tezos.self_address, tokens_a_required, tokens.token_a) # ops;
        ops := check_tez_or_token_and_transfer(
          params,
          tokens_b_required,
          tokens.token_b,
          updated_pair.total_supply,
          updated_pair.tez_store
        ) # ops;
      }
    | _ -> skip
    end;
  } with (ops, s)

function divest_liquidity(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops: list(operation) := nil;

    case action of
    | Divest_liquidity(params) -> {
        const pair : pair_t = get_pair(params.pair_id, s.pairs);

        assert_with_error(pair.token_a_pool * pair.token_b_pool =/= 0n, DexCore.err_no_liquidity);

        const sender_balance : nat = get_token_balance(Tezos.sender, params.pair_id, s.ledger);

        assert_with_error(params.shares <= sender_balance, DexCore.err_insufficient_lp);

        s.ledger[(Tezos.sender, params.pair_id)] := abs(sender_balance - params.shares);

        const token_a_divested : nat = pair.token_a_pool * params.shares / pair.total_supply;
        const token_b_divested : nat = pair.token_b_pool * params.shares / pair.total_supply;

        assert_with_error(params.min_token_a_out =/= 0n or params.min_token_b_out =/= 0n, DexCore.err_dust_out);
        assert_with_error(
          token_a_divested >= params.min_token_a_out or token_b_divested >= params.min_token_b_out,
          DexCore.err_high_min_out
        );

        var (updated_pair, last_block_timestamp) := calc_cumulative_prices(
          pair,
          s.last_block_timestamp,
          abs(pair.token_a_pool - token_a_divested),
          abs(pair.token_b_pool - token_b_divested)
        );

        s.last_block_timestamp := last_block_timestamp;

        updated_pair.total_supply := abs(updated_pair.total_supply - params.shares);

        s.pairs[params.pair_id] := updated_pair;

        const tokens : tokens_t = get_tokens(params.pair_id, s.tokens);

        if tokens.token_b = Tez
        then {
          ops := get_vote_op(
            record [
              voter          = Tezos.sender;
              candidate      = params.candidate;
              votes          = abs(sender_balance - params.shares);
              cycle_duration = s.cycle_duration;
            ],
            get_tez_store_or_fail(updated_pair.tez_store)
          ) # ops;
        }
        else skip;

        ops := transfer_token(Tezos.self_address, params.liquidity_recipient, token_a_divested, tokens.token_a) # ops;
        ops := divest_tez_or_transfer_tokens(
          params.liquidity_recipient,
          token_b_divested,
          tokens.token_b,
          updated_pair.total_supply,
          updated_pair.tez_store
        ) # ops;
      }
    | _ -> skip
    end;
  } with (ops, s)

function swap(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops: list(operation) := nil;

    case action of
    | Swap(params) -> {
        const first_swap : swap_slice_t = case List.head_opt(params.swaps) of
        | Some(swap) -> swap
        | None       -> failwith(DexCore.err_empty_route)
        end;
        const tokens : tokens_t = get_tokens(first_swap.pair_id, s.tokens);
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
            amount_in = params.amount_in;
          ]
        );

        assert_with_error(tmp.amount_in >= params.min_amount_out, DexCore.err_high_min_out);

        s := tmp.s;

        const last_op : operation = case tmp.operation of
        | Some(op) -> op
        | None     -> failwith(DexCore.err_empty_route)
        end;

        ops := last_op # ops;
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

        var metadata : token_metadata_t := get_token_metadata(params.token_id, s.token_metadata);

        metadata := List.fold(upd_token_metadata, params.token_info, metadata);

        s.token_metadata[params.token_id] := metadata;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function ban(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
      Ban(params) -> {
        only_admin(s.admin);

        const pair : pair_t = get_pair(params.pair_id, s.pairs);

        ops := get_ban_baker_op(params.ban_params, get_tez_store_or_fail(pair.tez_store)) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)

(* VIEWS *)

function get_reserves(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Get_reserves(params) -> {
      function look_up_reserves(
        const l         : list(reserves_res_t);
        const pair_id   : reserves_req_t)
                        : list(reserves_res_t) is
        block {
          const pair : pair_t = get_pair(pair_id, s.pairs);
          const response : reserves_res_t = record [
            request  = pair_id;
            reserves = record [
              token_a_pool = pair.token_a_pool;
              token_b_pool = pair.token_b_pool;
            ];
          ];
        } with response # l;

      const response : list(reserves_res_t) = List.fold(
        look_up_reserves,
        params.requests,
        (nil : list(reserves_res_t))
      );

      ops := Tezos.transaction(response, 0mutez, params.callback) # ops;
    }
    | _ -> skip
    end
  } with (ops, s)

function get_total_supply(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Get_total_supply(params) -> {
      function look_up_total_supply(
        const l         : list(total_supply_res_t);
        const pair_id   : total_supply_req_t)
                        : list(total_supply_res_t) is
        block {
          const pair : pair_t = get_pair(pair_id, s.pairs);
          const response : total_supply_res_t = record [
            request      = pair_id;
            total_supply = pair.total_supply;
          ];
        } with response # l;

      const response : list(total_supply_res_t) = List.fold(
        look_up_total_supply,
        params.requests,
        (nil : list(total_supply_res_t))
      );

      ops := Tezos.transaction(response, 0mutez, params.callback) # ops;
    }
    | _ -> skip
    end
  } with (ops, s)

function check_is_banned_baker(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
      Check_is_banned_baker(params) -> {
        const pair : pair_t = get_pair(params.pair_id, s.pairs);

        ops := get_check_is_banned_baker_op(params.check_params, get_tez_store_or_fail(pair.tez_store)) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)

function get_swap_min_res(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Get_swap_min_res(_params) -> {
      skip;
    }
    | _ -> skip
    end
  } with (ops, s)

function get_toks_per_share(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Get_toks_per_share(params) -> {
      function look_up_toks_per_share(
        const l         : list(toks_per_shr_res_t);
        const request   : toks_per_shr_req_t)
                        : list(toks_per_shr_res_t) is
        block {
          const pair : pair_t = get_pair(request.pair_id, s.pairs);
          const response : toks_per_shr_res_t = record [
            request          = request;
            tokens_per_share = record [
              token_a_amt = request.shares_amt * pair.token_a_pool / pair.total_supply;
              token_b_amt = request.shares_amt * pair.token_b_pool / pair.total_supply;
            ];
          ];
        } with response # l;

      const response : list(toks_per_shr_res_t) = List.fold(
        look_up_toks_per_share,
        params.requests,
        (nil : list(toks_per_shr_res_t))
      );

      ops := Tezos.transaction(response, 0mutez, params.callback) # ops;
    }
    | _ -> skip
    end
  } with (ops, s)

function get_cumulative_prices(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Get_cumulative_prices(params) -> {
      function look_up_cumulative_prices(
        const l         : list(cum_prices_res_t);
        const pair_id   : token_id_t)
                        : list(cum_prices_res_t) is
        block {
          const pair : pair_t = get_pair(pair_id, s.pairs);
          const response : cum_prices_res_t = record [
            request           = pair_id;
            cumulative_prices = record [
              last_block_timestamp = s.last_block_timestamp;
              token_a_price_cum    = pair.token_a_price_cum;
              token_b_price_cum    = pair.token_b_price_cum;
            ];
          ];
        } with response # l;

      const response : list(cum_prices_res_t) = List.fold(
        look_up_cumulative_prices,
        params.requests,
        (nil : list(cum_prices_res_t))
      );

      ops := Tezos.transaction(response, 0mutez, params.callback) # ops;
    }
    | _ -> skip
    end
  } with (ops, s)
