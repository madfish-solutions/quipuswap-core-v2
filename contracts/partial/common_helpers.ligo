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
