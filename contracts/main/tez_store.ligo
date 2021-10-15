#include "../partial/errors.ligo"

#include "../partial/utils.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"
#include "../partial/common_helpers.ligo"

#include "../partial/tez_store/tez_store_types.ligo"
#include "../partial/tez_store/tez_store_helpers.ligo"
#include "../partial/tez_store/tez_store_methods.ligo"

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of
  | Invest_tez(params) -> invest_tez(params, s)
  | Divest_tez(params) -> divest_tez(params, s)
  end
