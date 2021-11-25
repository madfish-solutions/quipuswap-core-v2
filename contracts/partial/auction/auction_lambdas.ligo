(* AUCTION *)

function receive_fee(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Receive_fee(params) -> {
        only_dex_core(s.dex_core);

        const dev_fee : nat = params.fee * s.fees.dev_fee / Constants.precision;

        s.dev_fee_balance[params.token] := get_fee(params.token, s.dev_fee_balance) + dev_fee;
        s.public_fee_balance[params.token] := get_fee(params.token, s.public_fee_balance) +
          get_nat_or_fail(params.fee - dev_fee);
      }
    | _ -> skip
    end
  } with (ops, s)

function launch_auction(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Launch_auction(params) -> {
        is_not_whitelisted_token(params.token, s.whitelist);

        const token_balance : nat = get_fee(params.token, s.public_fee_balance);

        assert_with_error(params.amt <= token_balance, Auction.err_insufficient_balance);
        assert_with_error(params.bid >= s.min_bid, Auction.err_low_bid);

        s.auctions[s.auctions_count] := record[
          status         = Active;
          token          = params.token;
          start_time     = Tezos.now;
          current_bidder = Tezos.sender;
          current_bid    = params.bid;
          amt            = params.amt;
        ];
        s.auctions_count := s.auctions_count + 1n;
        s.public_fee_balance[params.token] := get_nat_or_fail(token_balance - params.amt);

        ops := transfer_fa2(Tezos.sender, Tezos.self_address, params.bid, s.quipu_token, s.quipu_token_id) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)

function place_bid(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Place_bid(params) -> {
        var auction : auction_t := get_auction(params.auction_id, s.auctions);

        assert_with_error(Tezos.now < auction.start_time + s.auction_duration, Auction.err_auction_finished);
        assert_with_error(params.amt > auction.current_bid, Auction.err_low_bid);

        const burn_fee : nat = auction.current_bid * s.fees.bid_fee / Constants.precision;

        s.bid_fee_balance := s.bid_fee_balance + burn_fee;

        const refund : nat = abs(auction.current_bid - burn_fee);

        ops := transfer_fa2(Tezos.sender, Tezos.self_address, params.amt, s.quipu_token, s.quipu_token_id) # ops;
        ops := transfer_fa2(Tezos.self_address, auction.current_bidder, refund, s.quipu_token, s.quipu_token_id) # ops;

        s.auctions[params.auction_id] := auction with record[
          current_bid    = params.amt;
          current_bidder = Tezos.sender;
        ];
      }
    | _ -> skip
    end
  } with (ops, s)

function claim(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Claim(auction_id) -> {
        var auction : auction_t := get_auction(auction_id, s.auctions);

        assert_with_error(Tezos.now >= auction.start_time + s.auction_duration, Auction.err_auction_not_finished);
        assert_with_error(auction.status =/= Finished, Auction.err_auction_finished);

        ops := transfer_fa2(
          Tezos.self_address,
          Constants.zero_address,
          auction.current_bid,
          s.quipu_token,
          s.quipu_token_id
        ) # ops;
        ops := transfer_token(Tezos.self_address, auction.current_bidder, auction.amt, auction.token) # ops;

        s.auctions[auction_id] := auction with record[ status = Finished ];
      }
    | _ -> skip
    end
  } with (ops, s)

(* ADMIN *)

function set_admin(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_admin(admin) -> {
        only_admin(s.admin);

        s.pending_admin := admin;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function confirm_admin(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Confirm_admin -> {
        only_pending_admin(s.pending_admin);

        s.admin := s.pending_admin;
        s.pending_admin := Constants.zero_address;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function set_baker(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Set_baker(baker) -> {
        only_admin(s.admin);

        if s.baker =/= baker
        then {
          s.baker := baker;

          if s.baker = Constants.zero_key_hash
          then ops := Tezos.set_delegate((None : option(key_hash))) # ops
          else ops := Tezos.set_delegate(Some(s.baker)) # ops;
        }
        else skip;
      }
    | _ -> skip
    end
  } with (ops, s)

function set_fees(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_fees(fees) -> {
        only_admin(s.admin);

        s.fees := fees;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function set_auction_duration(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_auction_duration(auction_duration) -> {
        only_admin(s.admin);

        s.auction_duration := auction_duration;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function set_min_bid(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_min_bid(min_bid) -> {
        only_admin(s.admin);

        s.min_bid := min_bid;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function update_whitelist(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Update_whitelist(params) -> {
        only_admin(s.admin);

        s.whitelist := Set.update(params.token, params.add, s.whitelist);
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

function withdraw_dev_fee(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Withdraw_dev_fee(params) -> {
        only_admin(s.admin);

        const dev_fee_balance : nat = get_fee(params.token, s.dev_fee_balance);

        if dev_fee_balance =/= 0n
        then ops := transfer_token(Tezos.self_address, params.receiver, dev_fee_balance, params.token) # ops
        else skip;

        s.dev_fee_balance[params.token] := 0n;
      }
    | _ -> skip
    end
  } with (ops, s)

function withdraw_public_fee(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Withdraw_public_fee(params) -> {
        only_admin(s.admin);
        is_whitelisted_token(params.token, s.whitelist);

        const public_fee_balance : nat = get_fee(params.token, s.public_fee_balance);

        if public_fee_balance =/= 0n
        then ops := transfer_token(Tezos.self_address, params.receiver, public_fee_balance, params.token) # ops
        else skip;

        s.public_fee_balance[params.token] := 0n;
      }
    | _ -> skip
    end
  } with (ops, s)

function burn_bid_fee(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Burn_bid_fee -> {
        only_admin(s.admin);

        if s.bid_fee_balance =/= 0n
        then {
          ops := transfer_fa2(
            Tezos.self_address,
            Constants.zero_address,
            s.bid_fee_balance,
            s.quipu_token,
            s.quipu_token_id
          ) # ops;
        }
        else skip;

        s.bid_fee_balance := 0n;
      }
    | _ -> skip
    end
  } with (ops, s)
