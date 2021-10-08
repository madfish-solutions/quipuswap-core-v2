type storage_t          is [@layout:comb] record [
  a                       : nat;
]

type action_t           is
| Test                    of unit

type return_t           is list(operation) * storage_t
