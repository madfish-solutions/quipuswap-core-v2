function change_owner(
  const new_address     : address;
  var s                 : storage_t)
                        : return_t is
  block {
    only_admin(s.owner);
    s.pending_owner := Some(new_address);
  } with ((nil : list(operation)), s)

function confirm_owner(
  var s                 : storage_t)
                        : return_t is
  block {
    const pending = unwrap(s.pending_owner, Common.err_not_pending_admin);
    if (Tezos.sender =/= pending)
    then failwith(Common.err_not_dex_core)
    else skip;

    s.owner := pending;
    s.pending_owner := (None : option(address));
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

    s.fees[params.token] := get_nat_or_fail(fee_balance - params.fee);

} with (operations, s)

function withdraw_extra_xtz(
  const recipient       : address;
  const s               : storage_t)
                        : return_t is
  block {
    only_admin(s.owner);
    const extra_amt = get_nat_or_fail(Tezos.balance / 1mutez - unwrap_or(s.fees[Tez(unit)], 0n));
    const operations = list[
        transfer_token(
          Tezos.self_address,
          recipient,
          extra_amt,
          Tez(unit)
        )
      ];
  } with (operations, s)

function set_delegate(
  const baker           : option(key_hash);
  var s                 : storage_t)
                        : return_t is
  block {
    only_admin(s.owner);

    const operations = list[Tezos.set_delegate(baker)];
  } with (operations, s)