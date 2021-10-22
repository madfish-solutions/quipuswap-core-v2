type voter_t            is [@layout:comb] record [
  candidate               : option(key_hash);
  tez_bal                 : nat;
  votes                   : nat;
]

type baker_t            is [@layout:comb] record [
  ban_start_time          : timestamp;
  ban_period              : nat;
  votes                   : nat;
]

type storage_t          is [@layout:comb] record [
  voters                  : big_map(address, voter_t);
  bakers                  : big_map(key_hash, baker_t);
  current_delegated       : key_hash;
  next_candidate          : key_hash;
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
  voter                   : address;
  candidate               : key_hash;
  votes                   : nat;
  cycle_duration          : nat;
]

type is_banned_baker_t  is [@layout:comb] record [
  baker                   : key_hash;
  callback                : contract(bool);
]

type action_t           is
| Invest_tez              of invest_tez_t
| Divest_tez              of divest_tez_t
| Ban_baker               of ban_baker_t
| Vote                    of vote_t
| Is_banned_baker         of is_banned_baker_t

type return_t           is list(operation) * storage_t
