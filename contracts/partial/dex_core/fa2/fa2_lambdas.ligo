function transfer_sender_check(
  const params          : transfers_t;
  const action          : action_t;
  const s               : storage_t)
                        : storage_t is
  block {
    function check_operator_for_tx(
      var is_tx_operator    : is_tx_operator_t;
      const param           : transfer_dst_t)
                            : is_tx_operator_t is
      block {
        const user : account_t = unwrap_or(
          s.accounts[(is_tx_operator.owner, param.token_id)],
          Constants.default_account
        );

        is_tx_operator.approved := is_tx_operator.approved and
          (is_tx_operator.owner = Tezos.sender or Set.mem(Tezos.sender, user.allowances));
      } with is_tx_operator;

    function check_operator_for_transfer(
      const approved    : bool;
      const param       : transfer_t)
                        : bool is
      block {
        var acc : is_tx_operator_t := record [
          owner    = param.from_;
          approved = True;
        ];

        acc := List.fold(check_operator_for_tx, param.txs, acc);
      } with approved and acc.approved;

    const is_approved_for_all_transfers : bool = List.fold(check_operator_for_transfer, params, True);
  } with
      if is_approved_for_all_transfers
      then s
      else case params of
        | nil -> s
        | first_param # rest -> block {
            const from_ : address = first_param.from_;
            const updated_s : storage_t = sender_check(from_, s, action, "FA2_NOT_OPERATOR");

            function check(
              const param : transfer_t)
                          : unit is
              if param.from_ =/= from_
              then failwith("FA2_NOT_OPERATOR")
              else unit;

            List.iter(check, rest);
          } with updated_s
        end

function iterate_transfer(
  const result          : return_t;
  const transfer_param  : transfer_t)
                        : return_t is
  block {
    function make_transfer(
      var result        : return_t;
      const dst         : transfer_dst_t)
                        : return_t is
      block {
        var ops : list(operation) := result.0;
        var s : storage_t := result.1;

        assert_with_error(dst.token_id <= s.tokens_count, "FA2_TOKEN_UNDEFINED");

        const sender_account : account_t = unwrap_or(
          s.accounts[(transfer_param.from_, dst.token_id)],
          Constants.default_account
        );

        assert_with_error(
          transfer_param.from_ = Tezos.sender or Set.mem(Tezos.sender, sender_account.allowances),
          "FA2_NOT_OPERATOR"
        );

        const sender_balance : nat = unwrap_or(s.ledger[(transfer_param.from_, dst.token_id)], 0n);

        assert_with_error(sender_balance >= dst.amount, "FA2_INSUFFICIENT_BALANCE");

        s.ledger[(transfer_param.from_, dst.token_id)] := get_nat_or_fail(sender_balance - dst.amount);

        const receiver_balance : nat = unwrap_or(s.ledger[(dst.to_, dst.token_id)], 0n);

        s.ledger[(dst.to_, dst.token_id)] := receiver_balance + dst.amount;

        const tokens : tokens_t = unwrap(s.tokens[dst.token_id], DexCore.err_pair_not_listed);

        if tokens.token_b = Tez
        then {
          const pair : pair_t = unwrap(s.pairs[dst.token_id], DexCore.err_pair_not_listed);
          const tez_store : address = unwrap(pair.tez_store, DexCore.err_tez_store_404);
          const sender_candidate : key_hash =
            case (Tezos.call_view("get_user_candidate", transfer_param.from_, tez_store) : option(key_hash)) of
          | Some(v) -> v
          | None    -> failwith(DexCore.err_tez_store_get_user_candidate_view_404)
          end;
          const receiver_candidate : key_hash =
            case (Tezos.call_view("get_user_candidate", dst.to_, tez_store) : option(key_hash)) of
          | Some(v) -> v
          | None    -> failwith(DexCore.err_tez_store_get_user_candidate_view_404)
          end;
          const new_sender_balance : nat = unwrap_or(s.ledger[(transfer_param.from_, dst.token_id)], 0n);
          const new_receiver_balance : nat = unwrap_or(s.ledger[(dst.to_, dst.token_id)], 0n);

          ops := get_vote_op(
            record [
              voter           = dst.to_;
              candidate       = receiver_candidate;
              execute_voting  = True;
              votes           = new_receiver_balance;
              current_balance = receiver_balance;
              new_balance     = new_receiver_balance;
            ],
            unwrap(pair.tez_store, DexCore.err_tez_store_404)
          ) # ops;
          ops := get_vote_op(
            record [
              voter           = transfer_param.from_;
              candidate       = sender_candidate;
              execute_voting  = False;
              votes           = new_sender_balance;
              current_balance = sender_balance;
              new_balance     = new_sender_balance;
            ],
            unwrap(pair.tez_store, DexCore.err_tez_store_404)
          ) # ops;
        }
        else skip;
      } with (ops, s)
  } with (List.fold(make_transfer, transfer_param.txs, result))

function update_operator(
  var s                 : storage_t;
  const params          : update_operator_t)
                        : storage_t is
  block {
    const (param, should_add) = case params of
    | Add_operator(param)    -> (param, True)
    | Remove_operator(param) ->  (param, False)
    end;

    assert_with_error(param.token_id <= s.tokens_count, "FA2_TOKEN_UNDEFINED");
    assert_with_error(Tezos.sender = param.owner, "FA2_NOT_OWNER");

    var account : account_t := unwrap_or(s.accounts[(param.owner, param.token_id)], Constants.default_account);

    account.allowances := Set.update(param.operator, should_add, account.allowances);

    s.accounts[(param.owner, param.token_id)] := account;
  } with s

function transfer(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var result : return_t := ((nil : list(operation)), s);

    case action of
    | Transfer(params) -> {
      result.1 := transfer_sender_check(params, action, s);
      result := List.fold(iterate_transfer, params, result);
    }
    | _ -> skip
    end
  } with result

function update_operators(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Update_operators(params) -> {
      s := List.fold(update_operator, params, s);
    }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function balance_of(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Balance_of(params) -> {
      function look_up_balance(
        const l         : list(balance_response_t);
        const request   : balance_request_t)
                        : list(balance_response_t) is
        block {
          assert_with_error(request.token_id <= s.tokens_count, "FA2_TOKEN_UNDEFINED");

          const bal : nat = unwrap_or(s.ledger[(request.owner, request.token_id)], 0n);
          const response : balance_response_t = record [
            request = request;
            balance = bal;
          ];
        } with response # l;

      const accumulated_response : list(balance_response_t) = List.fold(
        look_up_balance,
        params.requests,
        (nil : list(balance_response_t))
      );

      ops := Tezos.transaction(accumulated_response, 0mutez, params.callback) # ops;
    }
    | _ -> skip
    end
  } with (ops, s)
