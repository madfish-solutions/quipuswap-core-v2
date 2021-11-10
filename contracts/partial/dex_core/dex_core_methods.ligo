function call_dex_core(
  const action          : action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    const id : nat = case action of
    (* DEX *)
    | Launch_exchange(_)         -> 0n
    | Invest_liquidity(_)        -> 1n
    | Divest_liquidity(_)        -> 2n
    | Flash_swap(_)              -> 3n
    | Swap(_)                    -> 4n
    (* ADMIN *)
    | Set_admin(_)               -> 5n
    | Confirm_admin(_)           -> 6n
    | Set_flash_swaps_proxy(_)   -> 7n
    | Add_managers(_)            -> 8n
    | Set_fees(_)                -> 9n
    | Set_cycle_duration(_)      -> 10n
    | Update_token_metadata(_)   -> 11n
    | Ban(_)                     -> 12n
    (* PERMIT *)
    | Permit(_)                  -> 13n
    | Set_expiry(_)              -> 14n
    (* FA2 *)
    | Transfer(_)                -> 15n
    | Update_operators(_)        -> 16n
    | Balance_of(_)              -> 17n
    (* CALLBACKS *)
    | Fa12_balance_callback_1(_) -> 18n
    | Fa2_balance_callback_1(_)  -> 19n
    | Fa12_balance_callback_2(_) -> 20n
    | Fa2_balance_callback_2(_)  -> 21n
    | Flash_swap_callback(_)     -> 22n
    end;

    const lambda_bytes : bytes = case s.dex_core_lambdas[id] of
    | Some(v) -> v
    | None    -> failwith(DexCore.err_unknown_func)
    end;

    const res : return_t = case (Bytes.unpack(lambda_bytes) : option(dex_core_func_t)) of
    | Some(f) -> f(action, s.storage)
    | None    -> failwith(DexCore.err_cant_unpack_lambda)
    end;

    s.storage := res.1;
  } with (res.0, s)

function setup_func(
  const params          : setup_func_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    assert_with_error(params.idx <= dex_core_methods_max_index, DexCore.err_high_func_index);

    case s.dex_core_lambdas[params.idx] of
    | Some(_) -> failwith(DexCore.err_func_set)
    | None    -> s.dex_core_lambdas[params.idx] := params.func_bytes
    end;
  } with ((nil : list(operation)), s)
