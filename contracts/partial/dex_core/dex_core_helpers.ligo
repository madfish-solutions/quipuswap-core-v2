function get_account(
  const user_addr       : address;
  const token_id        : token_t;
  const accounts        : big_map((address * token_t), account_t))
                        : account_t is
  case accounts[(user_addr, token_id)] of
  | None          -> record [
    allowances = (Set.empty : set(address));
  ]
  | Some(account) -> account
  end

function get_token_balance(
  const user_addr       : address;
  const token_id        : token_t;
  const ledger          : big_map((address * token_t), nat))
                        : nat is
  case ledger[(user_addr, token_id)] of
  | None      -> 0n
  | Some(bal) -> bal
  end

function get_token_metadata(
  const token_id        : token_t;
  const token_metadata  : big_map(token_t, token_metadata_t))
                        : token_metadata_t is
  case token_metadata[token_id] of
  | None           -> (failwith("DexCore/dex-not-set") : token_metadata_t)
  | Some(metadata) -> metadata
  end
