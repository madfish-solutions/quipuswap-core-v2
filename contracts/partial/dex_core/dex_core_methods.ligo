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
    | Withdraw_profit(_)         -> 5n
    | Claim_tok_interface_fee(_) -> 6n
    | Claim_tez_interface_fee(_) -> 7n
    (* ADMIN *)
    | Set_admin(_)               -> 8n
    | Confirm_admin(_)           -> 9n
    | Set_flash_swaps_proxy(_)   -> 10n
    | Add_managers(_)            -> 11n
    | Set_fees(_)                -> 12n
    | Set_cycle_duration(_)      -> 13n
    | Update_token_metadata(_)   -> 14n
    | Ban(_)                     -> 15n
    (* PERMIT *)
    | Permit(_)                  -> 16n
    | Set_expiry(_)              -> 17n
    (* FA2 *)
    | Transfer(_)                -> 18n
    | Update_operators(_)        -> 19n
    | Balance_of(_)              -> 20n
    (* CALLBACKS *)
    | Fa12_balance_callback_1(_) -> 21n
    | Fa2_balance_callback_1(_)  -> 22n
    | Fa12_balance_callback_2(_) -> 23n
    | Fa2_balance_callback_2(_)  -> 24n
    | Flash_swap_callback(_)     -> 25n
    | Launch_callback(_)         -> 26n
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
