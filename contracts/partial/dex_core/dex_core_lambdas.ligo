const deploy_bucket : deploy_bucket_t =
[%Michelson(
  {|
    {
      UNPPAIIR;
      CREATE_CONTRACT
#include "../../compiled/bucket.tz"
      ;
      PAIR;
    }
  |} : deploy_bucket_t
)];

(* DEX *)

function launch_exchange(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    s.entered := check_reentrancy(s.entered);

    var ops : list(operation) := list [
      get_close_op(Unit);
    ];

    case action of [
    | Launch_exchange(params) -> {
        assert_with_error(params.deadline >= Tezos.now, DexCore.err_action_outdated);
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
        assert_with_error(params.token_b_in > 0n, DexCore.err_zero_b_in);

        if params.pair.token_b = Tez
        then assert_with_error(Tezos.amount / 1mutez = params.token_b_in, DexCore.err_wrong_tez_amount)
        else non_payable(Unit);

        assert_with_error(pair.total_supply = 0n, DexCore.err_pair_listed);

        const init_shares : nat = Math.min_nat(params.token_a_in, params.token_b_in);

        var updated_pair : pair_t := calc_cumulative_prices(pair, params.token_a_in, params.token_b_in);

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
            const deploy_res : (operation * address) = deploy_bucket(
              (None : option(key_hash)),
              Tezos.amount,
              get_bucket_initial_storage(s.baker_registry, token_id, s.collecting_period)
            );

            updated_pair.bucket := Some(deploy_res.1);

            const callback_params : launch_callback_t = record [
              vote_params = record [
                voter           = params.shares_receiver;
                candidate       = params.candidate;
                execute_voting  = True;
                votes           = init_shares;
              ];
              bucket      = deploy_res.1;
            ];

            ops := get_launch_exchange_callback_op(callback_params) # ops;
            ops := deploy_res.0 # ops;
          }
          else skip;
        }
        else {
          if params.pair.token_b = Tez
          then {
            ops := get_vote_op(
              record [
                voter           = params.shares_receiver;
                candidate       = params.candidate;
                execute_voting  = True;
                votes           = init_shares;
              ],
              unwrap(updated_pair.bucket, DexCore.err_bucket_404)
            ) # ops;
            ops := get_fill_op(Tezos.amount, unwrap(updated_pair.bucket, DexCore.err_bucket_404)) # ops;
          }
          else skip;
        };

        s.ledger[(params.shares_receiver, token_id)] := init_shares;
        s.tokens[token_id] := params.pair;
        s.pairs[token_id] := updated_pair;

        ops := transfer_token(Tezos.sender, Tezos.self_address, params.token_a_in, params.pair.token_a) # ops;

        if params.pair.token_b =/= Tez
        then ops := transfer_token(Tezos.sender, Tezos.self_address, params.token_b_in, params.pair.token_b) # ops
        else skip;
      }
    | _ -> skip
    ]
  } with (ops, s)

function invest_liquidity(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    s.entered := check_reentrancy(s.entered);

    var ops : list(operation) := list [
      get_close_op(Unit);
    ];

    case action of [
    | Invest_liquidity(params) -> {
        assert_with_error(params.deadline >= Tezos.now, DexCore.err_action_outdated);

        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);

        assert_with_error(pair.token_a_pool * pair.token_b_pool =/= 0n, DexCore.err_no_liquidity);
        assert_with_error(params.shares =/= 0n, DexCore.err_no_shares_expected);

        const tokens : tokens_t = unwrap(s.tokens[params.pair_id], DexCore.err_pair_not_listed);
        const tokens_a_required : nat = ceil_div(params.shares * pair.token_a_pool, pair.total_supply);
        const tokens_b_required : nat = ceil_div(params.shares * pair.token_b_pool, pair.total_supply);

        if tokens.token_b = Tez
        then assert_with_error(params.token_b_in = Tezos.amount / 1mutez, DexCore.err_wrong_tez_amount)
        else non_payable(Unit);

        assert_with_error(tokens_a_required <= params.token_a_in, DexCore.err_low_token_a_in);
        assert_with_error(tokens_b_required <= params.token_b_in, DexCore.err_low_token_b_in);

        const receiver_balance : nat = unwrap_or(s.ledger[(params.shares_receiver, params.pair_id)], 0n);

        s.ledger[(params.shares_receiver, params.pair_id)] := receiver_balance + params.shares;

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
              votes           = receiver_balance + params.shares;
            ],
            unwrap(updated_pair.bucket, DexCore.err_bucket_404)
          ) # ops;
        }
        else skip;


        if Tezos.amount / 1mutez > tokens_b_required
        then {
          ops := transfer_tez(
            (Tezos.get_contract_with_error(Tezos.sender, Common.err_contract_404) : contract(unit)),
            get_nat_or_fail(Tezos.amount / 1mutez - tokens_b_required)
          ) # ops;
        }
        else skip;
        ops := fill_or_transfer_tokens(tokens_b_required, tokens.token_b, updated_pair.bucket) # ops;
        ops := transfer_token(Tezos.sender, Tezos.self_address, tokens_a_required, tokens.token_a) # ops;
      }
    | _ -> skip
    ]
  } with (ops, s)

