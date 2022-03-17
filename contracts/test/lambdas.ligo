#include "../main/dex_core.ligo"

#include "./parameters.ligo"

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

function get_flash_swap_agent_default_entrypoint(
  const agent           : address)
                        : contract(nat) is
  Tezos.get_contract_with_error(agent, "FlashSwapAgent/default-entrypoint-404")

function lambda2(const _ : unit) : list(operation) is
  list [
    Tezos.transaction(
      val,
      0mutez,
      get_flash_swap_agent_default_entrypoint(agent)
    )
  ]
