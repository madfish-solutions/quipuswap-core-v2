function call_dex_core(
  const action          : action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    const id : nat = case action of
    | Launch_exchange(_)       -> 0n
    | Invest_liquidity(_)      -> 1n
    | Divest_liquidity(_)      -> 2n
    | Set_admin(_)             -> 3n
    | Confirm_admin(_)         -> 4n
    | Add_managers(_)          -> 5n
    | Set_fees(_)              -> 6n
    | Set_cycle_duration(_)    -> 7n
    | Update_token_metadata(_) -> 8n
    | Ban_bakers(_)            -> 9n
    | Permit(_)                -> 10n
    | Set_expiry(_)            -> 11n
    | Transfer(_)              -> 12n
    | Update_operators(_)      -> 13n
    | Balance_of(_)            -> 14n
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
    if params.idx >= dex_core_methods_max_index
    then failwith(DexCore.err_high_func_index)
    else skip;

    case s.dex_core_lambdas[params.idx] of
    | Some(_) -> failwith(DexCore.err_func_set)
    | None    -> s.dex_core_lambdas[params.idx] := params.func_bytes
    end;
  } with ((nil : list(operation)), s)
