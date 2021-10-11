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

        var sender_account : account_t := get_account(dst.token_id, transfer_param.from_, s.accounts);

        if transfer_param.from_ =/= Tezos.sender and not (Set.mem(Tezos.sender, sender_account.allowances))
        then failwith("FA2_NOT_OPERATOR")
        else skip;

        if sender_account.balance < dst.amount
        then failwith("FA2_INSUFFICIENT_BALANCE")
        else skip;

        sender_account.balance := abs(sender_account.balance - dst.amount);

        s.accounts[(dst.token_id, transfer_param.from_)] := sender_account;

        var recipient_account : account_t := get_account(dst.token_id, dst.to_, s.accounts);

        recipient_account.balance := recipient_account.balance + dst.amount;

        s.accounts[(dst.token_id, dst.to_)] := recipient_account;
      } with s
  } with (List.fold(make_transfer, transfer_param.txs, s))

function update_operator(
  var s                 : storage_t;
  const params          : update_operator_t)
                        : storage_t is
  block {
    case params of
    | Add_operator(param) -> {
      if param.token_id > s.tokens_count
      then failwith("FA2_TOKEN_UNDEFINED")
      else skip;

      if Tezos.sender =/= param.owner
      then failwith("FA2_NOT_OWNER")
      else skip;

      var account : account_t := get_account(param.token_id, param.owner, s.accounts);

      account.allowances := Set.add(param.operator, account.allowances);

      s.accounts[(param.token_id, param.owner)] := account;
    }
    | Remove_operator(param) -> {
      if param.token_id > s.tokens_count
      then failwith("FA2_TOKEN_UNDEFINED")
      else skip;

      if Tezos.sender =/= param.owner
      then failwith("FA2_NOT_OWNER")
      else skip;

      var account : account_t := get_account(param.token_id, param.owner, s.accounts);

      account.allowances := Set.remove(param.operator, account.allowances);

      s.accounts[(param.token_id, param.owner)] := account;
    }
    end
  } with s

function transfer(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Transfer(params) -> {
      s := List.fold(iterate_transfer, params, s);
    }
    | _ -> skip
    end
  } with (no_operations, s)

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
  } with (no_operations, s)

function balance_of(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var operations : list(operation) := no_operations;

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

          const account : account_t = get_account(request.token_id, request.owner, s.accounts);
          const response : balance_response_t = record [
            request = request;
            balance = account.balance;
          ];
        } with response # l;

      const accumulated_response : list(balance_response_t) = List.fold(
        look_up_balance,
        params.requests,
        (nil : list(balance_response_t))
      );

      operations := Tezos.transaction(accumulated_response, 0tz, params.callback) # operations;
    }
    | _ -> skip
    end
  } with (operations, s)
