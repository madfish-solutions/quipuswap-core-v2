function call_dex_core(
  const action          : action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    const id : nat = case action of [
    (* DEX *)
    | Launch_exchange(_)         -> 0n
    | Invest_liquidity(_)        -> 1n
    | Divest_liquidity(_)        -> 2n
    | Flash_swap(_)              -> 3n
    | Swap(_)                    -> 4n
    | Withdraw_profit(_)         -> 5n
    | Claim_interface_fee(_)     -> 6n
    | Claim_interface_tez_fee(_) -> 7n
    | Withdraw_auction_fee(_)    -> 8n
    | Vote(_)                    -> 9n
    (* ADMIN *)
    | Set_admin(_)               -> 10n
    | Confirm_admin(_)           -> 11n
    | Set_flash_swaps_proxy(_)   -> 12n
    | Set_auction(_)             -> 13n
    | Add_managers(_)            -> 14n
    | Set_fees(_)                -> 15n
    | Set_collecting_period(_)   -> 16n
    | Update_token_metadata(_)   -> 17n
    | Ban(_)                     -> 18n
    (* PERMIT *)
    | Permit(_)                  -> 19n
    | Set_expiry(_)              -> 20n
    (* FA2 *)
    | Transfer(_)                -> 21n
    | Update_operators(_)        -> 22n
    | Balance_of(_)              -> 23n
    (* CALLBACKS *)
    | Launch_callback(_)         -> 24n
    | Flash_swap_callback(_)     -> 25n
    | Close(_)                   -> 26n
    ];

    const lambda_bytes : bytes = unwrap(s.dex_core_lambdas[id], DexCore.err_unknown_func);

    const res : return_t = case (Bytes.unpack(lambda_bytes) : option(dex_core_func_t)) of [
    | Some(f) -> f(action, s.storage)
    | None    -> failwith(DexCore.err_cant_unpack_lambda)
    ];

    s.storage := res.1;
  } with (res.0, s)

function setup_func(
  const params          : setup_func_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    only_admin(s.storage.admin);

    assert_with_error(params.idx <= dex_core_methods_max_index, DexCore.err_high_func_index);

    case s.dex_core_lambdas[params.idx] of [
    | Some(_) -> failwith(DexCore.err_func_set)
    | None    -> s.dex_core_lambdas[params.idx] := params.func_bytes
    ];
  } with ((nil : list(operation)), s)

function default(
  const s               : full_storage_t)
                        : full_return_t is
  block {
    skip;
  } with ((nil : list(operation)), s)
