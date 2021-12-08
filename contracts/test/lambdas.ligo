#include "parameters.ligo"

const value : tez = 1tz;
const receiver : address = ("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb" : address);

function lambda1(const _ : unit) : list(operation) is
  list [
    Tezos.transaction(
      unit,
      value,
      (get_contract(receiver) : contract(unit))
    )
  ]

(*****************************************************************************)

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

type test_t             is [@layout:comb] record [
  token1                  : token_t;
  token2                  : token_t;
  token1_amt              : nat;
  token2_amt              : nat;
]

const params : test_t = record [
  token1     = Fa12(("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb" : address));
  token2     = Fa12(("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb" : address));
  token1_amt = 5n;
  token2_amt = 5n;
];

function unwrap(
  const param           : option(_a);
  const error           : string)
                        : _a is
  case param of
  | Some(instance) -> instance
  | None           -> (failwith(error) : _a)
  end

function get_flash_swap_agent_test_entrypoint(
  const agent           : address)
                        : contract(test_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%test", agent) : option(contract(test_t))),
    "FlashSwapAgent/test-entrypoint-404"
  )

function lambda2(const _ : unit) : list(operation) is
  list [
    Tezos.transaction(
      params,
      0mutez,
      get_flash_swap_agent_test_entrypoint(agent)
    )
  ]