function divest_liquidity(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    s.entered := check_reentrancy(s.entered);

    var ops : list(operation) := list [
      get_close_op(Unit);
    ];

    case action of [
    | Divest_liquidity(params) -> {
        non_payable(Unit);

        assert_with_error(params.deadline >= Tezos.now, DexCore.err_action_outdated);

        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);

        assert_with_error(pair.token_a_pool * pair.token_b_pool =/= 0n, DexCore.err_no_liquidity);

        const sender_balance : nat = unwrap_or(s.ledger[(Tezos.sender, params.pair_id)], 0n);

        assert_with_error(params.shares <= sender_balance, DexCore.err_insufficient_liquidity);

        s.ledger[(Tezos.sender, params.pair_id)] := get_nat_or_fail(sender_balance - params.shares);

        const token_a_divested : nat = params.shares * pair.token_a_pool / pair.total_supply;
        const token_b_divested : nat = params.shares * pair.token_b_pool / pair.total_supply;

        assert_with_error(params.min_token_a_out =/= 0n and params.min_token_b_out =/= 0n, DexCore.err_dust_out);
        assert_with_error(
          token_a_divested >= params.min_token_a_out and token_b_divested >= params.min_token_b_out,
          DexCore.err_high_min_out
        );

        var updated_pair : pair_t := calc_cumulative_prices(
          pair,
          get_nat_or_fail(pair.token_a_pool - token_a_divested),
          get_nat_or_fail(pair.token_b_pool - token_b_divested)
        );

        updated_pair.total_supply := get_nat_or_fail(updated_pair.total_supply - params.shares);

        assert_with_error(
          ((updated_pair.total_supply or updated_pair.token_a_pool or updated_pair.token_b_pool) = 0n)
            or (updated_pair.total_supply * updated_pair.token_a_pool * updated_pair.token_b_pool =/= 0n),
          DexCore.err_wrong_reserves_state
        );

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
            ],
            unwrap(updated_pair.bucket, DexCore.err_bucket_404)
          ) # ops;
        }
        else skip;

        ops := pour_out_or_transfer_tokens(
          params.liquidity_receiver,
          token_b_divested,
          tokens.token_b,
          updated_pair.bucket
        ) # ops;
        ops := transfer_token(Tezos.self_address, params.liquidity_receiver, token_a_divested, tokens.token_a) # ops;
      }
    | _ -> skip
    ]
  } with (ops, s)

function swap(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    s.entered := check_reentrancy(s.entered);

    var ops : list(operation) := list [
      get_close_op(Unit);
    ];

    case action of [
    | Swap(params) -> {
        assert_with_error(params.deadline >= Tezos.now, DexCore.err_action_outdated);

        const first_swap : swap_slice_t = unwrap(List.head_opt(params.swaps), DexCore.err_empty_route);
        const tokens : tokens_t = unwrap(s.tokens[first_swap.pair_id], DexCore.err_pair_not_listed);
        const pair : pair_t = unwrap(s.pairs[first_swap.pair_id], DexCore.err_pair_not_listed);
        const token : token_t = case first_swap.direction of [
        | A_to_b -> tokens.token_a
        | B_to_a -> tokens.token_b
        ];
        const tmp : tmp_swap_t = List.fold(
          swap_internal,
          params.swaps,
          record [
            s               = s;
            forwards        = (nil : list(forward_t));
            token_in        = token;
            receiver        = params.receiver;
            referrer        = params.referrer;
            from_bucket     = (None : option(address));
            amount_in       = params.amount_in;
            counter         = 0n;
          ]
        );

        assert_with_error(tmp.amount_in >= params.min_amount_out, DexCore.err_high_min_out);

        const forward_ops : list(operation) = List.fold(create_pour_over_op, tmp.forwards, (nil : list(operation)));

        s := tmp.s;

        if token = Tez
        then {
          ops := concat_lists(forward_ops, ops);

          case params.lambda of [
          | Some(_) -> {
              const flash_swap_callback_params : flash_swap_callback_t = record [
                pair_id          = first_swap.pair_id;
                prev_tez_balance = Tezos.balance / 1mutez;
                amount_in        = params.amount_in;
              ];

              ops := call_flash_swap_callback(flash_swap_callback_params) # ops;
            }
          | None    -> {
              assert_with_error(params.amount_in = Tezos.amount / 1mutez, DexCore.err_wrong_tez_amount);

              ops := get_fill_op(params.amount_in * 1mutez, unwrap(pair.bucket, DexCore.err_bucket_404)) # ops;
            }
          ];
        }
        else {
          non_payable(Unit);

          ops := transfer_token(Tezos.sender, Tezos.self_address, params.amount_in, token) # ops;
          ops := concat_lists(forward_ops, ops);
        };

        case params.lambda of [
        | Some(lambda) -> ops := call_flash_swaps_proxy(lambda, s.flash_swaps_proxy) # ops
        | None         -> skip
        ];

        ops := pour_out_or_transfer_tokens(tmp.receiver, tmp.amount_in, tmp.token_in, tmp.from_bucket) # ops;
      }
    | _ -> skip
    ]
  } with (ops, s)

