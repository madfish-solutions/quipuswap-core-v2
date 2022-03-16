function flash_swap_callback(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Flash_swap_callback(_) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        const tmp : tmp_t = unwrap(s.tmp, DexCore.err_tmp_404);
        const interface_fee : nat = tmp.flash_swap_params.amount_out * s.fees.interface_fee;
        const auction_fee : nat = tmp.flash_swap_params.amount_out * s.fees.auction_fee;
        const swap_fee : nat = tmp.flash_swap_params.amount_out * s.fees.swap_fee;
        const _full_fee : nat = interface_fee + auction_fee + swap_fee;

        if tmp.flash_swap_data.return_token = Tez
        then {
          const curr_tez_balance : nat = Tezos.balance / 1mutez;

          assert_with_error(
            curr_tez_balance >= tmp.prev_tez_balance,
            DexCore.err_wrong_flash_swap_returns
          );
        }
        else {
          ops := transfer_token(
            tmp.sender,
            Tezos.self_address,
            tmp.flash_swap_params.amount_out,
            tmp.flash_swap_data.return_token
          ) # ops;
        };

        const (storage, divest_tez_operation_opt) = update_fees(
          s,
          tmp.flash_swap_params.pair_id,
          tmp.flash_swap_data.return_token,
          tmp.flash_swap_params.referrer,
          interface_fee,
          auction_fee
        );

        s := storage;

        case divest_tez_operation_opt of
        | Some(op) -> ops := op # ops
        | None     -> skip
        end;

        s.tmp := (None : option(tmp_t));
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
