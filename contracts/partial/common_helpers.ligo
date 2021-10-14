function only_admin(
  const admin           : address)
                        : unit is
  block {
    if Tezos.sender =/= admin
    then failwith("Not-admin")
    else skip;
  } with unit

function only_pending_admin(
  const pending_admin   : address)
                        : unit is
  block {
    if Tezos.sender =/= pending_admin
    then failwith("Not-pending-admin")
    else skip;
  } with unit

function only_manager(
  const managers        : set(address))
                        : unit is
  block {
    if not Set.mem(Tezos.sender, managers)
    then failwith("Not-manager")
    else skip;
  } with unit

function get_fa12_token_transfer_entrypoint(
  const token           : address)
                        : contract(fa12_transfer_t) is
  case (Tezos.get_entrypoint_opt("%transfer", token) : option(contract(fa12_transfer_t))) of
  | Some(contr) -> contr
  | None        -> (failwith("Fa12-transfer-404") : contract(fa12_transfer_t))
  end

function get_fa2_token_transfer_entrypoint(
  const token           : address)
                        : contract(fa2_transfer_t) is
  case (Tezos.get_entrypoint_opt("%transfer", token) : option(contract(fa2_transfer_t))) of
  | Some(contr) -> contr
  | None        -> (failwith("Fa2-transfer-404") : contract(fa2_transfer_t))
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
  const id              : nat)
                        : fa2_transfer_t is
  FA2_transfer(list [
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
  ])

function transfer_tez(
  const to_             : address;
  const amt             : nat)
                        : operation is
  Tezos.transaction(
    unit,
    amt * 1mutez,
    (get_contract(to_) : contract(unit))
  )

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
  const id              : nat)
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
  | Tez         -> transfer_tez(to_, amt)
  | Fa12(token) -> transfer_fa12(from_, to_, amt, token)
  | Fa2(token) -> transfer_fa2(from_, to_, amt, token.token, token.id)
  end
