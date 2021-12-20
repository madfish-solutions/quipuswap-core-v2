type status_auction_t   is
| Active                  of unit
| Finished                of unit

type auction_t          is [@layout:comb] record [
  status                  : status_auction_t;
  token                   : token_t;
  start_time              : timestamp;
  current_bidder          : address;
  current_bid             : nat;
  amt                     : nat;
]

type fees_t             is [@layout:comb] record [
  dev_fee_f               : nat;
  bid_fee_f               : nat;
]

type storage_t          is [@layout:comb] record [
  auctions                : big_map(nat, auction_t);
  dev_fee_balances_f      : big_map(token_t, nat);
  public_fee_balances_f   : big_map(token_t, nat);
  whitelist               : set(token_t);
  fees                    : fees_t;
  baker                   : key_hash;
  admin                   : address;
  pending_admin           : address;
  dex_core                : address;
  quipu_token             : address;
  quipu_token_id          : nat;
  bid_fee_balance_f       : nat;
  auctions_count          : nat;
  auction_duration        : int;
  min_bid                 : nat;
]

type launch_auction_t   is [@layout:comb] record [
  token                   : token_t;
  amt                     : nat;
  bid                     : nat;
]

type place_bid_t        is [@layout:comb] record [
  auction_id              : nat;
  bid                     : nat;
]

type claim_t            is nat

type set_admin_t        is address

type confirm_admin_t    is unit

type set_baker_t        is key_hash

type set_fees_t         is fees_t

type set_duration_t     is int

type set_min_bid_t      is nat

type update_whitelist_t is [@layout:comb] record [
  token                   : token_t;
  add                     : bool;
]

type withdraw_fee_t     is [@layout:comb] record [
  token                   : token_t;
  receiver                : address;
]

type burn_bid_fee_t     is unit

type action_t           is
(* AUCTION *)
| Receive_fee             of receive_fee_t
| Launch_auction          of launch_auction_t
| Place_bid               of place_bid_t
| Claim                   of claim_t
(* ADMIN *)
| Set_admin               of set_admin_t
| Confirm_admin           of confirm_admin_t
| Set_baker               of set_baker_t
| Set_fees                of set_fees_t
| Set_auction_duration    of set_duration_t
| Set_min_bid             of set_min_bid_t
| Update_whitelist        of update_whitelist_t
| Withdraw_dev_fee        of withdraw_fee_t
| Withdraw_public_fee     of withdraw_fee_t
| Burn_bid_fee            of burn_bid_fee_t

type return_t           is list(operation) * storage_t

type auction_func_t     is (action_t * storage_t) -> return_t

type full_storage_t     is [@layout:comb] record [
  storage                 : storage_t;
  auction_lambdas         : big_map(nat, bytes);
  metadata                : big_map(string, bytes);
]

type full_return_t      is list(operation) * full_storage_t

type full_action_t      is
| Use                     of action_t
| Setup_func              of setup_func_t

const auction_methods_max_index : nat = 13n;
