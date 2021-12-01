function is_whitelisted_token(
  const token            : token_t;
  const whitelist        : set(token_t))
                         : unit is
  case Set.mem(token, whitelist) of
  | False -> (failwith(Auction.err_not_whitelisted_token) : unit)
  | True  -> unit
  end

function is_not_whitelisted_token(
  const token            : token_t;
  const whitelist        : set(token_t))
                         : unit is
  case Set.mem(token, whitelist) of
  | False -> unit
  | True  -> (failwith(Auction.err_whitelisted_token) : unit)
  end
