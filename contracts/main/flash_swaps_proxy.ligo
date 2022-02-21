#include "../partial/errors.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"

#include "../partial/common_helpers.ligo"

#include "../partial/flash_swaps_proxy/flash_swaps_proxy_types.ligo"
#include "../partial/flash_swaps_proxy/flash_swaps_proxy_methods.ligo"

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of
  | Dafault(params) -> default(params, s)
  end
