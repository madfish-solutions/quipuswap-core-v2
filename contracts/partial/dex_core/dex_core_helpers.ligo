function get_account(
  const token_id        : token_t;
  const user_addr       : address;
  const accounts        : big_map((token_t * address), account_t))
                        : account_t is
  case accounts[(token_id, user_addr)] of
  | None          -> record [
    balance    = 0n;
    allowances = (Set.empty : set(address));
  ]
  | Some(account) -> account
  end

function get_token_metadata(
  const token_id        : token_t;
  const token_metadata  : big_map(token_t, token_metadata_t))
                        : token_metadata_t is
  case token_metadata[token_id] of
  | None           -> (failwith("DexCore/dex-not-set") : token_metadata_t)
  | Some(metadata) -> metadata
  end
