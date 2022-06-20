#include "../partial/errors.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"

#include "../partial/utils.ligo"

#include "../partial/common_helpers.ligo"

#include "../partial/bucket/bucket_types.ligo"

#include "../partial/dex_core/permits/permits_types.ligo"

#include "../partial/dex_core/dex_core_types.ligo"
#include "../partial/dex_core/dex_core_helpers.ligo"
#include "../partial/dex_core/dex_core_views.ligo"
#include "../partial/dex_core/dex_core_methods.ligo"
#include "../partial/dex_core/dex_core_callbacks.ligo"
#include "../partial/dex_core/dex_core_lambdas.ligo"

#include "../partial/dex_core/permits/permits_methods.ligo"
#include "../partial/dex_core/permits/permits_lambdas.ligo"

#include "../partial/dex_core/fa2/fa2_lambdas.ligo"

function main(
  const action          : full_action_t;
  const s               : full_storage_t)
                        : full_return_t is
  case action of [
  | Use(params)        -> call_dex_core(params, s)
  | Setup_func(params) -> setup_func(params, s)
  ]
