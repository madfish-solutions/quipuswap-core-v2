#include "../partial/errors.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"
#include "../partial/common_helpers.ligo"

type storage_t          is [@layout:comb] record [
  dex_core                : address;
  val                     : nat;
]

type action_t           is
| Default                 of nat

type return_t           is list(operation) * storage_t

function default(
  const val             : nat;
  var s                 : storage_t)
                        : return_t is
  block {
    s.val := val;

    const op : operation = transfer_tez((get_contract(s.dex_core) : contract(unit)), 2000n);
  } with (list [op], s)

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of
  | Default(val) -> default(val, s)
  end
