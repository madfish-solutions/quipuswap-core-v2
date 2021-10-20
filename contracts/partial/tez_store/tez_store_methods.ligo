function invest_tez(
  const user            : invest_tez_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    s.ledger[user] := get_tez_balance(user, s.ledger) + Tezos.amount / 1mutez;
  } with ((nil : list(operation)), s)

function divest_tez(
  const params          : divest_tez_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    const user_balance : nat = get_tez_balance(params.user, s.ledger);

    if params.amt > Tezos.balance / 1mutez or params.amt > user_balance
    then failwith(TezStore.err_insufficient_tez_balance)
    else skip;

    s.ledger[params.user] := abs(user_balance - params.amt);
  } with (list [transfer_tez(params.recipient, params.amt)], s)

function ban_baker(
  const params         : ban_baker_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    var baker : baker_t := get_baker(params.baker, s.bakers);

    baker.ban_period := params.ban_period;
    baker.ban_start_time := Tezos.now;

    s.bakers[params.baker] := baker;
  } with ((nil : list(operation)), s)

function vote(
  const _params         : vote_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);
  } with ((nil : list(operation)), s)
