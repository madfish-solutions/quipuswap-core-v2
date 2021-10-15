function only_dex_core(
  const dex_core        : address)
                        : unit is
  block {
    if Tezos.sender =/= dex_core
    then failwith(TezStore.err_not_dex_core)
    else skip;
  } with unit
