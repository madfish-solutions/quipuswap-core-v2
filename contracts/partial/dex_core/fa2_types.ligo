type token_t            is nat

type token_metadata_t   is [@layout:comb] record [
  token_id                : token_t;
  token_info              : map(string, bytes);
]
