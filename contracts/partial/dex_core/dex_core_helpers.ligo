[@inline] function get_account_or_default(
  const user_addr       : address;
  const token_id        : token_id_t;
  const accounts        : big_map((address * token_id_t), account_t))
                        : account_t is
  case accounts[(user_addr, token_id)] of
  | None          -> record [
      allowances = (Set.empty : set(address));
    ]
  | Some(account) -> account
  end

[@inline] function get_token_balance_or_default(
  const user_addr       : address;
  const token_id        : token_id_t;
  const ledger          : big_map((address * token_id_t), nat))
                        : nat is
  case ledger[(user_addr, token_id)] of
  | None      -> 0n
  | Some(bal) -> bal
  end

function get_token_metadata_or_fail(
  const token_id        : token_id_t;
  const token_metadata  : big_map(token_id_t, token_metadata_t))
                        : token_metadata_t is
  case token_metadata[token_id] of
  | None           -> (failwith(DexCore.err_pair_not_listed) : token_metadata_t)
  | Some(metadata) -> metadata
  end

[@inline] function get_pair_info_or_default(
  const key             : tokens_t;
  const token_to_id     : big_map(bytes, nat);
  const pairs           : big_map(nat, pair_t);
  const tokens_count    : nat)
                        : (pair_t * nat) is
  block {
    const token_bytes : bytes = Bytes.pack(key);
    const token_id : nat = case token_to_id[token_bytes] of
    | None     -> tokens_count
    | Some(id) -> id
    end;
    const pair : pair_t = case pairs[token_id] of
    | None    -> record [
        token_a_pool      = 0n;
        token_b_pool      = 0n;
        token_a_price_cum = 0n;
        token_b_price_cum = 0n;
        total_supply      = 0n;
        tez_store         = (None : option(address));
      ]
    | Some(p) -> p
    end;
  } with (pair, token_id)

function get_pair_or_fail(
  const pair_id         : nat;
  const pairs           : big_map(nat, pair_t))
                        : pair_t is
  case pairs[pair_id] of
  | None       -> failwith(DexCore.err_pair_not_listed)
  | Some(pair) -> pair
  end

function get_tokens_or_fail(
  const pair_id         : nat;
  const tokens          : big_map(nat, tokens_t))
                        : tokens_t is
  case tokens[pair_id] of
  | None         -> failwith(DexCore.err_pair_not_listed)
  | Some(tokens) -> tokens
  end

function get_tez_store_or_fail(
  const tez_store_opt   : option(address))
                        : address is
  case tez_store_opt of
  | None            -> (failwith(DexCore.err_tez_store_404) : address)
  | Some(tez_store) -> tez_store
  end

function get_tez_store_invest_tez_entrypoint(
  const tez_store       : address)
                        : contract(invest_tez_t) is
  case (Tezos.get_entrypoint_opt("%invest_tez", tez_store) : option(contract(invest_tez_t))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_tez_store_invest_tez_entrypoint_404) : contract(invest_tez_t))
  end

function get_tez_store_divest_tez_entrypoint(
  const tez_store       : address)
                        : contract(divest_tez_t) is
  case (Tezos.get_entrypoint_opt("%divest_tez", tez_store) : option(contract(divest_tez_t))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_tez_store_divest_tez_entrypoint_404) : contract(divest_tez_t))
  end

function get_tez_store_ban_baker_entrypoint(
  const tez_store       : address)
                        : contract(ban_baker_t) is
  case (Tezos.get_entrypoint_opt("%ban_baker", tez_store) : option(contract(ban_baker_t))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_tez_store_ban_baker_entrypoint_404) : contract(ban_baker_t))
  end

function get_tez_store_vote_entrypoint(
  const tez_store       : address)
                        : contract(vote_t) is
  case (Tezos.get_entrypoint_opt("%vote", tez_store) : option(contract(vote_t))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_tez_store_vote_entrypoint_404) : contract(vote_t))
  end

