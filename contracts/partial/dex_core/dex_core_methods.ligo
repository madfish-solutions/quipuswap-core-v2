function call_dex_core(
  const action          : action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    const id : nat = case action of
    | Set_admin(_)             -> 0n
    | Confirm_admin(_)         -> 1n
    | Add_managers(_)          -> 2n
    | Set_fees(_)              -> 3n
    | Set_cycle_duration(_)    -> 4n
    | Update_token_metadata(_) -> 5n
    end;

    const lambda_bytes : bytes = case s.dex_core_lambdas[id] of
    | Some(v) -> v
    | None    -> failwith("DexCore/func-not-set")
    end;

    const res : return_t = case (Bytes.unpack(lambda_bytes) : option(dex_core_func_t)) of
    | Some(f) -> f(action, s.storage)
    | None    -> failwith("DexCore/cant-unpack-lambda")
    end;

    s.storage := res.1;
  } with (res.0, s)

function setup_func(
  const params          : setup_func_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    if params.idx > dex_core_methods_max_index
    then failwith("DexCore/wrong-index")
    else skip;

    case s.dex_core_lambdas[params.idx] of
    | Some(_) -> failwith("DexCore/func-set")
    | None    -> s.dex_core_lambdas[params.idx] := params.func_bytes
    end;
  } with (no_operations, s)
