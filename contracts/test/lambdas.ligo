#include "../main/dex_core.ligo"

#include "./parameters.ligo"

function get_flash_swap_agent_default_entrypoint(
  const agent           : address)
                        : contract(nat) is
  Tezos.get_contract_with_error(agent, "FlashSwapAgent/default-entrypoint-404")

function lambda(const _ : unit) : list(operation) is
  list [
    Tezos.transaction(
      val,
      0mutez,
      get_flash_swap_agent_default_entrypoint(agent)
    )
  ]
