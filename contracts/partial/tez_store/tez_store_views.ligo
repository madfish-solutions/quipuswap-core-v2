[@view] function is_banned_baker(
  const baker           : is_banned_baker_t;
  const s               : storage_t)
                        : bool is
  get_is_banned_baker(get_baker_or_default(baker, s.bakers))

[@view] function get_tez_balance(
  const _               : unit;
  const _s              : storage_t)
                        : nat is
  Tezos.balance / 1mutez

[@view] function get_user_candidate(
  const user_addr       : address;
  const s               : storage_t)
                        : key_hash is
  block {
    const user : user_t = get_user_or_default(user_addr, s.users);
    const candidate : key_hash = case user.candidate of
    | None    -> s.current_delegated
    | Some(v) -> v
    end;
  } with candidate
