function flash_swap_callback(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of [
    | Flash_swap_callback(params) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        var pair : pair_t := unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);
        const interface_fee : nat = params.amount_out * s.fees.interface_fee;
        const auction_fee : nat = params.amount_out * s.fees.auction_fee;
        const swap_fee : nat = params.amount_out * s.fees.swap_fee;
        const full_fee : nat = interface_fee + auction_fee + swap_fee;
        const fee : nat = get_nat_or_fail(
          (params.amount_out * Constants.precision - interface_fee - auction_fee) / Constants.precision
        );

        if params.return_token = Tez
        then {
          const curr_tez_balance : nat = Tezos.balance / 1mutez;

          assert_with_error(
            curr_tez_balance >= params.prev_tez_balance + div_ceil(full_fee, Constants.precision),
            DexCore.err_wrong_flash_swap_returns
          );

          const tez_amount_to_invest : nat = get_nat_or_fail(curr_tez_balance - params.prev_tez_balance);

          ops := get_invest_tez_op(
            tez_amount_to_invest * 1mutez,
            unwrap(pair.tez_store, DexCore.err_tez_store_404)
          ) # ops;

          case params.flash_swap_rule of [
          | Loan_a_return_a -> skip
          | Loan_a_return_b -> {
            pair := calc_cumulative_prices(
              pair,
              get_nat_or_fail(pair.token_a_pool - params.amount_out),
              pair.token_b_pool + tez_amount_to_invest
            );
          }
          | Loan_b_return_a -> {
            pair := calc_cumulative_prices(
              pair,
              pair.token_a_pool + params.amount_out + fee,
              get_nat_or_fail(pair.token_b_pool - params.amount_out)
            );
          }
          | Loan_b_return_b -> {
            pair := calc_cumulative_prices(
              pair,
              pair.token_a_pool,
              pair.token_b_pool + get_nat_or_fail(tez_amount_to_invest - params.amount_out)
            );
          }
          ];
        }
        else {
          case params.flash_swap_rule of [
          | Loan_a_return_a -> {
            pair := calc_cumulative_prices(pair, pair.token_a_pool + fee, pair.token_b_pool);
          }
          | Loan_a_return_b -> {
            pair := calc_cumulative_prices(
              pair,
              get_nat_or_fail(pair.token_a_pool - params.amount_out),
              pair.token_b_pool + params.amount_out + fee
            );
          }
          | Loan_b_return_a -> {
            pair := calc_cumulative_prices(
              pair,
              pair.token_a_pool + params.amount_out + fee,
              get_nat_or_fail(pair.token_b_pool - params.amount_out)
            );
          }
          | Loan_b_return_b -> {
            pair := calc_cumulative_prices(pair, pair.token_a_pool, pair.token_b_pool + fee);
          }
          ];

          ops := transfer_token(
            params.sender,
            Tezos.self_address,
            params.amount_out + div_ceil(full_fee, Constants.precision),
            params.return_token
          ) # ops;
        };

        s.pairs[params.pair_id] := pair;

        const storage = update_fees(
          s,
          params.pair_id,
          params.return_token,
          params.referrer,
          interface_fee,
          auction_fee
        );

        s := storage;

        ops := reverse_list(ops);
      }
    | _ -> skip
    ]
  } with (ops, s)

function launch_callback(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of [
    | Launch_callback(params) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        ops := get_vote_op(params.vote_params, params.tez_store) # ops;
      }
    | _ -> skip
    ]
  } with (ops, s)

function close(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of [
    | Close(_) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        s.entered := False;
      }
    | _ -> skip
    ]
  } with (ops, s)
