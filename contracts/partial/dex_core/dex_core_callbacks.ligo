function fa12_balance_callback_1(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Fa12_balance_callback_1(bal) -> {
        only_entered(s.entered);

        const tokens : tokens_t = unwrap(s.tokens[s.tmp.pair_id], DexCore.err_pair_not_listed);

        if Tezos.sender = get_token_address_or_fail(tokens.token_a)
        then s.tmp.token_a_balance_1 := bal
        else if Tezos.sender = get_token_address_or_fail(tokens.token_b)
        then s.tmp.token_b_balance_1 := bal
        else skip;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function fa2_balance_callback_1(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Fa2_balance_callback_1(params) -> {
        only_entered(s.entered);

        const tokens : tokens_t = unwrap(s.tokens[s.tmp.pair_id], DexCore.err_pair_not_listed);
        const owner : address = Tezos.self_address;

        if Tezos.sender = get_token_address_or_fail(tokens.token_a)
        then s.tmp.token_a_balance_1 := get_fa2_token_balance(params, get_token_id_or_fail(tokens.token_a), owner)
        else if Tezos.sender = get_token_address_or_fail(tokens.token_b)
        then s.tmp.token_b_balance_1 := get_fa2_token_balance(params, get_token_id_or_fail(tokens.token_b), owner)
        else skip;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function fa12_balance_callback_2(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Fa12_balance_callback_2(bal) -> {
        only_entered(s.entered);

        const tokens : tokens_t = unwrap(s.tokens[s.tmp.pair_id], DexCore.err_pair_not_listed);

        if Tezos.sender = get_token_address_or_fail(tokens.token_a)
        then s.tmp.token_a_balance_2 := bal
        else if Tezos.sender = get_token_address_or_fail(tokens.token_b)
        then s.tmp.token_b_balance_2 := bal
        else skip;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function fa2_balance_callback_2(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Fa2_balance_callback_2(params) -> {
        only_entered(s.entered);

        const tokens : tokens_t = unwrap(s.tokens[s.tmp.pair_id], DexCore.err_pair_not_listed);
        const owner : address = Tezos.self_address;

        if Tezos.sender = get_token_address_or_fail(tokens.token_a)
        then s.tmp.token_a_balance_2 := get_fa2_token_balance(params, get_token_id_or_fail(tokens.token_a), owner)
        else if Tezos.sender = get_token_address_or_fail(tokens.token_b)
        then s.tmp.token_b_balance_2 := get_fa2_token_balance(params, get_token_id_or_fail(tokens.token_b), owner)
        else skip;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function flash_swap_callback_1(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Flash_swap_callback_1(_) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        const tokens : tokens_t = unwrap(s.tokens[s.tmp.pair_id], DexCore.err_pair_not_listed);
        const pair : pair_t = unwrap(s.pairs[s.tmp.pair_id], DexCore.err_pair_not_listed);

        ops := call_flash_swap_callback_2(Unit) # ops;

        if tokens.token_b = Tez
        then {
          const tez_store : address = unwrap(pair.tez_store, DexCore.err_tez_store_404);

          s.tmp.token_b_balance_1 := unwrap(
            (Tezos.call_view("get_tez_balance", Unit, tez_store) : option(nat)),
            DexCore.err_tez_store_get_tez_balance_view_404
          );
        }
        else {
          ops := get_balance_op_or_fail(
            Tezos.self_address,
            tokens.token_b,
            (
              get_fa12_balance_callback_2(Tezos.self_address),
              get_fa2_balance_callback_2(Tezos.self_address)
            )
          ) # ops;
        };

        ops := get_balance_op_or_fail(
          Tezos.self_address,
          tokens.token_a,
          (
            get_fa12_balance_callback_2(Tezos.self_address),
            get_fa2_balance_callback_2(Tezos.self_address)
          )
        ) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)

function flash_swap_callback_2(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Flash_swap_callback_2(_) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        const pair : pair_t = unwrap(s.pairs[s.tmp.pair_id], DexCore.err_pair_not_listed);

        const tok_a_bal_delta : int = s.tmp.token_a_balance_2 - s.tmp.token_a_balance_1;
        const tok_b_bal_delta : int = s.tmp.token_b_balance_2 - s.tmp.token_b_balance_1;

        const new_token_a_pool : nat = get_nat_or_fail(pair.token_a_pool + tok_a_bal_delta);
        const new_token_b_pool : nat = get_nat_or_fail(pair.token_b_pool + tok_b_bal_delta);

        assert_with_error(
          new_token_a_pool * new_token_b_pool >= pair.token_a_pool * pair.token_b_pool,
          DexCore.err_wrong_flash_swap_returns
        );

        s.tmp := Constants.default_tmp;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function launch_callback(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Launch_callback(params) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        ops := get_vote_op(params.vote_params, params.tez_store) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)

function close(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Close(_) -> {
        only_dex_core(Tezos.self_address);
        only_entered(s.entered);

        s.entered := False;
      }
    | _ -> skip
    end
  } with (ops, s)
