type tez_t              is unit

type fa12_token_t       is address

type fa2_token_t        is [@layout:comb] record [
  token                   : address;
  id                      : nat;
]

type token_t            is
| Tez                     of tez_t
| Fa12                    of fa12_token_t
| Fa2                     of fa2_token_t

type total_supply_req_t is token_id_t

type total_supply_res_t is [@layout:comb] record [
  request                 : total_supply_req_t;
  total_supply            : nat;
]

type receive_fee_t      is [@layout:comb] record [
  token                   : token_t;
  fee                     : nat;
]

type baker_t            is [@layout:comb] record [
  ban_start_time          : timestamp;
  ban_period              : nat;
  votes                   : nat;
]

type user_t             is [@layout:comb] record [
  candidate               : option(key_hash);
  votes                   : nat;
]

type user_reward_info_t is [@layout:comb] record [
  reward_f                : nat;
  reward_paid_f           : nat;
]

type account_t          is [@layout:comb] record [
  allowances              : set(address);
]

type pair_t             is [@layout:comb] record [
  token_a_pool            : nat;
  token_b_pool            : nat;
  token_a_price_cml       : nat;
  token_b_price_cml       : nat;
  total_supply            : nat;
  last_block_timestamp    : timestamp;
  bucket                  : option(address);
]

type setup_func_t       is [@layout:comb] record [
  idx                     : nat;
  func_bytes              : bytes;
]

type default_t          is unit
