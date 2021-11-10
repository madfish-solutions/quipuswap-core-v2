type token_id_t         is nat

type token_metadata_t   is [@layout:comb] record [
  token_id                : token_id_t;
  token_info              : map(string, bytes);
]

type transfer_dst_t     is [@layout:comb] record [
  to_                     : address;
  token_id                : token_id_t;
  amount                  : nat;
]

type transfer_t         is [@layout:comb] record [
  from_                   : address;
  txs                     : list(transfer_dst_t);
]

type transfers_t        is list(transfer_t)

type fa2_transfer_t     is FA2_transfer of transfers_t

type operator_t         is [@layout:comb] record [
  owner                   : address;
  operator                : address;
  token_id                : token_id_t;
]

type update_operator_t  is
| Add_operator            of operator_t
| Remove_operator         of operator_t

type update_operators_t is list(update_operator_t)

type balance_request_t  is [@layout:comb] record [
  owner                   : address;
  token_id                : token_id_t;
]

type balance_response_t is [@layout:comb] record [
  request                 : balance_request_t;
  balance                 : nat;
]

type balance_of_t       is [@layout:comb] record [
  requests                : list(balance_request_t);
  callback                : contract(list(balance_response_t));
]

type fa2_balance_of_t   is FA2_balance_of of balance_of_t

type is_tx_operator_t   is [@laoyout:comb] record [
  owner                   : address;
  approved                : bool;
]
