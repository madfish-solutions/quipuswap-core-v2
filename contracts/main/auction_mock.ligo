#include "../partial/errors.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"

// #include "../partial/utils.ligo"

#include "../partial/common_helpers.ligo"

type receive_fee_t      is [@layout:comb] record [
  token                   : token_t;
  fee                     : nat;
]

type claim_fee_t        is [@layout:comb] record [
  token                   : token_t;
  fee                     : nat;
  recipient               : address;
]

type storage_t          is [@layout:comb] record [
  owner                   : address;
  dex                     : address;
  fees                    : big_map (token_t, nat);
]

type action_t           is
| Change_owner            of address
| Default                 of unit
| Receive_fee             of receive_fee_t
| Claim_fee               of claim_fee_t
| Claim_xtz_fee           of address

type return_t           is list(operation) * storage_t

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
    then failwith("NOT_DEX")
    else skip;
    s.fees[param.token] := param.fee;
  } with ((nil : list(operation)), s)

function claim_fee (
  const params          : claim_fee_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_admin(s.owner);
    const fee_balance : nat = unwrap(s.fees[params.token], "UNKNOWN_TOKEN");
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
        (Tezos.get_contract_with_error(recipient, "NOT_IMPLICT_ACCOUNT") : contract(unit))
    );

  } with (list[op], s)


function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of [
  | Change_owner(param)  -> change_owner(param, s)
  | Default(param)       -> ((nil : list(operation)), s)
  | Receive_fee(param)   -> receive_fee(param, s)
  | Claim_fee(param)     -> claim_fee(param, s)
  | Claim_xtz_fee(param) -> claim_xtz_fee(param, s)
  ]