function get_invest_tez_op(
  const invest_params   : invest_tez_t;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(
    invest_params,
    Tezos.amount,
    get_tez_store_invest_tez_entrypoint(tez_store)
  )

function get_divest_tez_op(
  const divest_params   : divest_tez_t;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(
    divest_params,
    0mutez,
    get_tez_store_divest_tez_entrypoint(tez_store)
  )

function get_ban_baker_op(
  const ban_params      : ban_baker_t;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(
    ban_params,
    0mutez,
    get_tez_store_ban_baker_entrypoint(tez_store)
  )

function get_vote_op(
  const vote_params     : vote_t;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(
    vote_params,
    0mutez,
    get_tez_store_vote_entrypoint(tez_store)
  )

function check_tez_or_token_and_transfer(
  const inv_liq_params : invest_liquidity_t;
  const tokens_required : nat;
  const token_type      : token_t;
  const tez_store_opt   : option(address))
                        : operation is
  if token_type = Tez
  then get_invest_tez_op(inv_liq_params.shares_receiver, get_tez_store_or_fail(tez_store_opt))
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
      receiver     = (get_contract(receiver) : contract(unit));
      user         = Tezos.sender;
      amt          = tokens_divested;
    ];
  } with get_divest_tez_op(divest_params, get_tez_store_or_fail(tez_store_opt))
  else transfer_token(Tezos.self_address, receiver, tokens_divested, token_type)

function get_tez_store_initial_storage(
  const candidate       : key_hash;
  const share_receiver  : address;
  const tez_bal         : nat;
  const init_shares     : nat;
  const cycle_duration  : nat;
  const pair_id         : nat;
  const baker_registry  : address)
                        : tez_store_t is
  record [
    users             = big_map [
      share_receiver -> record [
        candidate = Some(candidate);
        tez_bal   = tez_bal;
        votes     = init_shares;
      ]
    ];
    bakers            = big_map [
      candidate -> record [
        ban_start_time = Tezos.now;
        ban_period     = 0n;
        votes          = init_shares;
      ]
    ];
    users_rewards     = (Big_map.empty : big_map(address, user_reward_info_t));
    current_delegated = candidate;
    next_candidate    = Constants.zero_key_hash;
    baker_registry    = baker_registry;
    dex_core          = Tezos.self_address;
    pair_id           = pair_id;
    total_votes       = init_shares;
    reward            = 0n;
    total_reward      = 0n;
    reward_paid       = 0n;
    reward_per_share  = 0n;
    reward_per_second = 0n;
    cycle_duration    = cycle_duration;
    period_finish     = Tezos.level;
    last_update_level = Tezos.level;
  ]

function calc_cumulative_prices(
  var pair              : pair_t;
  const last_block_time : timestamp;
  const new_tok_a_pool  : nat;
  const new_tok_b_pool  : nat)
                        : (pair_t * timestamp) is
  block {
    const time_elasped : nat = abs(Tezos.now - last_block_time);

    if (time_elasped > 0n and pair.token_a_pool =/= 0n and pair.token_b_pool =/= 0n)
    then {
      (* price_cumulative = price_cumulative + (price_a * time_elasped) *)
      pair.token_a_price_cum := pair.token_a_price_cum + ((pair.token_b_pool / pair.token_a_pool) * time_elasped);
      (* price_cumulative = price_cumulative + (price_b * time_elasped) *)
      pair.token_b_price_cum := pair.token_b_price_cum + ((pair.token_a_pool / pair.token_b_pool) * time_elasped);
    }
    else skip;

    pair.token_a_pool := new_tok_a_pool;
    pair.token_b_pool := new_tok_b_pool;
  } with (pair, Tezos.now)

function get_tok_interface_fee_or_default(
  const key             : token_t * address;
  const fees            : big_map((token_t * address), nat))
                        : nat is
  case fees[key] of
  | None      -> 0n
  | Some(fee) -> fee
  end

function get_tez_interface_fee_or_default(
  const key             : token_id_t * address;
  const fees            : big_map((token_id_t * address), nat))
                        : nat is
  case fees[key] of
  | None      -> 0n
  | Some(fee) -> fee
  end

function form_swap_data(
  const pair            : pair_t;
  const swap            : tokens_t;
  const direction       : swap_direction_t)
                        : swap_data_t is
  block {
    const side_a : swap_side_t = record [
      pool  = pair.token_a_pool;
      token = swap.token_a;
    ];
    const side_b : swap_side_t = record [
      pool  = pair.token_b_pool;
      token = swap.token_b;
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
  const tok_a_price_cum : nat;
  const tok_b_price_cum : nat;
  const supply          : nat;
  const tez_store_opt   : option(address);
  const direction       : swap_direction_t)
                        : pair_t is
  case direction of
  | B_to_a -> record [
      token_a_pool      = to_pool;
      token_b_pool      = from_pool;
      token_a_price_cum = tok_a_price_cum;
      token_b_price_cum = tok_b_price_cum;
      total_supply      = supply;
      tez_store         = tez_store_opt;
    ]
  | A_to_b -> record [
      token_a_pool      = from_pool;
      token_b_pool      = to_pool;
      token_a_price_cum = tok_b_price_cum;
      token_b_price_cum = tok_a_price_cum;
      total_supply      = supply;
      tez_store         = tez_store_opt;
    ]
  end

function swap_internal(
  var tmp               : tmp_swap_t;
  const params          : swap_slice_t)
                        : tmp_swap_t is
  block {
    const pair : pair_t = get_pair_or_fail(params.pair_id, tmp.s.pairs);

    assert_with_error(pair.token_a_pool * pair.token_b_pool =/= 0n, DexCore.err_no_liquidity);
    assert_with_error(tmp.amount_in =/= 0n, DexCore.err_zero_in);

    const tokens : tokens_t = get_tokens_or_fail(params.pair_id, tmp.s.tokens);
    var swap: swap_data_t := form_swap_data(pair, tokens, params.direction);

    assert_with_error(swap.from_.token = tmp.token_in, DexCore.err_wrong_route);

    const fees : fees_t = tmp.s.fees;
    const fee_rate : nat = fees.interface_fee + fees.swap_fee;
    const rate_without_fee : nat = abs(Constants.precision - fee_rate);

    const from_in_with_fee : nat = tmp.amount_in * rate_without_fee;
    const numerator : nat = from_in_with_fee * swap.to_.pool / Constants.precision;
    const denominator : nat = swap.from_.pool + from_in_with_fee;
    const out : nat = numerator / denominator;

    const interface_fee : nat = tmp.amount_in * fees.interface_fee;

    if tmp.token_in = Tez
    then {
      tmp.s.tez_interface_fee[(params.pair_id, tmp.referrer)] := get_tez_interface_fee_or_default(
        (params.pair_id, tmp.referrer),
        tmp.s.tez_interface_fee
      ) + interface_fee;
    }
    else {
      tmp.s.tok_interface_fee[(tmp.token_in, tmp.referrer)] := get_tok_interface_fee_or_default(
        (tmp.token_in, tmp.referrer),
        tmp.s.tok_interface_fee
      ) + interface_fee;
    };

    assert_with_error(out * Constants.precision <= swap.to_.pool / 3n, DexCore.err_high_out);

    swap.to_.pool := abs(swap.to_.pool - out);
    swap.from_.pool := abs(swap.from_.pool + tmp.amount_in * Constants.precision - interface_fee);

    tmp.amount_in := out;
    tmp.token_in := swap.to_.token;

    const updated_pair_1 : pair_t = form_pools(
      swap.from_.pool,
      swap.to_.pool,
      pair.token_a_price_cum,
      pair.token_b_price_cum,
      pair.total_supply,
      pair.tez_store,
      params.direction
    );

    var (updated_pair_2, last_block_timestamp) := calc_cumulative_prices(
      updated_pair_1,
      tmp.s.last_block_timestamp,
      updated_pair_1.token_a_pool,
      updated_pair_1.token_b_pool
    );

    tmp.s.last_block_timestamp := last_block_timestamp;
    tmp.s.pairs[params.pair_id] := updated_pair_2;

    if swap.to_.token = Tez
    then tmp.operation := Some(transfer_tez((get_contract(tmp.receiver) : contract(unit)), out))
    else tmp.operation := Some(transfer_token(Tezos.self_address, tmp.receiver, out, swap.to_.token));
  } with tmp

function get_flash_swaps_proxy_call_entrypoint(
  const swaps_proxy     : address)
                        : contract(unit -> list(operation)) is
  case (Tezos.get_entrypoint_opt("%call", swaps_proxy) : option(contract(unit -> list(operation)))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_flash_swaps_proxy_call_entrypoint_404) : contract(unit -> list(operation)))
  end

function call_flash_swaps_proxy(
  const lambda          : unit -> list(operation);
  const swaps_proxy     : address)
                        : operation is
  Tezos.transaction(
    lambda,
    0mutez,
    get_flash_swaps_proxy_call_entrypoint(swaps_proxy)
  )

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
                        : contract(flash_swap_2_t) is
  case (Tezos.get_entrypoint_opt("%flash_swap_callback", self) : option(contract(flash_swap_2_t))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_flash_swap_callback_404) : contract(flash_swap_2_t))
  end

function call_flash_swap_callback(
  const _               : unit)
                        : operation is
  Tezos.transaction(
    Unit,
    0mutez,
    get_flash_swap_callback(Tezos.self_address)
  )

function get_fa12_balance_callback_1(const contr : address) : contract(nat) is
  case (Tezos.get_entrypoint_opt("%fa12_balance_callback_1", contr) : option(contract(nat))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_fa12_balance_callback_1_404) : contract(nat))
  end

