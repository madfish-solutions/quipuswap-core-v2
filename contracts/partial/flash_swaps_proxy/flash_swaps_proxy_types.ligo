type storage_t          is [@layout:comb] record [
  dex_core                : address;
]

type call_t             is unit -> list(operation)

type action_t           is
| Call                    of call_t

type return_t           is list(operation) * storage_t
