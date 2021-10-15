type vote_info_t        is [@layout:comb] record [
  candidate               : option(key_hash);
  last_veto               : timestamp;
  veto                    : nat;
  vote                    : nat;
]

type storage_t          is [@layout:comb] record [
  voters                  : big_map(address, vote_info_t);
  vetos                   : big_map(key_hash, timestamp);
  votes                   : big_map(key_hash, nat);
  current_delegated       : option(key_hash);
  next_candidate          : option(key_hash);
  last_veto               : timestamp;
  dex_core                : address;
  veto                    : nat;
  total_votes             : nat;
]

type invest_tez_t       is unit

type divest_tez_t       is [@layout:comb] record [
  recipient               : contract(unit);
  amt                     : nat;
]

type action_t           is
| Invest_tez              of invest_tez_t
| Divest_tez              of divest_tez_t

type return_t           is list(operation) * storage_t
