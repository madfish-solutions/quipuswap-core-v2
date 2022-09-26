#include "../partial/errors.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"
#include "../partial/auction_mock/auction_mock_types.ligo"

#include "../partial/common_helpers.ligo"

#include "../partial/auction_mock/auction_mock_methods.ligo"

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of [
  | Change_owner(param)  -> change_owner(param, s)
  | Default(param)       -> ((nil : list(operation)), s)
  | Receive_fee(param)   -> receive_fee(param, s)
  | Claim_fee(param)     -> claim_fee(param, s)
  | Claim_xtz_fee(param) -> claim_xtz_fee(param, s)
  ]

