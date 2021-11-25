#include "../partial/errors.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"
#include "../partial/common_helpers.ligo"

[@inline] const fee_amt : nat = 10n;

type storage_t          is [@layout:comb] record [
  dex_core                : address;
]

type test_t             is [@layout:comb] record [
  token1                  : token_t;
  token2                  : token_t;
  token1_amt              : nat;
  token2_amt              : nat;
]

type action_t           is
| Test                    of test_t

type return_t           is list(operation) * storage_t

function test(
  const params          : test_t;
  const s               : storage_t)
                        : return_t is
  block {
   const ops : list(operation) = list [
      transfer_token(Tezos.self_address, s.dex_core, params.token1_amt + fee_amt, params.token1);
      transfer_token(Tezos.self_address, s.dex_core, params.token2_amt + fee_amt, params.token2);
   ];
  } with (ops, s)

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of
  | Test(params) -> test(params, s)
  end
