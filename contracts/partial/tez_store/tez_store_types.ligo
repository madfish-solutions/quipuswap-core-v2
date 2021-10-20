type vote_info_t        is [@layout:comb] record [
  candidate               : option(key_hash);
  last_veto               : timestamp;
  veto                    : nat;
  vote                    : nat;
]

type baker_t            is [@layout:comb] record [
  votes                   : nat;
  ban_period              : nat;
  ban_start_time          : timestamp;
]

type storage_t          is [@layout:comb] record [
  ledger                  : big_map(address, nat);
  voters                  : big_map(address, vote_info_t);
  bakers                  : big_map(key_hash, baker_t);
  current_delegated       : option(key_hash);
  next_candidate          : option(key_hash);
  baker_registry          : address;
  dex_core                : address;
  total_votes             : nat;
]

type invest_tez_t       is address

type divest_tez_t       is [@layout:comb] record [
  recipient               : contract(unit);
  user                    : address;
  amt                     : nat;
]

type ban_baker_t        is [@layout:comb] record [
  baker                   : key_hash;
  ban_period              : nat;
]

type vote_t             is [@layout:comb] record [
  candidate               : address;
  votes                   : nat;
  cycle_duration          : nat;
]

type action_t           is
| Invest_tez              of invest_tez_t
| Divest_tez              of divest_tez_t
| Ban_baker               of ban_baker_t
| Vote                    of vote_t

type return_t           is list(operation) * storage_t
