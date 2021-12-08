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
  tez_bal                 : nat;
  votes                   : nat;
]

type user_reward_info_t is [@layout:comb] record [
  reward                  : nat;
  reward_paid             : nat;
]

type account_t          is [@layout:comb] record [
  allowances              : set(address);
]

type tmp_t              is [@layout:comb] record [
  pair_id                 : token_id_t;
  amount_a_out            : nat;
  amount_b_out            : nat;
  referrer                : address;
  token_a_balance_1       : nat;
  token_b_balance_1       : nat;
  token_a_balance_2       : nat;
  token_b_balance_2       : nat;
]

type pair_t             is [@layout:comb] record [
  token_a_pool            : nat;
  token_b_pool            : nat;
  token_a_price_cum       : nat;
  token_b_price_cum       : nat;
  total_supply            : nat;
  tez_store               : option(address);
]

type setup_func_t       is [@layout:comb] record [
  idx                     : nat;
  func_bytes              : bytes;
]
