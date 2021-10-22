function invest_tez(
  const user            : invest_tez_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    const voter : voter_t = get_voter(user, s.voters);

    s.voters[user] := voter with record [ tez_bal = voter.tez_bal + Tezos.amount / 1mutez ];
  } with ((nil : list(operation)), s)

function divest_tez(
  const params          : divest_tez_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    const voter : voter_t = get_voter(params.user, s.voters);

    if params.amt > Tezos.balance / 1mutez or params.amt > voter.tez_bal
    then failwith(TezStore.err_insufficient_tez_balance)
    else skip;

    s.voters[params.user] := voter with record [ tez_bal = abs(voter.tez_bal - params.amt)];
  } with (list [transfer_tez(params.recipient, params.amt)], s)

function ban_baker(
  const params          : ban_baker_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    var baker : baker_t := get_baker(params.baker, s.bakers);

    baker.ban_period := params.ban_period;
    baker.ban_start_time := Tezos.now;

    s.bakers[params.baker] := baker;
  } with ((nil : list(operation)), s)

function vote(
  const params          : vote_t;
  var s                 : storage_t)
                        : return_t is
  block {
    const prev_current_delegated : key_hash = s.current_delegated;
    var ops: list(operation) := nil;

    only_dex_core(s.dex_core);

    var voter : voter_t := get_voter(params.voter, s.voters);

    case voter.candidate of
      None            -> skip
    | Some(voter_candidate) -> {
      var candidate : baker_t := get_baker(voter_candidate, s.bakers);

      s.bakers[voter_candidate] := case is_nat(candidate.votes - voter.votes) of
      | None        -> candidate
      | Some(value) -> candidate with record [ votes = value ]
      end;
    }
    end;

    const voter_candidate : baker_t = get_baker(params.candidate, s.bakers);
    const voter_candidate_votes : nat = voter_candidate.votes + params.votes;

    s.bakers[params.candidate] := voter_candidate;

    if voter.votes =/= 0n
    then voter.candidate := Some(params.candidate)
    else voter.candidate := (None : option(key_hash));

    voter.votes := params.votes;

    s.voters[params.voter] := voter;

    const current_delegated : baker_t = get_baker(s.current_delegated, s.bakers);
    const next_candidate : baker_t = get_baker(s.next_candidate, s.bakers);

    if voter_candidate_votes > current_delegated.votes
    then {
      s.next_candidate := s.current_delegated;
      s.current_delegated := params.candidate;
    }
    else if voter_candidate.votes > next_candidate.votes
    then {
      s.next_candidate := params.candidate;
    }
    else if next_candidate.votes > current_delegated.votes
    then {
      const tmp : key_hash = s.current_delegated;

      s.current_delegated := s.next_candidate;
      s.next_candidate := tmp;
    }
    else skip;

    if get_is_banned_baker(next_candidate)
    then s.next_candidate := Constants.zero_key_hash
    else skip;

    if get_is_banned_baker(current_delegated)
    then {
      ops := list [
        Tezos.set_delegate((None : option(key_hash)))
      ];

      s.current_delegated := Constants.zero_key_hash;
    }
    else {
      if s.current_delegated =/= prev_current_delegated
      then {
        ops := list [
          Tezos.transaction(
            s.current_delegated,
            0mutez,
            get_baker_registry_validate_entrypoint(s.baker_registry)
          );
          Tezos.set_delegate(Some(s.current_delegated))
        ];
      }
      else skip;
    };
  } with (ops, s)

function is_banned_baker(
  const params          : is_banned_baker_t;
  const s               : storage_t)
                        : return_t is
  (list [
    Tezos.transaction(
      get_is_banned_baker(get_baker(params.baker, s.bakers)),
      0mutez,
      params.callback
    )
  ], s)
