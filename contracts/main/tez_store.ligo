#include "../partial/utils.ligo"

#include "../partial/common_types.ligo"
#include "../partial/common_helpers.ligo"

#include "../partial/tez_store/tez_store_types.ligo"
#include "../partial/tez_store/tez_store_methods.ligo"

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of
  | Test -> test(s)
  end
