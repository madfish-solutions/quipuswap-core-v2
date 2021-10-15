[@inline] function get_account(
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

[@inline] function get_token_balance(
  const user_addr       : address;
  const token_id        : token_id_t;
  const ledger          : big_map((address * token_id_t), nat))
                        : nat is
  case ledger[(user_addr, token_id)] of
  | None      -> 0n
  | Some(bal) -> bal
  end

function get_token_metadata(
  const token_id        : token_id_t;
  const token_metadata  : big_map(token_id_t, token_metadata_t))
                        : token_metadata_t is
  case token_metadata[token_id] of
  | None           -> (failwith(DexCore.err_pair_not_listed) : token_metadata_t)
  | Some(metadata) -> metadata
  end

[@inline] function get_baker(
  const baker           : key_hash;
  const bakers          : big_map(key_hash, baker_t))
                        : baker_t is
  case bakers[baker] of
  | None          -> record [
    ban_period     = 0n;
    ban_start_time = (0 : timestamp);
  ]
  | Some(baker) -> baker
  end

[@inline] function get_pair_info(
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
        token_a_pool = 0n;
        token_b_pool = 0n;
        total_supply = 0n;
        tez_store    = (None : option(address));
      ]
    | Some(p) -> p
    end;
  } with (pair, token_id)

function get_pair(
  const pair_id         : nat;
  const pairs           : big_map(nat, pair_t))
                        : pair_t is
  case pairs[pair_id] of
  | None       -> failwith(DexCore.err_pair_not_listed)
  | Some(pair) -> pair
  end

function get_tokens(
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

function invest_tez(
  const invest_params   : invest_tez_t;
  const amt             : tez;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(
    invest_params,
    amt,
    get_tez_store_invest_tez_entrypoint(tez_store)
  )

function divest_tez(
  const divest_params   : divest_tez_t;
  const tez_store       : address)
                        : operation is
  Tezos.transaction(
    divest_params,
    0mutez,
    get_tez_store_divest_tez_entrypoint(tez_store)
  )

function check_tez_or_token_and_transfer(
  const inv_liq_params : invest_liquidity_t;
  const tokens_required : nat;
  const token_type      : token_t;
  const tez_store_opt   : option(address))
                        : operation is
  if token_type = Tez
  then block {
    const invest_params : invest_tez_t = record [
      candidate = inv_liq_params.candidate;
      user      = inv_liq_params.shares_recipient;
    ];
  } with invest_tez(invest_params, Tezos.amount, get_tez_store_or_fail(tez_store_opt))
  else transfer_token(Tezos.sender, Tezos.self_address, tokens_required, token_type)

function divest_tez_or_transfer_tokens(
  const recipient       : address;
  const tokens_divested : nat;
  const token_type      : token_t;
  const tez_store_opt   : option(address))
                        : operation is
  if token_type = Tez
  then block {
    const divest_params : divest_tez_t = record [
      recipient = (get_contract(recipient) : contract(unit));
      user      = Tezos.sender;
      amt       = tokens_divested;
    ];
  } with divest_tez(divest_params, get_tez_store_or_fail(tez_store_opt))
  else transfer_token(Tezos.self_address, recipient, tokens_divested, token_type)

function get_tez_store_initial_storage(
  const _               : unit)
                        : tez_store_t is
  record [
    ledger = (Big_map.empty : big_map(address, nat));
    voters = (Big_map.empty : big_map(address, vote_info_t));
    vetos = (Big_map.empty : big_map(key_hash, timestamp));
    votes = (Big_map.empty : big_map(key_hash, nat));
    current_delegated = (None: option(key_hash));
    next_candidate = (None: option(key_hash));
    last_veto = Tezos.now;
    dex_core = Tezos.self_address;
    veto = 0n;
    total_votes = 0n;
  ]