function withdraw_profit(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    s.entered := check_reentrancy(s.entered);

    var ops : list(operation) := list [
      get_close_op(Unit);
    ];

    case action of [
    | Withdraw_profit(params) -> {
        non_payable(Unit);

        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);

        ops := get_withdraw_profit_op(
          Tezos.sender,
          params.receiver,
          unwrap(pair.bucket, DexCore.err_bucket_404)
        ) # ops;
      }
    | _ -> skip
    ]
  } with (ops, s)

function claim_interface_fee(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    s.entered := check_reentrancy(s.entered);

    var ops : list(operation) := list [
      get_close_op(Unit);
    ];

    case action of [
    | Claim_interface_fee(params) -> {
        non_payable(Unit);

        assert_with_error(params.token =/= Tez, DexCore.err_cant_claim_tez_fees_by_this_ep);

        const interface_fee_f : nat = unwrap_or(s.interface_fee[(params.token, Tezos.sender)], 0n);
        const value : nat = interface_fee_f / Constants.precision;

        if value > 0n
        then {
          s.interface_fee[(params.token, Tezos.sender)] := get_nat_or_fail(interface_fee_f - value *
            Constants.precision);

          ops := transfer_token(Tezos.self_address, params.receiver, value, params.token) # ops;
        }
        else skip;
      }
    | _ -> skip
    ]
  } with (ops, s)

function claim_interface_tez_fee(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    s.entered := check_reentrancy(s.entered);

    var ops : list(operation) := list [
      get_close_op(Unit);
    ];

    case action of [
    | Claim_interface_tez_fee(params) -> {
        non_payable(Unit);

        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);
        const interface_fee_f : nat = unwrap_or(s.interface_tez_fee[(params.pair_id, Tezos.sender)], 0n);
        const value : nat = interface_fee_f / Constants.precision;

        if value > 0n
        then {
          s.interface_tez_fee[(params.pair_id, Tezos.sender)] := get_nat_or_fail(interface_fee_f - value *
            Constants.precision);

          const divest_params : pour_out_t = record [
            receiver = (Tezos.get_contract_with_error(params.receiver, Common.err_contract_404) : contract(unit));
            amt      = value;
          ];

          ops := get_pour_out_op(divest_params, unwrap(pair.bucket, DexCore.err_bucket_404)) # ops;
        }
        else skip;
      }
    | _ -> skip
    ]
  } with (ops, s)

function withdraw_auction_fee(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    s.entered := check_reentrancy(s.entered);

    var ops : list(operation) := list [
      get_close_op(Unit);
    ];

    case action of [
    | Withdraw_auction_fee(params) -> {
        non_payable(Unit);

        const auction_fee_f : nat = unwrap_or(
          if params.token = Tez
          then s.auction_tez_fee[unwrap(params.pair_id, DexCore.err_no_pair_id)]
          else s.auction_fee[params.token],
          0n
        );
        const user_reward : nat = auction_fee_f * s.fees.withdraw_fee_reward / Constants.precision /
          Constants.precision;
        const actual_auction_fee : nat = get_nat_or_fail((auction_fee_f / Constants.precision) - user_reward);
        const auction_fee_change : nat = get_nat_or_fail(
          auction_fee_f - ((user_reward + actual_auction_fee) * Constants.precision)
        );
        var bucket : option(address) := (None : option(address));

        if params.token = Tez
        then {
          const pair_id : nat = unwrap(params.pair_id, DexCore.err_no_pair_id);
          const pair : pair_t = unwrap(s.pairs[pair_id], DexCore.err_pair_not_listed);

          s.auction_tez_fee[pair_id] := auction_fee_change;
          bucket := pair.bucket;
        }
        else s.auction_fee[params.token] := auction_fee_change;

        const receive_fee_params : receive_fee_t = record [
          token = params.token;
          fee   = actual_auction_fee;
        ];

        ops := pour_out_or_transfer_tokens(Tezos.sender, user_reward, params.token, bucket) # ops;
        
        ops := get_auction_receive_fee_op(receive_fee_params, s.auction) # ops;
        ops := pour_out_or_transfer_tokens(s.auction, actual_auction_fee, params.token, bucket) # ops;
      }
    | _ -> skip
    ]
  } with (ops, s)

