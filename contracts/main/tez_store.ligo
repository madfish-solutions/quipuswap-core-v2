#include "../partial/errors.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"

#include "../partial/utils.ligo"

#include "../partial/common_helpers.ligo"

#include "../partial/tez_store/tez_store_types.ligo"
#include "../partial/tez_store/tez_store_actions.ligo"
#include "../partial/tez_store/tez_store_helpers.ligo"
#include "../partial/tez_store/tez_store_views.ligo"
#include "../partial/tez_store/tez_store_methods.ligo"

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of
  | Deposit(params)          -> deposit(s)
  | Withdraw(params)         -> withdraw(params, s)
  | Forward(params)          -> forward(params, s)
  | Withdraw_rewards(params) -> withdraw_rewards(params, s)
  | Ban_baker(params)        -> ban_baker(params, s)
  | Vote(params)             -> vote(params, s)
  | Default                  -> default(s)
  end
