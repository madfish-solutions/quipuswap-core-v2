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

function check_tez_or_token_and_transfer(
  const tokens_required : nat;
  const token_type      : token_t;
  const tez_store_opt   : option(address))
                        : operation is
  if token_type = Tez
  then block {
    const tez_store : address = case tez_store_opt of
    | None    -> failwith(DexCore.err_tez_store_404)
    | Some(v) -> v
    end;
  } with transfer_token(Tezos.sender, tez_store, Tezos.amount / 1mutez, token_type)
  else transfer_token(Tezos.sender, Tezos.self_address, tokens_required, token_type)
