function call_dex_core(
  const action          : action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    const id : nat = case action of
    | Launch_exchange(_)       -> 0n
    | Set_admin(_)             -> 1n
    | Confirm_admin(_)         -> 2n
    | Add_managers(_)          -> 3n
    | Set_fees(_)              -> 4n
    | Set_cycle_duration(_)    -> 5n
    | Update_token_metadata(_) -> 6n
    | Ban_bakers(_)            -> 7n
    | Permit(_)                -> 8n
    | Set_expiry(_)            -> 9n
    | Transfer(_)              -> 10n
    | Update_operators(_)      -> 11n
    | Balance_of(_)            -> 12n
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
