function test(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    case action of
    | Test -> {
      skip;
    }
    | _    -> skip
    end;
  } with (no_operations, s)
