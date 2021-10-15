function invest_tez(
  const s               : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);
  } with ((nil : list(operation)), s)

function divest_tez(
  const params          : divest_tez_t;
  const s               : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    if params.amt > Tezos.balance / 1mutez
    then failwith(TezStore.err_insufficient_tez_balance)
    else skip;
  } with (list [transfer_tez(params.recipient, params.amt)], s)
