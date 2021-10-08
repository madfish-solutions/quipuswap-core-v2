type default_t          is unit

type storage_t          is [@layout:comb] record [
  test                    : nat;
]

type action_t           is
| Test                    of unit

type return_t           is list(operation) * storage_t

type setup_func_t       is [@layout:comb] record [
  idx                     : nat;
  func_bytes              : bytes;
]

type dex_core_func_t    is (action_t * storage_t) -> return_t

type full_storage_t     is [@layout:comb] record [
  storage                 : storage_t;
  dex_core_lambdas        : big_map(nat, bytes);
]

type full_return_t      is list(operation) * full_storage_t

type full_action_t      is
| Use                     of action_t
| Setup_func              of setup_func_t
| Default                 of default_t

[@inline] const dex_core_methods_max_index : nat = 1n;
