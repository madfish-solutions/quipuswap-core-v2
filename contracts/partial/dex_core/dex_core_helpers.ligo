function get_pair_info_or_default(
  const key             : tokens_t;
  const token_to_id     : big_map(bytes, nat);
  const pairs           : big_map(nat, pair_t);
  const tokens_count    : nat)
                        : (pair_t * nat) is
  block {
    const token_bytes : bytes = Bytes.pack(key);
    const token_id : nat = unwrap_or(token_to_id[token_bytes], tokens_count);
    const pair : pair_t = unwrap_or(pairs[token_id], Constants.default_pair);
  } with (pair, token_id)

function get_bucket_pour_out_entrypoint(
  const bucket          : address)
                        : contract(pour_out_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%pour_out", bucket) : option(contract(pour_out_t))),
    DexCore.err_bucket_pour_out_entrypoint_404
  )

function get_bucket_pour_over_entrypoint(
  const bucket          : address)
                        : contract(pour_over_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%pour_over", bucket) : option(contract(pour_over_t))),
    DexCore.err_bucket_pour_over_entrypoint_404
  )

function get_bucket_ban_baker_entrypoint(
  const bucket          : address)
                        : contract(ban_baker_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%ban_baker", bucket) : option(contract(ban_baker_t))),
    DexCore.err_bucket_ban_baker_entrypoint_404
  )

function get_bucket_vote_entrypoint(
  const bucket          : address)
                        : contract(vote_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%vote", bucket) : option(contract(vote_t))),
    DexCore.err_bucket_vote_entrypoint_404
  )

function get_pour_out_op(
  const pour_out_params : pour_out_t;
  const bucket          : address)
                        : operation is
  Tezos.transaction(pour_out_params, 0mutez, get_bucket_pour_out_entrypoint(bucket))

function get_pour_over_op(
  const pour_over_param : pour_over_t;
  const bucket          : address)
                        : operation is
  Tezos.transaction(pour_over_param, 0mutez, get_bucket_pour_over_entrypoint(bucket))

function get_ban_baker_op(
  const ban_params      : ban_baker_t;
  const bucket          : address)
                        : operation is
  Tezos.transaction(ban_params, 0mutez, get_bucket_ban_baker_entrypoint(bucket))

function get_vote_op(
  const vote_params     : vote_t;
  const bucket          : address)
                        : operation is
  Tezos.transaction(vote_params, 0mutez, get_bucket_vote_entrypoint(bucket))

function fill_or_transfer_tokens(
  const tokens_amt      : nat;
  const token_type      : token_t;
  const bucket_opt      : option(address))
                        : operation is
  if token_type = Tez
  then get_fill_op(tokens_amt * 1mutez, unwrap(bucket_opt, DexCore.err_bucket_404))
  else transfer_token(Tezos.sender, Tezos.self_address, tokens_amt, token_type)

function pour_out_or_transfer_tokens(
  const receiver        : address;
  const tokens_amt      : nat;
  const token_type      : token_t;
  const bucket_opt      : option(address))
                        : operation is
  if token_type = Tez
  then block {
    const pour_out_params : pour_out_t = record [
      receiver = (Tezos.get_contract_with_error(receiver, Common.err_contract_404) : contract(unit));
      amt      = tokens_amt;
    ];
  } with get_pour_out_op(pour_out_params, unwrap(bucket_opt, DexCore.err_bucket_404))
  else transfer_token(Tezos.self_address, receiver, tokens_amt, token_type)

function get_bucket_initial_storage(
  const baker_registry  : address;
  const pair_id         : nat;
  const collect_period  : nat)
                        : bucket_t is
  record [
    users                 = (Big_map.empty : big_map(address, user_t));
    bakers                = (Big_map.empty : big_map(key_hash, baker_t));
    users_rewards         = (Big_map.empty : big_map(address, user_reward_info_t));
    previous_delegated    = Constants.zero_key_hash;
    current_delegated     = Constants.zero_key_hash;
    next_candidate        = Constants.zero_key_hash;
    baker_registry        = baker_registry;
    dex_core              = Tezos.self_address;
    pair_id               = pair_id;
    next_reward           = 0n;
    total_reward          = 0n;
    reward_paid           = 0n;
    reward_per_share      = 0n;
    reward_per_block      = 0n;
    total_supply          = 0n;
    last_update_level     = Tezos.level;
    collecting_period_end = Tezos.level + collect_period;
  ]

