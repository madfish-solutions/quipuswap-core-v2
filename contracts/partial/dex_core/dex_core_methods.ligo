function call_dex_core(
  const action          : action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    const id : nat = case action of
    (* DEX *)
    | Launch_exchange(_)       -> 0n
    | Invest_liquidity(_)      -> 1n
    | Divest_liquidity(_)      -> 2n
    | Swap(_)                  -> 3n
    (* ADMIN *)
    | Set_admin(_)             -> 4n
    | Confirm_admin(_)         -> 5n
    | Add_managers(_)          -> 6n
    | Set_fees(_)              -> 7n
    | Set_cycle_duration(_)    -> 8n
    | Update_token_metadata(_) -> 9n
    | Ban(_)                   -> 10n
    (* PERMIT *)
    | Permit(_)                -> 11n
    | Set_expiry(_)            -> 12n
    (* FA2 *)
    | Transfer(_)              -> 13n
    | Update_operators(_)      -> 14n
    | Balance_of(_)            -> 15n
    (* VIEWS *)
    | Get_reserves(_)          -> 16n
    | Get_total_supply(_)      -> 17n
    | Check_is_banned_baker(_) -> 18n
    | Get_swap_min_res(_)      -> 19n
    | Get_toks_per_share(_)    -> 20n
    | Get_cumulative_prices(_) -> 21n
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
