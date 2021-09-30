type baker_t            is key_hash

type storage_t          is big_map(baker_t, bool)

type action_t           is
| Validate                of baker_t
| Register                of baker_t

type return_t           is list(operation) * storage_t
