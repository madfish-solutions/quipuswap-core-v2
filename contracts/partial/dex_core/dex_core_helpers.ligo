function get_token_metadata(
  const token_id        : token_t;
  const token_metadata  : big_map(token_t, token_metadata_t))
                        : token_metadata_t is
  case token_metadata[token_id] of
  | None           -> (failwith("DexCore/dex-not-set") : token_metadata_t)
  | Some(metadata) -> metadata
  end
