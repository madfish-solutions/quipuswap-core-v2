function only_admin(
  const admin           : address)
                        : unit is
  block {
    assert_with_error(Tezos.sender = admin, Common.err_not_admin);
  } with unit

function only_pending_admin(
  const pending_admin   : address)
                        : unit is
  block {
    assert_with_error(Tezos.sender = pending_admin, Common.err_not_pending_admin);
  } with unit

function only_manager(
  const managers        : set(address))
                        : unit is
  block {
    assert_with_error(Set.mem(Tezos.sender, managers), Common.err_not_manager);
  } with unit

function only_dex_core(
  const dex_core        : address)
                        : unit is
  block {
    assert_with_error(Tezos.sender = dex_core, Common.err_not_dex_core);
  } with unit

function get_fa12_token_transfer_entrypoint(
  const token           : address)
                        : contract(fa12_transfer_t) is
  case (Tezos.get_entrypoint_opt("%transfer", token) : option(contract(fa12_transfer_t))) of
  | Some(contr) -> contr
  | None        -> (failwith(Common.err_fa12_transfer_entrypoint_404) : contract(fa12_transfer_t))
  end

function get_fa2_token_transfer_entrypoint(
  const token           : address)
                        : contract(fa2_transfer_t) is
  case (Tezos.get_entrypoint_opt("%transfer", token) : option(contract(fa2_transfer_t))) of
  | Some(contr) -> contr
  | None        -> (failwith(Common.err_fa2_transfer_entrypoint_404) : contract(fa2_transfer_t))
  end

function wrap_fa12_transfer_trx(
  const from_           : address;
  const to_             : address;
  const amt             : nat)
                        : fa12_transfer_t is
  FA12_transfer(from_, (to_, amt))

function wrap_fa2_transfer_trx(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const id              : token_id_t)
                        : fa2_transfer_t is
  FA2_transfer(
    list [
      record [
        from_ = from_;
        txs   = list [
          record [
            to_      = to_;
            token_id = id;
            amount   = amt;
          ]
        ];
      ]
    ]
  )

function transfer_tez(
  const to_             : contract(unit);
  const amt             : nat)
                        : operation is
  Tezos.transaction(unit, amt * 1mutez, to_)

function transfer_fa12(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const token           : address)
                        : operation is
  Tezos.transaction(
    wrap_fa12_transfer_trx(from_, to_, amt),
    0mutez,
    get_fa12_token_transfer_entrypoint(token)
  )

function transfer_fa2(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const token           : address;
  const id              : token_id_t)
                        : operation is
  Tezos.transaction(
    wrap_fa2_transfer_trx(from_, to_, amt, id),
    0mutez,
    get_fa2_token_transfer_entrypoint(token)
  )

function transfer_token(
  const from_           : address;
  const to_             : address;
  const amt             : nat;
  const token           : token_t)
                        : operation is
  case token of
  | Tez         -> transfer_tez((get_contract(to_) : contract(unit)), amt)
  | Fa12(token) -> transfer_fa12(from_, to_, amt, token)
  | Fa2(token)  -> transfer_fa2(from_, to_, amt, token.token, token.id)
  end

function get_fa12_token_balance_of_entrypoint(const token : address) : contract(fa12_balance_of_t) is
  case (Tezos.get_entrypoint_opt("%getBalance", token) : option(contract(fa12_balance_of_t))) of
  | Some(contr) -> contr
  | None        -> (failwith(Common.err_fa12_balance_of_entrypoint_404) : contract(fa12_balance_of_t))
  end

function get_fa2_token_balance_of_entrypoint(const token : address) : contract(fa2_balance_of_t) is
  case (Tezos.get_entrypoint_opt("%balance_of", token) : option(contract(fa2_balance_of_t))) of
  | Some(contr) -> contr
  | None        -> (failwith(Common.err_fa2_balance_of_entrypoint_404) : contract(fa2_balance_of_t))
  end

function wrap_fa12_balance_of_trx(
  const user            : address;
  const callback        : contract(nat))
                        : fa12_balance_of_t is
  FA12_balance_of(user, callback)

function wrap_fa2_balance_of_trx(
  const user            : address;
  const id              : token_id_t;
  const callback        : contract(list(balance_response_t)))
                        : fa2_balance_of_t is
  FA2_balance_of(
    record [
      requests = list [
        record [
          owner    = user;
          token_id = id;
        ]
      ];
      callback = callback;
    ]
  )

function get_fa12_balance(
  const user            : address;
  const token           : address;
  const callback        : contract(nat))
                        : operation is
  Tezos.transaction(
    wrap_fa12_balance_of_trx(user, callback),
    0mutez,
    get_fa12_token_balance_of_entrypoint(token)
  )

function get_fa2_balance(
  const user            : address;
  const token           : address;
  const id              : token_id_t;
  const callback        : contract(list(balance_response_t)))
                        : operation is
  Tezos.transaction(
    wrap_fa2_balance_of_trx(user, id, callback),
    0mutez,
    get_fa2_token_balance_of_entrypoint(token)
  )

function get_balance_op_or_fail(
  const user            : address;
  const token           : token_t;
  const callbacks       : contract(nat) * contract(list(balance_response_t)))
                        : operation is
  case token of
  | Tez         -> (failwith(Common.err_wrong_token_type) : operation)
  | Fa12(token) -> get_fa12_balance(user, token, callbacks.0)
  | Fa2(token)  -> get_fa2_balance(user, token.token, token.id, callbacks.1)
  end

function ceil_div(
  const numerator       : nat;
  const denominator     : nat)
                        : nat is
  case ediv(numerator, denominator) of
  | Some(result) ->
      if result.1 > 0n
      then result.0 + 1n
      else result.0
  | None         -> failwith(Common.err_div_by_zero)
  end

function get_nat_or_fail(
  const number          : int)
                        : nat is
  case is_nat(number) of
  | Some(n) -> n
  | None    -> failwith(Common.err_not_a_nat)
  end

function get_fa2_token_balance(
  const response        : list(balance_response_t);
  const token_id        : token_id_t;
  const owner           : address)
                        : nat is
  block {
    var bal : nat := 0n;

    function get_fa2_balance(
      var bal           : nat;
      const v           : balance_response_t)
                        : nat is
      block {
        const request : balance_request_t = record [
          token_id = token_id;
          owner    = owner;
        ];

        if v.request = request
        then bal := v.balance
        else skip;
      } with bal;

    bal := List.fold(get_fa2_balance, response, bal);
  } with bal

function unwrap_or(
  const param           : option(_a);
  const default         : _a)
                        : _a is
  case param of
  | Some(instance) -> instance
  | None           -> default
  end

function unwrap(
  const param           : option(_a);
  const error           : string)
                        : _a is
  case param of
  | Some(instance) -> instance
  | None           -> (failwith(error) : _a)
  end

function concat_lists(
  const lst1            : list(_a);
  const lst2            : list(_a))
                        : list(_a) is
  List.fold_right(
    function(
      const op          : _a;
      const lst         : list(_a))
                        : list(_a) is
      op # lst,
    lst1,
    lst2
  )

function reverse_list(
  const lst             : list(_a))
                        : list(_a) is
  List.fold(
    function(
      const lst         : list(_a);
      const op          : _a)
                        : list(_a) is
      op # lst,
    lst,
    (nil : list(_a))
  )
