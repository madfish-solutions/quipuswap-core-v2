function register(
  const baker           : baker_t;
  var s                 : storage_t)
                        : return_t is
  block {
    non_payable(Unit);

    s[baker] := True;
  } with (list [
    Tezos.set_delegate(Some(baker))
  ], s)

function validate(
  const baker           : baker_t;
  const s               : storage_t)
                        : return_t is
  block {
    non_payable(Unit);
  } with case s[baker] of [
    | Some(_) -> ((nil : list(operation)), s)
    | None    -> register(baker, s)
    ]
