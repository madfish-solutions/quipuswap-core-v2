function call_auction(
  const action          : action_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    const id : nat = case action of
    (* AUCTION *)
    | Receive_fee(_)          -> 0n
    | Launch_auction(_)       -> 1n
    | Place_bid(_)            -> 2n
    | Claim(_)                -> 3n
    (* ADMIN *)
    | Set_admin(_)            -> 4n
    | Confirm_admin(_)        -> 5n
    | Set_baker(_)            -> 6n
    | Set_fees(_)             -> 7n
    | Set_auction_duration(_) -> 8n
    | Set_min_bid(_)          -> 9n
    | Update_whitelist(_)     -> 10n
    | Withdraw_dev_fee(_)     -> 11n
    | Withdraw_public_fee(_)  -> 12n
    | Burn_bid_fee(_)         -> 13n
    end;

    const lambda_bytes : bytes = case s.auction_lambdas[id] of
    | Some(v) -> v
    | None    -> failwith(Auction.err_unknown_func)
    end;

    const res : return_t = case (Bytes.unpack(lambda_bytes) : option(auction_func_t)) of
    | Some(f) -> f(action, s.storage)
    | None    -> failwith(Auction.err_cant_unpack_lambda)
    end;

    s.storage := res.1;
  } with (res.0, s)

function setup_func(
  const params          : setup_func_t;
  var s                 : full_storage_t)
                        : full_return_t is
  block {
    assert_with_error(params.idx <= auction_methods_max_index, Auction.err_high_func_index);

    case s.auction_lambdas[params.idx] of
    | Some(_) -> failwith(Auction.err_func_set)
    | None    -> s.auction_lambdas[params.idx] := params.func_bytes
    end;
  } with ((nil : list(operation)), s)
