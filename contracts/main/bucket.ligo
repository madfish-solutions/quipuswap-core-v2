#include "../partial/errors.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"

#include "../partial/utils.ligo"

#include "../partial/common_helpers.ligo"

#include "../partial/bucket/bucket_types.ligo"
#include "../partial/bucket/bucket_actions.ligo"
#include "../partial/bucket/bucket_helpers.ligo"
#include "../partial/bucket/bucket_views.ligo"
#include "../partial/bucket/bucket_methods.ligo"

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of [
  | Fill                     -> fill(s)
  | Pour_out(params)         -> pour_out(params, s)
  | Pour_over(params)        -> pour_over(params, s)
  | Withdraw_rewards(params) -> withdraw_rewards(params, s)
  | Ban_baker(params)        -> ban_baker(params, s)
  | Vote(params)             -> vote(params, s)
  | Default                  -> default(s)
  ]
