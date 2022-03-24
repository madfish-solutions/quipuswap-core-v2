function flash_swap_callback(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Flash_swap_callback(params) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        var pair : pair_t := unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);
        const flash_swap_result : flash_swap_res_t = calculate_flash_swap_result(
          params.flash_swap_rule,
          s.fees,
          params.amount_out,
          params.swap_token_pool,
          params.return_token_pool
        );

        if params.return_token = Tez
        then {
          const curr_tez_balance : nat = Tezos.balance / 1mutez;
          const tez_amount_to_invest : nat = get_nat_or_fail(curr_tez_balance - params.prev_tez_balance);

          case params.flash_swap_rule of
          | Loan_a_return_a -> failwith(DexCore.err_wrong_flash_swap_returns)
          | Loan_a_return_b -> {
            assert_with_error(
              curr_tez_balance >= params.prev_tez_balance + flash_swap_result.returns,
              DexCore.err_wrong_flash_swap_returns
            );

          }
          | Loan_b_return_a -> {
            assert_with_error(
              curr_tez_balance >= params.prev_tez_balance + flash_swap_result.returns,
              DexCore.err_wrong_flash_swap_returns
            );
          }
          | Loan_b_return_b -> {
            assert_with_error(
              curr_tez_balance >= params.prev_tez_balance + flash_swap_result.full_fee,
              DexCore.err_wrong_flash_swap_returns
            );
          }
          end;

          ops := get_invest_tez_op(
            tez_amount_to_invest * 1mutez,
            unwrap(pair.tez_store, DexCore.err_tez_store_404)
          ) # ops;

        }
        else {
          ops := transfer_token(
            params.sender,
            Tezos.self_address,
            flash_swap_result.returns,
            params.return_token
          ) # ops;
        };

        case params.flash_swap_rule of
        | Loan_a_return_a -> {
          pair := calc_cumulative_prices(pair, flash_swap_result.new_return_tok_pool, pair.token_b_pool);
        }
        | Loan_a_return_b -> {
          pair := calc_cumulative_prices(
            pair,
            get_nat_or_fail(pair.token_a_pool - params.amount_out),
            flash_swap_result.new_return_tok_pool
          );
        }
        | Loan_b_return_a -> {
          pair := calc_cumulative_prices(
            pair,
            flash_swap_result.new_return_tok_pool,
            get_nat_or_fail(pair.token_b_pool - params.amount_out)
          );
        }
        | Loan_b_return_b -> {
          pair := calc_cumulative_prices(
            pair,
            pair.token_a_pool,
            flash_swap_result.new_return_tok_pool
          );
        }
        end;

        s.pairs[params.pair_id] := pair;

        const (storage, divest_tez_operation_opt) = update_fees(
          s,
          params.pair_id,
          params.return_token,
          params.referrer,
          flash_swap_result.interface_fee,
          flash_swap_result.auction_fee
        );

        s := storage;

        case divest_tez_operation_opt of
        | Some(op) -> ops := op # ops
        | None     -> skip
        end;

        ops := reverse_list(ops);
      }
    | _ -> skip
    end
  } with (ops, s)

function launch_callback(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Launch_callback(params) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        ops := get_vote_op(params.vote_params, params.tez_store) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)

function close(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Close(_) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        s.entered := False;
      }
    | _ -> skip
    end
  } with (ops, s)