function get_fa2_balance_callback_1(const contr : address) : contract(list(balance_response_t)) is
  case (Tezos.get_entrypoint_opt("%fa2_balance_callback_1", contr) : option(contract(list(balance_response_t)))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_fa2_balance_callback_1_404) : contract(list(balance_response_t)))
  end

function get_fa12_balance_callback_2(const contr : address) : contract(nat) is
  case (Tezos.get_entrypoint_opt("%fa12_balance_callback_2", contr) : option(contract(nat))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_fa12_balance_callback_2_404) : contract(nat))
  end

function get_fa2_balance_callback_2(const contr : address) : contract(list(balance_response_t)) is
  case (Tezos.get_entrypoint_opt("%fa2_balance_callback_2", contr) : option(contract(list(balance_response_t)))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_fa2_balance_callback_2_404) : contract(list(balance_response_t)))
  end

function get_default_tmp(
  const _               : unit)
                        : tmp_t is
  record [
    pair_id           = 0n;
    amount_a_out      = 0n;
    amount_b_out      = 0n;
    referrer          = Constants.zero_address;
    token_a_balance_1 = 0n;
    token_b_balance_1 = 0n;
    token_a_balance_2 = 0n;
    token_b_balance_2 = 0n;
  ]

function get_tez_store_withdraw_rewards_entrypoint(const tez_store : address) : contract(withdraw_rewards_t) is
  case (Tezos.get_entrypoint_opt("%withdraw_rewards", tez_store) : option(contract(withdraw_rewards_t))) of
  | Some(contr) -> contr
  | None        -> (failwith(DexCore.err_tez_store_withdraw_rewards_entrypoint_404) : contract(withdraw_rewards_t))
  end

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
