function change_owner (
  const param           : address;
  var s                 : storage_t)
                        : return_t is
  block {
    only_admin(s.owner);
    s.owner := param;
  } with ((nil : list(operation)), s)

function receive_fee (
  const param           : receive_fee_t;
  var s                 : storage_t)
                        : return_t is
  block {
    if (Tezos.sender =/= s.dex)
    then failwith(Common.err_not_dex_core)
    else skip;
    s.fees[param.token] := unwrap_or(s.fees[param.token], 0n) + param.fee;
  } with ((nil : list(operation)), s)

function claim_fee (
  const params          : claim_fee_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_admin(s.owner);
    const fee_balance : nat = unwrap(s.fees[params.token], AuctionMock.err_unknown_token);
    var operations : list(operation) := list[
      transfer_token(
        Tezos.self_address,
        params.recipient,
        params.fee,
        params.token
      );
    ];

    if Tezos.balance > 0mutez
    then operations := transfer_token(
        Tezos.self_address,
        params.recipient,
        Tezos.balance / 1mutez,
        Tez(unit)
      ) # operations
    else skip;

    s.fees[params.token] := get_nat_or_fail(fee_balance - params.fee);

} with (operations, s)
