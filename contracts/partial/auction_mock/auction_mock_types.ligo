type receive_fee_t      is [@layout:comb] record [
  token                   : token_t;
  fee                     : nat;
]

type claim_fee_t        is [@layout:comb] record [
  token                   : token_t;
  fee                     : nat;
  recipient               : address;
]

type storage_t          is [@layout:comb] record [
  owner                   : address;
  pending_owner           : option(address);
  dex                     : address;
  fees                    : big_map (token_t, nat);
]

type action_t           is
| Change_owner            of address
| Confirm_owner           of unit
| Default                 of unit
| Receive_fee             of receive_fee_t
| Claim_fee               of claim_fee_t
| Withdraw_extra_xtz      of address

type return_t           is list(operation) * storage_t
