type storage_t          is [@layout:comb] record [
  dex_core                : address;
]

type default_t          is unit -> list(operation)

type action_t           is
| Dafault                 of default_t

type return_t           is list(operation) * storage_t
