module Constants is {
  const zero_address : address = ("tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg" : address);

  const zero_key_hash : key_hash = ("tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg" : key_hash);

  const precision : nat = 1_000_000_000_000_000_000n; (* 10 ^ 18 *)

  const default_token_metadata : map(string, bytes) = map [
    "name" -> 0x517569707573776170204c5020546f6b656e;
    "symbol" -> 0x515054;
    "decimals" -> 0x36;
    "description" -> 0x517569707573776170204c5020746f6b656e20726570726573656e7473207573657220736861726520696e20746865206c697175696469747920706f6f6c;
    "shouldPreferSymbol" -> 0x74727565;
    "thumbnailUri" -> 0x68747470733a2f2f7175697075737761702e636f6d2f51504c502e706e67;
  ];

  const default_baker : baker_t = record [
    ban_end_time = (0 : timestamp);
    votes          = 0n;
  ]

  const default_user : user_t = record [
    candidate = (None : option(key_hash));
    votes     = 0n;
  ];

  const default_user_reward_info : user_reward_info_t = record [
    reward_f      = 0n;
    reward_paid_f = 0n;
  ];

  const default_account : account_t = record [
    allowances = (Set.empty : set(address));
  ];

  const default_pair : pair_t = record [
    token_a_pool         = 0n;
    token_b_pool         = 0n;
    token_a_price_cml    = 0n;
    token_b_price_cml    = 0n;
    total_supply         = 0n;
    last_block_timestamp = (0 : timestamp);
    bucket               = (None : option(address));
  ];
}

module Math is {
  function min_nat(
    const a             : nat;
    const b             : nat)
                        : nat is
    if a < b
    then a
    else b
}
