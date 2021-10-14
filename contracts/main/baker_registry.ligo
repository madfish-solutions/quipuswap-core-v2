#include "../partial/utils.ligo"

#include "../partial/dex_core/fa12/fa12_types.ligo"

#include "../partial/dex_core/fa2/fa2_types.ligo"

#include "../partial/common_types.ligo"
#include "../partial/common_helpers.ligo"

#include "../partial/baker_registry/baker_registry_types.ligo"
#include "../partial/baker_registry/baker_registry_methods.ligo"

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of
  | Validate(baker) -> validate(baker, s)
  | Register(baker) -> register(baker, s)
  end
