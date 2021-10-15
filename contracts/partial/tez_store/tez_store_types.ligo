type storage_t          is [@layout:comb] record [
  dex_core                : address;
]

type invest_tez_t       is unit

type divest_tez_t       is [@layout:comb] record [
  recipient               : address;
  amt                     : nat;
]

type action_t           is
| Invest_tez              of invest_tez_t
| Divest_tez              of divest_tez_t

type return_t           is list(operation) * storage_t
