type tez_store_t        is storage_t

type tokens_t           is [@layout:comb] record [
  token_a                 : token_t;
  token_b                 : token_t;
]

type fees_t             is [@layout:comb] record [
  interface_fee           : nat;
  swap_fee                : nat;
  auction_fee             : nat;
  withdraw_fee_reward     : nat;
]

type flash_swap_t       is [@layout:comb] record [
  lambda                  : unit -> list(operation);
  pair_id                 : token_id_t;
  receiver                : address;
  referrer                : address;
  amount_a_out            : nat;
  amount_b_out            : nat;
]

type flash_swap_2_t     is unit

type flash_swap_3_t     is unit

type storage_t          is [@layout:comb] record [
  token_metadata          : big_map(token_id_t, token_metadata_t);
  ledger                  : big_map((address * token_id_t), nat);
  accounts                : big_map((address * token_id_t), account_t);
  tokens                  : big_map(token_id_t, tokens_t);
  token_to_id             : big_map(bytes, token_id_t);
  pairs                   : big_map(token_id_t, pair_t);
  permits                 : big_map(address, user_permits_t);
  tok_interface_fee       : big_map((token_t * address), nat);
  tez_interface_fee       : big_map((token_id_t * address), nat);
  auction_fee             : big_map(token_t, nat);
  managers                : set(address);
  fees                    : fees_t;
  tmp                     : tmp_t;
  admin                   : address;
  pending_admin           : address;
  baker_registry          : address;
  flash_swaps_proxy       : address;
  auction                 : address;
  permits_counter         : counter_t;
  default_expiry          : seconds_t;
  entered                 : bool;
  tokens_count            : nat;
  cycle_duration          : nat;
  collecting_period       : nat;
  voting_period           : nat;
]

type launch_exchange_t  is [@layout:comb] record [
  pair                    : tokens_t;
  token_a_in              : nat;
  token_b_in              : nat;
  shares_receiver         : address;
  candidate               : key_hash;
]

type launch_callback_t  is [@layout:comb] record [
  vote_params             : vote_t;
  tez_store               : address;
]

type invest_liquidity_t is [@layout:comb] record [
  pair_id                 : token_id_t;
  token_a_in              : nat;
  token_b_in              : nat;
  shares                  : nat;
  shares_receiver         : address;
  candidate               : key_hash;
]

type divest_liquidity_t is [@layout:comb] record [
  pair_id                 : token_id_t;
  min_token_a_out         : nat;
  min_token_b_out         : nat;
  shares                  : nat;
  liquidity_receiver      : address;
  candidate               : key_hash;
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
  referrer                : address;
  amount_in               : nat;
]

type swap_direction_t   is
| A_to_b
| B_to_a

type swap_slice_t       is [@layout:comb] record [
  direction               : swap_direction_t;
  pair_id                 : token_id_t;
]

type swap_t             is [@layout:comb] record [
  swaps                   : list(swap_slice_t);
  receiver                : address;
  referrer                : address;
  amount_in               : nat;
  min_amount_out          : nat;
]

type withdraw_profit_t  is [@layout:comb] record [
  receiver                : contract(unit);
  pair_id                 : token_id_t;
]

type claim_tok_fee_t    is [@layout:comb] record [
  token                   : token_t;
  receiver                : address;
  amount                  : nat;
]

type claim_tez_fee_t    is [@layout:comb] record [
  pair_id                 : token_id_t;
  receiver                : address;
  amount                  : nat;
]

type withdraw_fee_t     is token_t

type set_admin_t        is address

type confirm_admin_t    is unit

type set_swaps_proxy_t  is address

type set_aution_t       is address

type add_manager_t      is [@layout:comb] record [
  manager                 : address;
  add                     : bool;
]

type add_managers_t     is list(add_manager_t)

type set_fees_t         is fees_t

type set_cycle_dur_t    is nat

type set_vote_period_t  is nat

type set_coll_period_t  is nat

type metadata_pair_t    is [@layout:comb] record [
  key                     : string;
  value                   : bytes;
]

type upd_tok_meta_t     is [@layout:comb] record [
  token_id                : token_id_t;
  token_info              : list(metadata_pair_t);
]

type ban_t              is [@layout:comb] record [
  pair_id                 : token_id_t;
  ban_params              : ban_baker_t;
]

type fa12_balance_res_t is nat

type fa2_balance_res_t  is list(balance_response_t)

type close_t            is unit

type reserves_t         is [@layout:comb] record [
  token_a_pool            : nat;
  token_b_pool            : nat;
]

type reserves_req_t     is token_id_t

type reserves_res_t     is [@layout:comb] record [
  request                 : reserves_req_t;
  reserves                : reserves_t;
]

type get_swap_min_res_t is [@layout:comb] record [
  swaps                   : list(swap_slice_t);
  amount_in               : nat;
]

type toks_per_shr_t     is [@layout:comb] record [
  token_a_amt             : nat;
  token_b_amt             : nat;
]

type toks_per_shr_req_t is [@layout:comb] record [
  pair_id                 : token_id_t;
  shares_amt              : nat;
]

type toks_per_shr_res_t is [@layout:comb] record [
  request                 : toks_per_shr_req_t;
  tokens_per_share        : toks_per_shr_t;
]

type cum_prices_t       is [@layout:comb] record [
  last_block_timestamp    : timestamp;
  token_a_price_cum       : nat;
  token_b_price_cum       : nat;
]

type cum_prices_req_t   is token_id_t

type cum_prices_res_t   is [@layout:comb] record [
  request                 : cum_prices_req_t;
  cumulative_prices       : cum_prices_t;
]

type check_is_banned_t  is [@layout:comb] record [
  pair_id                 : token_id_t;
  baker                   : is_banned_baker_t;
]

type action_t           is
(* DEX *)
| Launch_exchange         of launch_exchange_t
| Invest_liquidity        of invest_liquidity_t
| Divest_liquidity        of divest_liquidity_t
| Flash_swap              of flash_swap_t
| Swap                    of swap_t
| Withdraw_profit         of withdraw_profit_t
| Claim_tok_interface_fee of claim_tok_fee_t
| Claim_tez_interface_fee of claim_tez_fee_t
| Withdraw_auction_fee    of withdraw_fee_t
(* ADMIN *)
| Set_admin               of set_admin_t
| Confirm_admin           of confirm_admin_t
| Set_flash_swaps_proxy   of set_swaps_proxy_t
| Set_auction             of set_aution_t
| Add_managers            of add_managers_t
| Set_fees                of set_fees_t
| Set_cycle_duration      of set_cycle_dur_t
| Set_voting_period       of set_vote_period_t
| Set_collecting_period   of set_coll_period_t
| Update_token_metadata   of upd_tok_meta_t
| Ban                     of ban_t
(* PERMIT *)
| Permit                  of permit_t
| Set_expiry              of set_expiry_t
(* FA2 *)
| Transfer                of transfers_t
| Update_operators        of update_operators_t
| Balance_of              of balance_of_t
(* CALLBACKS *)
| Fa12_balance_callback_1 of fa12_balance_res_t
| Fa2_balance_callback_1  of fa2_balance_res_t
| Fa12_balance_callback_2 of fa12_balance_res_t
| Fa2_balance_callback_2  of fa2_balance_res_t
| Flash_swap_callback_1   of flash_swap_2_t
| Flash_swap_callback_2   of flash_swap_3_t
| Launch_callback         of launch_callback_t
| Close                   of close_t

type return_t           is list(operation) * storage_t

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

type deploy_tez_store_t is (option(key_hash) * tez * tez_store_t) -> (operation * address)

const dex_core_methods_max_index : nat = 32n;