function vote(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    s.entered := check_reentrancy(s.entered);

    var ops : list(operation) := list [
      get_close_op(Unit);
    ];

    case action of [
    | Vote(params) -> {
        non_payable(Unit);

        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);
        const voter_balance : nat = unwrap_or(s.ledger[(Tezos.sender, params.pair_id)], 0n);

        assert_with_error(voter_balance > 0n, DexCore.err_can_not_perform_voting);

        ops := get_vote_op(
          record [
            voter           = Tezos.sender;
            candidate       = params.candidate;
            execute_voting  = True;
            votes           = voter_balance;
          ],
          unwrap(pair.bucket, DexCore.err_bucket_404)
        ) # ops;
      }
    | _ -> skip
    ]
  } with (ops, s)

(* ADMIN *)

function claim(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;
    case action of [
    | Claim(params) -> {
        only_admin(s.admin);
        non_payable(Unit);

        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);

        ops := get_claim_op(params.receiver, unwrap(pair.bucket, DexCore.err_bucket_404)) # ops;
      }
    | _ -> skip
    ]
  } with (ops, s)

function set_admin(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of [
    | Set_admin(admin) -> {
        only_admin(s.admin);
        non_payable(Unit);

        s.pending_admin := Some(admin);
      }
    | _ -> skip
    ]
  } with ((nil : list(operation)), s)

function set_baker_rate(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of [
    | Set_baker_rate(rate) -> {
        only_admin(s.admin);
        non_payable(Unit);
        assert_with_error(rate < Constants.precision, Common.err_rate_too_high);

        s.baker_rate_f := rate;
      }
    | _ -> skip
    ]
  } with ((nil : list(operation)), s)

function confirm_admin(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of [
    | Confirm_admin -> {
        const pending_admin : address = unwrap(s.pending_admin, Common.err_pending_admin_is_none);

        assert_with_error(Tezos.sender = pending_admin, Common.err_not_pending_admin);

        non_payable(Unit);

        s.admin := pending_admin;
        s.pending_admin := (None : option(address));
      }
    | _ -> skip
    ]
  } with ((nil : list(operation)), s)

function set_flash_swaps_proxy(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of [
    | Set_flash_swaps_proxy(flash_swaps_proxy) -> {
        only_admin(s.admin);
        non_payable(Unit);

        s.flash_swaps_proxy := flash_swaps_proxy;
      }
    | _ -> skip
    ]
  } with ((nil : list(operation)), s)

function set_auction(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of [
    | Set_auction(auction) -> {
        only_admin(s.admin);
        non_payable(Unit);

        s.auction := auction;
      }
    | _ -> skip
    ]
  } with ((nil : list(operation)), s)

function add_managers(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of [
    | Add_managers(params) -> {
        only_admin(s.admin);
        non_payable(Unit);

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
    ]
  } with ((nil : list(operation)), s)

function set_fees(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of [
    | Set_fees(fees) -> {
        only_admin(s.admin);
        non_payable(Unit);

        s.fees := fees;
      }
    | _ -> skip
    ]
  } with ((nil : list(operation)), s)

function set_collecting_period(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of [
    | Set_collecting_period(collecting_period) -> {
        only_admin(s.admin);
        non_payable(Unit);

        s.collecting_period := collecting_period;
      }
    | _ -> skip
    ]
  } with ((nil : list(operation)), s)

function update_token_metadata(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of [
    | Update_token_metadata(params) -> {
        only_manager(s.managers);
        non_payable(Unit);

        const _ = unwrap(s.token_metadata[params.token_id], DexCore.err_pair_not_listed);

        s.token_metadata[params.token_id] := params;
      }
    | _ -> skip
    ]
  } with ((nil : list(operation)), s)

function ban(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of [
      Ban(params) -> {
        only_admin(s.admin);
        non_payable(Unit);

        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);

        ops := get_ban_baker_op(params.ban_params, unwrap(pair.bucket, DexCore.err_bucket_404)) # ops;
      }
    | _ -> skip
    ]
  } with (ops, s)