function calc_cumulative_prices(
  var pair              : pair_t;
  const new_tok_a_pool  : nat;
  const new_tok_b_pool  : nat)
                        : pair_t is
  block {
    const time_elasped : nat = get_nat_or_fail(Tezos.now - pair.last_block_timestamp);

    if (time_elasped > 0n and pair.token_a_pool > 0n and pair.token_b_pool > 0n)
    then {
      (* price_cumulative = price_cumulative + (price_a * time_elasped) *)
      pair.token_a_price_cml := pair.token_a_price_cml + ((pair.token_b_pool / pair.token_a_pool) * time_elasped);
      (* price_cumulative = price_cumulative + (price_b * time_elasped) *)
      pair.token_b_price_cml := pair.token_b_price_cml + ((pair.token_a_pool / pair.token_b_pool) * time_elasped);
    }
    else skip;

    pair.token_a_pool := new_tok_a_pool;
    pair.token_b_pool := new_tok_b_pool;
    pair.last_block_timestamp := Tezos.now;
  } with pair

function update_fees(
  var s               : storage_t;
  const pair_id       : token_id_t;
  const token_in      : token_t;
  const referrer      : address;
  const interface_fee : nat;
  const auction_fee   : nat)
                      : storage_t is
  block {
    if token_in = Tez
    then {
      s.interface_tez_fee[(pair_id, referrer)] := unwrap_or(s.interface_tez_fee[(pair_id, referrer)], 0n) +
        interface_fee;
      s.auction_tez_fee[pair_id] := unwrap_or(s.auction_tez_fee[pair_id], 0n) + auction_fee;
    }
    else {
      s.interface_fee[(token_in, referrer)] := unwrap_or(s.interface_fee[(token_in, referrer)], 0n) + interface_fee;
      s.auction_fee[token_in] := unwrap_or(s.auction_fee[token_in], 0n) + auction_fee;
    };
  } with s

function form_swap_data(
  const pair            : pair_t;
  const tokens          : tokens_t;
  const direction       : swap_direction_t)
                        : swap_data_t is
  block {
    const side_a : swap_side_t = record [
      pool  = pair.token_a_pool;
      token = tokens.token_a;
    ];
    const side_b : swap_side_t = record [
      pool  = pair.token_b_pool;
      token = tokens.token_b;
    ];
  } with case direction of [
    | A_to_b -> record [
        from_ = side_a;
        to_   = side_b;
      ]
    | B_to_a -> record [
        from_ = side_b;
        to_   = side_a;
      ]
    ]

function form_pools(
  const from_pool       : nat;
  const to_pool         : nat;
  const pair            : pair_t;
  const direction       : swap_direction_t)
                        : pair_t is
  case direction of [
  | A_to_b -> pair with record [
      token_a_pool = from_pool;
      token_b_pool = to_pool;
    ]
  | B_to_a -> pair with record [
      token_a_pool = to_pool;
      token_b_pool = from_pool;
    ]
  ]

function swap_internal(
  var tmp               : tmp_swap_t;
  const params          : swap_slice_t)
                        : tmp_swap_t is
  block {
    const pair : pair_t = unwrap(tmp.s.pairs[params.pair_id], DexCore.err_pair_not_listed);

    assert_with_error(pair.token_a_pool * pair.token_b_pool =/= 0n, DexCore.err_no_liquidity);
    assert_with_error(tmp.amount_in =/= 0n, DexCore.err_zero_in);

    const tokens : tokens_t = unwrap(tmp.s.tokens[params.pair_id], DexCore.err_pair_not_listed);
    var swap: swap_data_t := form_swap_data(pair, tokens, params.direction);

    assert_with_error(swap.from_.token = tmp.token_in, DexCore.err_wrong_route);

    const fees : fees_t = tmp.s.fees;
    const fee_rate : nat = fees.interface_fee + fees.swap_fee + fees.auction_fee;
    const rate_without_fee : nat = get_nat_or_fail(Constants.precision - fee_rate);

    const from_in_with_fee : nat = tmp.amount_in * rate_without_fee;
    const numerator : nat = from_in_with_fee * swap.to_.pool;
    const denominator : nat = swap.from_.pool * Constants.precision + from_in_with_fee;
    const out : nat = numerator / denominator;

    const interface_fee : nat = tmp.amount_in * fees.interface_fee;
    const auction_fee : nat = tmp.amount_in * fees.auction_fee;

    tmp.s := update_fees(tmp.s, params.pair_id, tmp.token_in, tmp.referrer, interface_fee, auction_fee);

    if tmp.token_in = Tez and tmp.counter > 0n
    then {
      const forward : forward_t = record [
        from_bucket = unwrap(tmp.from_bucket, DexCore.err_bucket_404);
        to_bucket   = unwrap(pair.bucket, DexCore.err_bucket_404);
        amt         = tmp.amount_in;
      ];

      tmp.forwards := forward # tmp.forwards;
    }
    else skip;

    tmp.from_bucket := if swap.to_.token = Tez
      then
        pair.bucket
      else
        (None : option(address));

    swap.to_.pool := get_nat_or_fail(swap.to_.pool - out);
    swap.from_.pool := swap.from_.pool + ceil_div(get_nat_or_fail(tmp.amount_in * Constants.precision - interface_fee - auction_fee), Constants.precision);

    tmp.amount_in := out;
    tmp.token_in := swap.to_.token;

    const updated_pair : pair_t = form_pools(swap.from_.pool, swap.to_.pool, pair, params.direction);

    tmp.s.pairs[params.pair_id] := calc_cumulative_prices(pair, updated_pair.token_a_pool, updated_pair.token_b_pool);

    tmp.counter := tmp.counter + 1n;
  } with tmp

