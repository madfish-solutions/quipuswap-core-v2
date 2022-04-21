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
        non_payable(Unit);

        const curr_tez_balance : nat = Tezos.balance / 1mutez;
        const tez_balances_delta : nat = get_nat_or_fail(curr_tez_balance - params.prev_tez_balance);

        assert_with_error(tez_balances_delta >= params.amount_in, DexCore.err_wrong_flash_swap_returns);

        const pair : pair_t = unwrap(s.pairs[params.pair_id], DexCore.err_pair_not_listed);

        ops := get_fill_op(params.amount_in * 1mutez, unwrap(pair.bucket, DexCore.err_bucket_404)) # ops;
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
        non_payable(Unit);

        ops := get_vote_op(params.vote_params, params.bucket) # ops;
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
        non_payable(Unit);

        s.entered := False;
      }
    | _ -> skip
    ]
  } with (ops, s)
