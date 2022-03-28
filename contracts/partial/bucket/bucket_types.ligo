type storage_t          is [@layout:comb] record [
  users                   : big_map(address, user_t);
  bakers                  : big_map(key_hash, baker_t);
  users_rewards           : big_map(address, user_reward_info_t);
  previous_delegated      : key_hash;
  current_delegated       : key_hash;
  next_candidate          : key_hash;
  baker_registry          : address;
  dex_core                : address;
  pair_id                 : token_id_t;
  next_reward             : nat;
  total_reward            : nat;
  reward_paid             : nat;
  reward_per_share        : nat;
  reward_per_block        : nat;
  last_update_level       : nat;
  collecting_period_end   : nat;
  voting_period_end       : nat;
]

type fill_t             is unit

type pour_out_t         is [@layout:comb] record [
  receiver                : contract(unit);
  amt                     : nat;
]

type withdraw_rewards_t is [@layout:comb] record [
  receiver                : contract(unit);
  user                    : address;
  current_balance         : nat;
  new_balance             : nat;
]

type ban_baker_t        is [@layout:comb] record [
  baker                   : key_hash;
  ban_period              : nat;
]

type vote_t             is [@layout:comb] record [
  voter                   : address;
  candidate               : key_hash;
  execute_voting          : bool;
  votes                   : nat;
  current_balance         : nat;
]

type is_banned_baker_t  is key_hash

type return_t           is list(operation) * storage_t
