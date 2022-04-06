#include "../partial/errors.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"

#include "../partial/utils.ligo"

#include "../partial/common_helpers.ligo"

#include "../partial/auction/auction_types.ligo"
#include "../partial/auction/auction_methods.ligo"
#include "../partial/auction/auction_lambdas.ligo"

function main(
  const action          : full_action_t;
  const s               : full_storage_t)
                        : full_return_t is
  case action of [
  | Use(params)        -> call_auction(params, s)
  | Setup_func(params) -> setup_func(params, s)
  | Default            -> default(s)
  ]
