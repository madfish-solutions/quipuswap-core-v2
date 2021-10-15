function transfer_sender_check(
  const params          : transfers_t;
  const action          : action_t;
  const s               : storage_t)
                        : storage_t is
  block {
    [@inline] function check_operator_for_tx(
      var is_tx_operator    : is_tx_operator_t;
      const param           : transfer_dst_t)
                            : is_tx_operator_t is
      block {
        const user : account_t = get_account(is_tx_operator.owner, param.token_id, s.accounts);

        is_tx_operator.approved := is_tx_operator.approved and
          (is_tx_operator.owner = Tezos.sender or Set.mem(Tezos.sender, user.allowances));
      } with is_tx_operator;

    [@inline] function check_operator_for_transfer(
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
  var s                 : storage_t;
  const transfer_param  : transfer_t)
                        : storage_t is
  block {
    function make_transfer(
      var s             : storage_t;
      const dst         : transfer_dst_t)
                        : storage_t is
      block {
        if dst.token_id > s.tokens_count
        then failwith("FA2_TOKEN_UNDEFINED")
        else skip;

        const sender_account : account_t = get_account(transfer_param.from_, dst.token_id, s.accounts);

        if transfer_param.from_ =/= Tezos.sender and not (Set.mem(Tezos.sender, sender_account.allowances))
        then failwith("FA2_NOT_OPERATOR")
        else skip;

        const sender_balance : nat = get_token_balance(transfer_param.from_, dst.token_id, s.ledger);

        if sender_balance < dst.amount
        then failwith("FA2_INSUFFICIENT_BALANCE")
        else skip;

        s.ledger[(transfer_param.from_, dst.token_id)] := abs(sender_balance - dst.amount);

        const recipient_balance : nat = get_token_balance(dst.to_, dst.token_id, s.ledger);

        s.ledger[(dst.to_, dst.token_id)] := recipient_balance + dst.amount;
      } with s
  } with (List.fold(make_transfer, transfer_param.txs, s))

function update_operator(
  var s                 : storage_t;
  const params          : update_operator_t)
                        : storage_t is
  block {
    const (param, should_add) = case params of
    | Add_operator(param) -> (param, True)
    | Remove_operator(param) ->  (param, False)
    end;

    if param.token_id > s.tokens_count
    then failwith("FA2_TOKEN_UNDEFINED")
    else skip;

    if Tezos.sender =/= param.owner
    then failwith("FA2_NOT_OWNER")
    else skip;

    var account : account_t := get_account(param.owner, param.token_id, s.accounts);

    account.allowances := Set.update(param.operator, should_add, account.allowances);

    s.accounts[(param.owner, param.token_id)] := account;
  } with s

function transfer(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Transfer(params) -> {
      s := transfer_sender_check(params, action, s);
      s := List.fold(iterate_transfer, params, s);
    }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

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
          if request.token_id > s.tokens_count
          then failwith("FA2_TOKEN_UNDEFINED")
          else skip;

          const bal : nat = get_token_balance(request.owner, request.token_id, s.ledger);
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

      ops := Tezos.transaction(accumulated_response, 0tz, params.callback) # ops;
    }
    | _ -> skip
    end
  } with (ops, s)
