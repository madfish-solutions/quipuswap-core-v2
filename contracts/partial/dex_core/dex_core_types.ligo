type tez_store_t        is storage_t

type account_t          is [@layout:comb] record [
  allowances              : set(address);
]

type pair_t             is [@layout:comb] record [
  token_a_pool            : nat;
  token_b_pool            : nat;
  total_supply            : nat;
  tez_store               : option(address);
]

type tokens_t           is [@layout:comb] record [
  token_a                 : token_t;
  token_b                 : token_t;
]

type baker_t            is [@layout:comb] record [
  ban_period              : nat;
  ban_start_time          : timestamp;
]

type fees_t             is [@layout:comb] record [
  interface_fee           : nat;
  swap_fee                : nat;
]

type storage_t          is [@layout:comb] record [
  token_metadata          : big_map(token_id_t, token_metadata_t);
  ledger                  : big_map((address * token_id_t), nat);
  accounts                : big_map((address * token_id_t), account_t);
  tokens                  : big_map(token_id_t, tokens_t);
  token_to_id             : big_map(bytes, token_id_t);
  pairs                   : big_map(token_id_t, pair_t);
  permits                 : big_map(address, user_permits_t);
  bakers                  : big_map(key_hash, baker_t);
  referral_tokens         : big_map((token_t * address), nat);
  referral_tez            : big_map((token_id_t * address), nat);
  managers                : set(address);
  fees                    : fees_t;
  admin                   : address;
  pending_admin           : address;
  baker_registry          : address;
  permits_counter         : counter_t;
  default_expiry          : seconds_t;
  cycle_duration          : nat;
  tokens_count            : nat;
]

type launch_exchange_t  is [@layout:comb] record [
  pair                    : tokens_t;
  token_a_in              : nat;
  token_b_in              : nat;
  shares_recipient        : address;
  candidate               : address;
]

type invest_liquidity_t is [@layout:comb] record [
  pair_id                 : nat;
  token_a_in              : nat;
  token_b_in              : nat;
  shares                  : nat;
  shares_recipient        : address;
  candidate               : address;
]

type divest_liquidity_t is [@layout:comb] record [
  pair_id                 : nat;
  min_token_a_out         : nat;
  min_token_b_out         : nat;
  shares                  : nat;
  liquidity_recipient     : address;
  candidate               : address;
]

type swap_side_t        is [@layout:comb] record [
  pool                    : nat;
  token                   : token_t;
]

type swap_data_t        is [@layout:comb] record [
  to_                     : swap_side_t;
  from_                   : swap_side_t;
]

type tmp_swap_t         is [@layout:comb] record [
  s                       : storage_t;
  operation               : option(operation);
  token_in                : token_t;
  receiver                : address;
  amount_in               : nat;
]

type swap_direction_t   is
| A_to_b
| B_to_a

type swap_slice_t       is [@layout:comb] record [
  direction               : swap_direction_t;
  pair_id                 : nat;
]

type swap_t             is [@layout:comb] record [
  swaps                   : list(swap_slice_t);
  receiver                : address;
  referrer                : address;
  amount_in               : nat;
  min_amount_out          : nat;
]

type set_admin_t        is address

type confirm_admin_t    is unit

type add_manager_t      is [@layout:comb] record [
  manager                 : address;
  add                     : bool;
]

type add_managers_t     is list(add_manager_t)

type set_fees_t         is fees_t

type set_cycle_dur_t    is nat

type metadata_pair_t    is [@layout:comb] record [
  key                     : string;
  value                   : bytes;
]

type upd_tok_meta_t     is [@layout:comb] record [
  token_id                : token_id_t;
  token_info              : list(metadata_pair_t);
]

type ban_baker_t        is [@layout:comb] record [
  baker                   : key_hash;
  ban_period              : nat;
]

type ban_bakers_t       is list(ban_baker_t)

type reserves_t         is [@layout:comb] record [
  token_a                 : token_t;
  token_b                 : token_t;
  token_a_pool            : nat;
  token_b_pool            : nat;
]

type reserves_req_t     is token_id_t

type reserves_res_t     is [@layout:comb] record [
  request                 : reserves_req_t;
  reserves                : reserves_t;
]

type get_reserves_t     is [@layout:comb] record [
  requests                : list(reserves_req_t);
  callback                : contract(list(reserves_res_t));
]

type total_supply_req_t is token_id_t

type total_supply_res_t is [@layout:comb] record [
  request                 : total_supply_req_t;
  total_supply            : nat;
]

type get_total_supply_t is [@layout:comb] record [
  requests                : list(total_supply_req_t);
  callback                : contract(list(total_supply_res_t));
]

type default_t          is unit

type action_t           is
(* DEX *)
| Launch_exchange         of launch_exchange_t
| Invest_liquidity        of invest_liquidity_t
| Divest_liquidity        of divest_liquidity_t
| Swap                    of swap_t
(* ADMIN *)
| Set_admin               of set_admin_t
| Confirm_admin           of confirm_admin_t
| Add_managers            of add_managers_t
| Set_fees                of set_fees_t
| Set_cycle_duration      of set_cycle_dur_t
| Update_token_metadata   of upd_tok_meta_t
| Ban_bakers              of ban_bakers_t
(* PERMIT *)
| Permit                  of permit_t
| Set_expiry              of set_expiry_t
(* FA2 *)
| Transfer                of transfers_t
| Update_operators        of update_operators_t
| Balance_of              of balance_of_t
(* VIEWS *)
| Get_reserves            of get_reserves_t
| Get_total_supply        of get_total_supply_t

type return_t           is list(operation) * storage_t

type setup_func_t       is [@layout:comb] record [
  idx                     : nat;
  func_bytes              : bytes;
]

type dex_core_func_t    is (action_t * storage_t) -> return_t

type full_storage_t     is [@layout:comb] record [
  storage                 : storage_t;
  dex_core_lambdas        : big_map(nat, bytes);
  metadata                : big_map(string, bytes);
]

type full_return_t      is list(operation) * full_storage_t

type full_action_t      is
| Use                     of action_t
| Setup_func              of setup_func_t
| Default                 of default_t

type deploy_tez_store_t is (option(key_hash) * tez * tez_store_t) -> (operation * address)

[@inline] const dex_core_methods_max_index : nat = 17n;
