[@view] function is_banned_baker(
  const baker           : is_banned_baker_t;
  const s               : storage_t)
                        : bool is
  check_is_banned_baker(unwrap_or(s.bakers[baker], Constants.default_baker))

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
    const user : user_t = unwrap_or(s.users[user_addr], Constants.default_user);
  } with unwrap_or(user.candidate, s.current_delegated)