function create_pour_over_op(
  const ops             : list(operation);
  const params          : forward_t)
                        : list(operation) is
  block {
    const pour_over_params : pour_over_t = record [
      bucket = params.to_bucket;
      amt    = params.amt;
    ];
  } with get_pour_over_op(pour_over_params, params.from_bucket) # ops

function get_flash_swaps_proxy_default_entrypoint(
  const swaps_proxy     : address)
                        : contract(unit -> list(operation)) is
  Tezos.get_contract_with_error(swaps_proxy, DexCore.err_flash_swaps_proxy_default_entrypoint_404)

function call_flash_swaps_proxy(
  const lambda          : unit -> list(operation);
  const swaps_proxy     : address)
                        : operation is
  Tezos.transaction(lambda, 0mutez, get_flash_swaps_proxy_default_entrypoint(swaps_proxy))

function get_flash_swap_callback(
  const self            : address)
                        : contract(flash_swap_callback_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%flash_swap_callback", self) : option(contract(flash_swap_callback_t))),
    DexCore.err_flash_swap_callback_404
  )

function call_flash_swap_callback(
  const params          : flash_swap_callback_t)
                        : operation is
  Tezos.transaction(params, 0mutez, get_flash_swap_callback(Tezos.self_address))

function get_bucket_withdraw_rewards_entrypoint(
  const bucket       : address)
                        : contract(withdraw_rewards_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%withdraw_rewards", bucket) : option(contract(withdraw_rewards_t))),
    DexCore.err_bucket_withdraw_rewards_entrypoint_404
  )

function get_withdraw_profit_op(
  const user            : address;
  const receiver        : contract(unit);
  const bucket          : address)
                        : operation is
  Tezos.transaction(
    record [
      user     = user;
      receiver = receiver;
    ],
    0mutez,
    get_bucket_withdraw_rewards_entrypoint(bucket)
  )

function get_launch_exchange_callback(
  const this            : address)
                        : contract(launch_callback_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%launch_callback", this) : option(contract(launch_callback_t))),
    DexCore.err_launch_callback_404
  )

function get_launch_exchange_callback_op(
  const params          : launch_callback_t)
                        : operation is
  Tezos.transaction(params, 0mutez, get_launch_exchange_callback(Tezos.self_address))

function get_auction_receive_fee_entrypoint(
  const auction         : address)
                        : contract(receive_fee_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%receive_fee", auction) : option(contract(receive_fee_t))),
    DexCore.err_auction_receive_fee_entrypoint_404
  )

function get_auction_receive_fee_op(
  const params          : receive_fee_t;
  const auction         : address)
                        : operation is
  Tezos.transaction(params, 0mutez, get_auction_receive_fee_entrypoint(auction))

function only_entered(
  const entered         : bool)
                        : unit is
  block {
    assert_with_error(entered, DexCore.err_not_entered);
  } with unit

function check_reentrancy(
  const entered         : bool)
                        : bool is
  if not entered
  then True
  else failwith(DexCore.err_reentrancy)

function get_close_entrypoint(
  const this            : address)
                        : contract(unit) is
  unwrap(
    (Tezos.get_entrypoint_opt("%close", this) : option(contract(unit))),
    DexCore.err_close_entrypoint_404
  )

function get_close_op(
  const _               : unit)
                        : operation is
  Tezos.transaction(Unit, 0mutez, get_close_entrypoint(Tezos.self_address))
