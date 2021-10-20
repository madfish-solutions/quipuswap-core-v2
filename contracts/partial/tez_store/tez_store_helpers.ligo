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

[@inline] function get_baker(
  const baker           : key_hash;
  const bakers          : big_map(key_hash, baker_t))
                        : baker_t is
  case bakers[baker] of
  | None          -> record [
    votes          = 0n;
    ban_period     = 0n;
    ban_start_time = (0 : timestamp);
  ]
  | Some(baker) -> baker
  end
