[@view] function is_banned_baker(
  const baker           : is_banned_baker_t;
  const s               : storage_t)
                        : bool is
  get_is_banned_baker(get_baker_or_default(baker, s.bakers))
