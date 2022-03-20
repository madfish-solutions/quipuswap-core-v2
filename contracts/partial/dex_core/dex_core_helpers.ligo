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

function get_tez_store_invest_tez_entrypoint(
  const tez_store       : address)
                        : contract(invest_tez_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%invest_tez", tez_store) : option(contract(invest_tez_t))),
    DexCore.err_tez_store_invest_tez_entrypoint_404
  )

function get_tez_store_divest_tez_entrypoint(
  const tez_store       : address)
                        : contract(divest_tez_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%divest_tez", tez_store) : option(contract(divest_tez_t))),
    DexCore.err_tez_store_divest_tez_entrypoint_404
  )

function get_tez_store_ban_baker_entrypoint(
  const tez_store       : address)
                        : contract(ban_baker_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%ban_baker", tez_store) : option(contract(ban_baker_t))),
    DexCore.err_tez_store_ban_baker_entrypoint_404
  )

function get_tez_store_vote_entrypoint(
  const tez_store       : address)
                        : contract(vote_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%vote", tez_store) : option(contract(vote_t))),
    DexCore.err_tez_store_vote_entrypoint_404
  )

function get_invest_tez_op(
  const amt             : tez;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(Unit, amt, get_tez_store_invest_tez_entrypoint(tez_store))

function get_divest_tez_op(
  const divest_params   : divest_tez_t;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(divest_params, 0mutez, get_tez_store_divest_tez_entrypoint(tez_store))

function get_ban_baker_op(
  const ban_params      : ban_baker_t;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(ban_params, 0mutez, get_tez_store_ban_baker_entrypoint(tez_store))

function get_vote_op(
  const vote_params     : vote_t;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(vote_params, 0mutez, get_tez_store_vote_entrypoint(tez_store))

function invest_tez_or_transfer_tokens(
  const tokens_required : nat;
  const token_type      : token_t;
  const tez_store_opt   : option(address))
                        : operation is
  if token_type = Tez
  then get_invest_tez_op(tokens_required * 1mutez, unwrap(tez_store_opt, DexCore.err_tez_store_404))
  else transfer_token(Tezos.sender, Tezos.self_address, tokens_required, token_type)

function divest_tez_or_transfer_tokens(
  const receiver        : address;
  const tokens_divested : nat;
  const token_type      : token_t;
  const tez_store_opt   : option(address))
                        : operation is
  if token_type = Tez
  then block {
    const divest_params : divest_tez_t = record [
      receiver = (get_contract(receiver) : contract(unit));
      amt      = tokens_divested;
    ];
  } with get_divest_tez_op(divest_params, unwrap(tez_store_opt, DexCore.err_tez_store_404))
  else transfer_token(Tezos.self_address, receiver, tokens_divested, token_type)

function get_tez_store_initial_storage(
  const baker_registry  : address;
  const pair_id         : nat;
  const collect_period  : nat;
  const cycle_duration  : nat;
  const voting_period   : nat)
                        : tez_store_t is
  record [
    users                  = (Big_map.empty : big_map(address, user_t));
    bakers                 = (Big_map.empty : big_map(key_hash, baker_t));
    users_rewards          = (Big_map.empty : big_map(address, user_reward_info_t));
    previous_delegated     = Constants.zero_key_hash;
    current_delegated      = Constants.zero_key_hash;
    next_candidate         = Constants.zero_key_hash;
    baker_registry         = baker_registry;
    dex_core               = Tezos.self_address;
    pair_id                = pair_id;
    next_reward            = 0n;
    total_reward           = 0n;
    reward_paid            = 0n;
    reward_per_share       = 0n;
    reward_per_block       = 0n;
    last_update_level      = Tezos.level;
    collecting_period_ends = Tezos.level + (cycle_duration * collect_period);
    voting_period_ends     = Tezos.level + (cycle_duration * voting_period);
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
      pair.token_a_price_cum := pair.token_a_price_cum + ((pair.token_b_pool / pair.token_a_pool) * time_elasped);
      (* price_cumulative = price_cumulative + (price_b * time_elasped) *)
      pair.token_b_price_cum := pair.token_b_price_cum + ((pair.token_a_pool / pair.token_b_pool) * time_elasped);
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
      s.interface_tez_fee[(pair_id, referrer)] := unwrap_or(s.interface_tez_fee[(pair_id, referrer)], 0n) + interface_fee;
      s.auction_tez_fee[pair_id] := unwrap_or(s.auction_tez_fee[pair_id], 0n) + auction_fee;
    }
    else {
      s.interface_fee[(token_in, referrer)] := unwrap_or(s.interface_fee[(token_in, referrer)], 0n) + interface_fee;
      s.auction_fee[token_in] := unwrap_or(s.auction_fee[token_in], 0n) + auction_fee;
    };
  } with s

function form_flash_swap_data(
  const pair            : pair_t;
  const tokens          : tokens_t;
  const flash_swap_rule : flash_swap_rule_t)
                        : flash_swap_data_t is
  case flash_swap_rule of
  | Loan_a_return_a -> record [
      swap_token      = tokens.token_a;
      return_token    = tokens.token_a;
      swap_token_pool = pair.token_a_pool;
    ]
  | Loan_a_return_b -> record [
      swap_token      = tokens.token_a;
      return_token    = tokens.token_b;
      swap_token_pool = pair.token_a_pool;
    ]
  | Loan_b_return_a -> record [
      swap_token      = tokens.token_b;
      return_token    = tokens.token_a;
      swap_token_pool = pair.token_b_pool;
    ]
  | Loan_b_return_b -> record [
      swap_token      = tokens.token_b;
      return_token    = tokens.token_b;
      swap_token_pool = pair.token_b_pool;
    ]
  end

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
  } with case direction of
    | A_to_b -> record [
        from_ = side_a;
        to_   = side_b;
      ]
    | B_to_a -> record [
        from_ = side_b;
        to_   = side_a;
      ]
    end

function form_pools(
  const from_pool       : nat;
  const to_pool         : nat;
  const pair            : pair_t;
  const direction       : swap_direction_t)
                        : pair_t is
  case direction of
  | B_to_a -> pair with record [
      token_a_pool         = to_pool;
      token_b_pool         = from_pool;
    ]
  | A_to_b -> pair with record [
      token_a_pool         = from_pool;
      token_b_pool         = to_pool;
    ]
  end

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

    const s = update_fees(
      tmp.s,
      params.pair_id,
      tmp.token_in,
      tmp.referrer,
      interface_fee,
      auction_fee
    );

    tmp.s := s;

    if swap.to_.token = Tez and tmp.counter =/= get_nat_or_fail(tmp.swaps_list_size - 1n)
    then {
      const divest_params : divest_tez_t = record [
        receiver = (get_contract(Tezos.self_address) : contract(unit));
        amt      = out;
      ];

      tmp.ops := get_divest_tez_op(divest_params, unwrap(pair.tez_store, DexCore.err_tez_store_404)) # tmp.ops;
    }
    else skip;

    if tmp.token_in = Tez and tmp.counter > 0n
    then {
      tmp.ops := get_invest_tez_op(
        tmp.amount_in * 1mutez,
        unwrap(pair.tez_store, DexCore.err_tez_store_404)
      ) # tmp.ops;
    }
    else skip;

    swap.to_.pool := get_nat_or_fail(swap.to_.pool - out);
    swap.from_.pool := get_nat_or_fail(
      swap.from_.pool + (tmp.amount_in * Constants.precision - interface_fee - auction_fee) / Constants.precision
    );

    tmp.amount_in := out;
    tmp.token_in := swap.to_.token;

    const updated_pair : pair_t = form_pools(swap.from_.pool, swap.to_.pool, pair, params.direction);

    tmp.s.pairs[params.pair_id] := calc_cumulative_prices(pair, updated_pair.token_a_pool, updated_pair.token_b_pool);

    if tmp.counter = get_nat_or_fail(tmp.swaps_list_size - 1n)
    then {
      tmp.last_operation := Some(
        if swap.to_.token = Tez
        then get_divest_tez_op(record [
            receiver     = (get_contract(tmp.receiver) : contract(unit));
            amt          = out;
          ], unwrap(pair.tez_store, DexCore.err_tez_store_404))
        else transfer_token(Tezos.self_address, tmp.receiver, out, swap.to_.token)
      );
    } else skip;
    tmp.counter := tmp.counter + 1n;
  } with tmp

function get_flash_swaps_proxy_default_entrypoint(
  const swaps_proxy     : address)
                        : contract(unit -> list(operation)) is
  Tezos.get_contract_with_error(swaps_proxy, DexCore.err_flash_swaps_proxy_default_entrypoint_404)

function call_flash_swaps_proxy(
  const lambda          : unit -> list(operation);
  const swaps_proxy     : address)
                        : operation is
  Tezos.transaction(lambda, 0mutez, get_flash_swaps_proxy_default_entrypoint(swaps_proxy))

function get_token_address_or_fail(
  const token           : token_t)
                        : address is
  case token of
  | Fa12(token_address) -> token_address
  | Fa2(token_info)     -> token_info.token
  | Tez                 -> (failwith(Common.err_wrong_token_type) : address)
  end

function get_token_id_or_fail(
  const token           : token_t)
                        : token_id_t is
  case token of
  | Fa12(_)         -> (failwith(Common.err_wrong_token_type) : token_id_t)
  | Fa2(token_info) -> token_info.id
  | Tez             -> (failwith(Common.err_wrong_token_type) : token_id_t)
  end

function get_flash_swap_callback(
  const self            : address)
                        : contract(flash_swap_1_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%flash_swap_callback", self) : option(contract(flash_swap_1_t))),
    DexCore.err_flash_swap_callback_404
  )

function call_flash_swap_callback(
  const params          : flash_swap_1_t)
                        : operation is
  Tezos.transaction(params, 0mutez, get_flash_swap_callback(Tezos.self_address))

function get_tez_store_withdraw_rewards_entrypoint(
  const tez_store       : address)
                        : contract(withdraw_rewards_t) is
  unwrap(
    (Tezos.get_entrypoint_opt("%withdraw_rewards", tez_store) : option(contract(withdraw_rewards_t))),
    DexCore.err_tez_store_withdraw_rewards_entrypoint_404
  )

function get_withdraw_profit_op(
  const user            : address;
  const receiver        : contract(unit);
  const current_balance : nat;
  const new_balance     : nat;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(
    record [
      user            = user;
      receiver        = receiver;
      current_balance = current_balance;
      new_balance     = new_balance;
    ],
    0mutez,
    get_tez_store_withdraw_rewards_entrypoint(tez_store)
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
