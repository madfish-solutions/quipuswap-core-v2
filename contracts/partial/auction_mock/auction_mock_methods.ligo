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
    s.fees[param.token] := param.fee;
  } with ((nil : list(operation)), s)

function claim_fee (
  const params          : claim_fee_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_admin(s.owner);
    const fee_balance : nat = unwrap(s.fees[params.token], AuctionMock.err_unknown_token);
    const op = transfer_token(
        Tezos.self_address,
        params.recipient,
        params.fee,
        params.token
    );
    s.fees[params.token] := get_nat_or_fail(fee_balance - params.fee);

} with (list[op], s)

function claim_xtz_fee(
  const recipient       : address;
  const s               : storage_t)
                        : return_t is
  block {
    only_admin(s.owner);
    const op = Tezos.transaction(
        unit,
        Tezos.balance,
        (Tezos.get_contract_with_error(recipient, Common.err_contract_404) : contract(unit))
    );

  } with (list[op], s)
