#include "../partial/i_common.ligo"

#include "../partial/baker_registry/i_baker_registry.ligo"
#include "../partial/baker_registry/baker_registry_methods.ligo"

function main(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  case action of
  | Validate(baker)     -> validate(baker, s)
  | Register(baker)     -> register(baker, s)
  end
