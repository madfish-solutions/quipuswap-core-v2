type bucket_t           is storage_t

type tokens_t           is [@layout:comb] record [
  token_a                 : token_t;
  token_b                 : token_t;
]

type flash_swap_callback_t is [@layout:comb] record [
  pair_id                 : token_id_t;
  prev_tez_balance        : nat;
  amount_in               : nat;
]

type fees_t             is [@layout:comb] record [
  interface_fee           : nat;
  swap_fee                : nat;
  auction_fee             : nat;
  withdraw_fee_reward     : nat;
]

type storage_t          is [@layout:comb] record [
  token_metadata          : big_map(token_id_t, token_metadata_t);
  ledger                  : big_map((address * token_id_t), nat);
  accounts                : big_map((address * token_id_t), account_t);
  tokens                  : big_map(token_id_t, tokens_t);
  token_to_id             : big_map(bytes, token_id_t);
  pairs                   : big_map(token_id_t, pair_t);
  permits                 : big_map(address, user_permits_t);
  interface_fee           : big_map((token_t * address), nat);
  interface_tez_fee       : big_map((token_id_t * address), nat);
  auction_fee             : big_map(token_t, nat);
  auction_tez_fee         : big_map(token_id_t, nat);
  managers                : set(address);
  fees                    : fees_t;
  admin                   : address;
  pending_admin           : option(address);
  baker_registry          : address;
  flash_swaps_proxy       : address;
  auction                 : address;
  permits_counter         : counter_t;
  default_expiry          : seconds_t;
  entered                 : bool;
  tokens_count            : nat;
  collecting_period       : nat;
]

type launch_exchange_t  is [@layout:comb] record [
  pair                    : tokens_t;
  token_a_in              : nat;
  token_b_in              : nat;
  shares_receiver         : address;
  candidate               : key_hash;
  deadline                : timestamp;
]

type launch_callback_t  is [@layout:comb] record [
  vote_params             : vote_t;
  bucket                  : address;
]

type invest_liquidity_t is [@layout:comb] record [
  pair_id                 : token_id_t;
  token_a_in              : nat;
  token_b_in              : nat;
  shares                  : nat;
  shares_receiver         : address;
  candidate               : key_hash;
  deadline                : timestamp;
]

type divest_liquidity_t is [@layout:comb] record [
  pair_id                 : token_id_t;
  min_token_a_out         : nat;
  min_token_b_out         : nat;
  shares                  : nat;
  liquidity_receiver      : address;
  candidate               : key_hash;
  deadline                : timestamp;
]

type swap_side_t        is [@layout:comb] record [
  pool                    : nat;
  token                   : token_t;
]

type swap_data_t        is [@layout:comb] record [
  to_                     : swap_side_t;
  from_                   : swap_side_t;
]

type forward_t          is [@layout:comb] record [
  from_bucket             : address;
  to_bucket               : address;
  amt                     : nat;
]

type tmp_swap_t         is [@layout:comb] record [
  s                       : storage_t;
  forwards                : list(forward_t);
  last_operation          : option(operation);
  token_in                : token_t;
  receiver                : address;
  referrer                : address;
  from_bucket             : address;
  amount_in               : nat;
  swaps_list_size         : nat;
  counter                 : nat;
]

type swap_direction_t   is
| A_to_b
| B_to_a

type swap_slice_t       is [@layout:comb] record [
  direction               : swap_direction_t;
  pair_id                 : token_id_t;
]

type swap_t             is [@layout:comb] record [
  lambda                  : option(unit -> list(operation));
  swaps                   : list(swap_slice_t);
  deadline                : timestamp;
  receiver                : address;
  referrer                : address;
  amount_in               : nat;
  min_amount_out          : nat;
]

type withdraw_profit_t  is [@layout:comb] record [
  receiver                : contract(unit);
  pair_id                 : token_id_t;
]

type claim_fee_t        is [@layout:comb] record [
  token                   : token_t;
  receiver                : address;
]

type claim_tez_fee_t    is [@layout:comb] record [
  pair_id                 : token_id_t;
  receiver                : address;
]

type withdraw_fee_t     is [@layout:comb] record [
  pair_id                 : option(token_id_t);
  token                   : token_t;
]

type dex_vote_t         is [@layout:comb] record [
  pair_id                 : token_id_t;
  candidate               : key_hash;
]

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

type close_t            is unit

type default_t          is unit

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
  token_a_price_cml       : nat;
  token_b_price_cml       : nat;
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
| Swap                    of swap_t
| Withdraw_profit         of withdraw_profit_t
| Claim_interface_fee     of claim_fee_t
| Claim_interface_tez_fee of claim_tez_fee_t
| Withdraw_auction_fee    of withdraw_fee_t
| Vote                    of dex_vote_t
(* ADMIN *)
| Set_admin               of set_admin_t
| Confirm_admin           of confirm_admin_t
| Set_flash_swaps_proxy   of set_swaps_proxy_t
| Set_auction             of set_aution_t
| Add_managers            of add_managers_t
| Set_fees                of set_fees_t
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
| Launch_callback         of launch_callback_t
| Flash_swap_callback     of flash_swap_callback_t
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
| Default                 of default_t

type deploy_bucket_t    is (option(key_hash) * tez * bucket_t) -> (operation * address)

const dex_core_methods_max_index : nat = 25n;
