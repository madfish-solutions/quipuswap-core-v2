(* An alternative to `default` entrypoint, which doesn't affect rewards *)
function fill(
  const s               : storage_t)
                        : return_t is
  ((nil : list(operation)), s)

function pour_out(
  const params          : pour_out_t;
  const s               : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);
    non_payable(Unit);
  } with (list [transfer_tez(params.receiver, params.amt)], s)

function pour_over(
  const params          : pour_over_t;
  const s               : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);
    non_payable(Unit);
  } with (list [get_fill_op(params.amt * 1mutez, params.bucket)], s)

function withdraw_rewards(
  const params          : withdraw_rewards_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);
    non_payable(Unit);

    const user : user_t = unwrap_or(s.users[params.user], Constants.default_user);

    s := update_rewards(s);
    s := update_user_reward(params.user, user.votes, user.votes, s);

    var user_reward_info : user_reward_info_t := unwrap_or(
      s.users_rewards[params.user],
      Constants.default_user_reward_info
    );
    var ops : list(operation) := (nil : list(operation));

    if user_reward_info.reward_f > Constants.precision
    then {
      const reward : nat = user_reward_info.reward_f / Constants.precision;

      user_reward_info.reward_f := get_nat_or_fail(user_reward_info.reward_f - reward * Constants.precision);

      s.reward_paid := s.reward_paid + reward;

      ops := transfer_tez(params.receiver, reward) # ops
    }
    else skip;

    s.users_rewards[params.user] := user_reward_info;
  } with (ops, s)

function ban_baker(
  const params          : ban_baker_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);
    non_payable(Unit);

    var baker : baker_t := unwrap_or(s.bakers[params.baker], Constants.default_baker);

    baker.ban_end_time := Tezos.now + int(params.ban_period);

    s.bakers[params.baker] := baker;
  } with ((nil : list(operation)), s)

function vote(
  const params          : vote_t;
  var s                 : storage_t)
                        : return_t is
  block {
    only_dex_core(s.dex_core);
    non_payable(Unit);

    var user : user_t := unwrap_or(s.users[params.voter], Constants.default_user);

    s.total_supply := get_nat_or_fail(s.total_supply - user.votes);
    s.total_supply := s.total_supply + params.votes;

    s := update_rewards(s);
    s := update_user_reward(params.voter, user.votes, params.votes, s);

    case user.candidate of [
      None                 -> skip
    | Some(user_candidate) -> {
      var candidate : baker_t := unwrap_or(s.bakers[user_candidate], Constants.default_baker);
      const candidate_new_votes : nat = get_nat_or_fail(candidate.votes - user.votes);

      s.bakers[user_candidate] := candidate with record [ votes = candidate_new_votes ];
    }
    ];


    var user_candidate : baker_t := unwrap_or(s.bakers[params.candidate], Constants.default_baker);
    const user_candidate_votes : nat = user_candidate.votes + params.votes;

    user_candidate.votes := user_candidate_votes;

    s.bakers[params.candidate] := user_candidate;

    user.votes := params.votes;

    if user.votes =/= 0n
    then user.candidate := Some(params.candidate)
    else user.candidate := (None : option(key_hash));

    s.users[params.voter] := user;

    const current_delegated : baker_t = unwrap_or(s.bakers[s.current_delegated], Constants.default_baker);
    const next_candidate : baker_t = unwrap_or(s.bakers[s.next_candidate], Constants.default_baker);

    if user_candidate_votes > current_delegated.votes
    then {
      s.next_candidate := s.current_delegated;
      s.current_delegated := params.candidate;
    }
    else if user_candidate.votes > next_candidate.votes and params.candidate =/= s.current_delegated
    then s.next_candidate := params.candidate
    else if next_candidate.votes > current_delegated.votes
    then {
      const tmp : key_hash = s.current_delegated;

      s.current_delegated := s.next_candidate;
      s.next_candidate := tmp;
    }
    else skip;

    var ops: list(operation) := nil;

    if params.execute_voting
    then {
      if check_is_banned_baker(unwrap_or(s.bakers[s.next_candidate], Constants.default_baker))
      then s.next_candidate := Constants.zero_key_hash
      else skip;

      if check_is_banned_baker(unwrap_or(s.bakers[s.current_delegated], Constants.default_baker))
      then {
        ops := list [
          Tezos.set_delegate((None : option(key_hash)))
        ];

        s.current_delegated := Constants.zero_key_hash;
        s.previous_delegated := Constants.zero_key_hash;
      }
      else {
        if s.current_delegated =/= s.previous_delegated
        then {
          ops := list [
            get_baker_registry_validate_op(s.current_delegated, s.baker_registry);
            Tezos.set_delegate(Some(s.current_delegated))
          ];

          s.previous_delegated := s.current_delegated;
        }
        else skip;
      };
    }
    else skip;
  } with (ops, s)

function default(
  var s                 : storage_t)
                        : return_t is
  block {
    s.next_reward := s.next_reward + (Tezos.amount / 1mutez);

    s := update_rewards(s);
  } with ((nil : list(operation)), s)
