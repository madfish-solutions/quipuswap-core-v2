#include "../partial/i_common.ligo"

#include "../partial/dex_core/dex_core_types.ligo"
#include "../partial/dex_core/dex_core_methods.ligo"
#include "../partial/dex_core/dex_core_lambdas.ligo"

function main(
  const action          : full_action_t;
  const s               : full_storage_t)
                        : full_return_t is
  case action of
  | Use(params)         -> call_dex_core(params, s)
  | Setup_func(params)  -> setup_func(params, s)
  | Default             -> (no_operations, s)
  end
