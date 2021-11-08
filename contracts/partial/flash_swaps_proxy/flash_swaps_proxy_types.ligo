type storage_t          is [@layout:comb] record [
  dex_core                : address;
]

type quipu_v2_call_t    is unit -> list(operation)

type action_t           is
| Quipuswap_v2_call       of quipu_v2_call_t

type return_t           is list(operation) * storage_t
