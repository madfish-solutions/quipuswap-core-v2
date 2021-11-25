type storage_t          is [@layout:comb] record [
  amt1                    : nat;
  amt2                    : nat;
]

type test_t             is unit

type default_t          is unit

type action_t           is
| Test                    of test_t
| Default                 of default_t

type return_t           is list(operation) * storage_t

function test(
  var s                 : storage_t)
                        : return_t is
  block {
    s.amt1 := Tezos.amount / 1mutez;
  } with ((nil : list(operation)), s)

function default(
  var s                 : storage_t)
                        : return_t is
  block {
    s.amt2 := Tezos.amount / 1mutez;
  } with ((nil : list(operation)), s)

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of
  | Test    -> test(s)
  | Default -> default(s)
  end
