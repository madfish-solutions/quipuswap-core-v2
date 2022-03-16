#include "../partial/errors.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"
#include "../partial/common_helpers.ligo"

const fee_amt : nat = 10n;

type storage_t          is [@layout:comb] record [
  dex_core                : address;
]

type default_t          is [@layout:comb] record [
  token                   : token_t;
  token_amt               : nat;
]

type action_t           is
| Default                 of default_t

type return_t           is list(operation) * storage_t

function default(
  const params          : default_t;
  const s               : storage_t)
                        : return_t is
  block {
    const ops : list(operation) = list [
      transfer_token(Tezos.self_address, s.dex_core, params.token_amt + fee_amt, params.token);
    ];
  } with (ops, s)

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of
  | Default(params) -> default(params, s)
  end
