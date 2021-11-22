function invest_tez(
  const user_address    : invest_tez_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    const user : user_t = get_user_or_default(user_address, s.users);

    s.users[user_address] := user with record [ tez_bal = user.tez_bal + Tezos.amount / 1mutez ];
  } with ((nil : list(operation)), s)

function divest_tez(
  const params          : divest_tez_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    const user : user_t = get_user_or_default(params.user, s.users);

    assert_with_error(
      params.amt <= Tezos.balance / 1mutez and params.amt <= user.tez_bal,
      TezStore.err_insufficient_tez_balance
    );

    s.users[params.user] := user with record [ tez_bal = get_nat_or_fail(user.tez_bal - params.amt)];
  } with (list [transfer_tez(params.receiver, params.amt)], s)

function withdraw_rewards(
  const params          : withdraw_rewards_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    s := update_rewards(0n, s);
    s := update_user_reward(params.user, params.current_balance, params.new_balance, s);

    var user_reward_info : user_reward_info_t := get_user_reward_info_or_default(params.user, s.users_rewards);
    const reward : nat = user_reward_info.reward;

    user_reward_info.reward := get_nat_or_fail(reward - reward / Constants.precision * Constants.precision);

    s.users_rewards[params.user] := user_reward_info;
    s.reward_paid := s.reward_paid + reward / Constants.precision;

    var ops : list(operation) := (nil : list(operation));

    if reward >= Constants.precision
    then {
      ops := Tezos.transaction(
        unit,
        reward / Constants.precision * 1mutez,
        params.receiver
      ) # ops;
    }
    else skip;
  } with (ops, s)

function ban_baker(
  const params          : ban_baker_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    var baker : baker_t := get_baker_or_default(params.baker, s.bakers);

    baker.ban_period := params.ban_period;
    baker.ban_start_time := Tezos.now;

    s.bakers[params.baker] := baker;
  } with ((nil : list(operation)), s)

function vote(
  const params          : vote_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);

    s := update_rewards(0n, s);
    s := update_user_reward(params.voter, params.current_balance, params.new_balance, s);

    const prev_current_delegated : key_hash = s.current_delegated;
    var user : user_t := get_user_or_default(params.voter, s.users);

    case user.candidate of
      None                 -> skip
    | Some(user_candidate) -> {
      var candidate : baker_t := get_baker_or_default(user_candidate, s.bakers);

      s.bakers[user_candidate] := case is_nat(candidate.votes - user.votes) of
      | None        -> candidate
      | Some(value) -> candidate with record [ votes = value ]
      end;
    }
    end;

    const user_candidate : baker_t = get_baker_or_default(params.candidate, s.bakers);
    const user_candidate_votes : nat = user_candidate.votes + params.votes;

    s.bakers[params.candidate] := user_candidate;

    if user.votes =/= 0n
    then user.candidate := Some(params.candidate)
    else user.candidate := (None : option(key_hash));

    user.votes := params.votes;

    s.users[params.voter] := user;

    const current_delegated : baker_t = get_baker_or_default(s.current_delegated, s.bakers);
    const next_candidate : baker_t = get_baker_or_default(s.next_candidate, s.bakers);

    if user_candidate_votes > current_delegated.votes
    then {
      s.next_candidate := s.current_delegated;
      s.current_delegated := params.candidate;
    }
    else if user_candidate.votes > next_candidate.votes and params.candidate =/= s.current_delegated
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

    var ops: list(operation) := nil;

    if Tezos.level >= s.voting_period_ends and params.execute_voting
    then {
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

      s.voting_period_ends := Tezos.level + (get_cycle_duration(s.dex_core) * get_voting_period(s.dex_core));
    }
    else skip;
  } with (ops, s)

function default(
  var s                 : storage_t)
                        : return_t is
  block {
    s := update_rewards(Tezos.amount / 1mutez, s);
  } with ((nil : list(operation)), s)
