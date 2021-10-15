type tez_t              is unit

type fa12_token_t       is address

type fa2_token_t        is [@layout:comb] record [
  token                   : address;
  id                      : nat;
]

type token_t       is
| Tez                     of tez_t
| Fa12                    of fa12_token_t
| Fa2                     of fa2_token_t

type user_t             is address

type contr_t            is contract(unit)

type recipient_t        is
| User                    of user_t
| Contr                   of contr_t
