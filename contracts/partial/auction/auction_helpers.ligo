function get_fee(
  const token            : token_t;
  const fee_map          : big_map(token_t, nat))
                         : nat is
  case fee_map[token] of
  | None      -> 0n
  | Some(amt) -> amt
  end

function get_auction(
  const auction_id       : nat;
  const auctions         : big_map(nat, auction_t))
                         : auction_t is
  case auctions[auction_id] of
  | None          -> (failwith(Auction.err_auction_not_found) : auction_t)
  | Some(auction) -> auction
  end

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
