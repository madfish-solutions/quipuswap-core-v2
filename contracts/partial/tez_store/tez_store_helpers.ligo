function only_dex_core(
  const dex_core        : address)
                        : unit is
  block {
    if Tezos.sender =/= dex_core
    then failwith(TezStore.err_not_dex_core)
    else skip;
  } with unit

[@inline] function get_tez_balance(
  const user_addr       : address;
  const ledger          : big_map(address, nat))
                        : nat is
  case ledger[user_addr] of
  | None      -> 0n
  | Some(bal) -> bal
  end
