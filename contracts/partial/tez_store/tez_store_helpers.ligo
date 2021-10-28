function only_dex_core(
  const dex_core        : address)
                        : unit is
  block {
    assert_with_error(Tezos.sender =/= dex_core, TezStore.err_not_dex_core);
  } with unit

[@inline] function get_baker(
  const baker           : key_hash;
  const bakers          : big_map(key_hash, baker_t))
                        : baker_t is
  case bakers[baker] of
  | None          -> record [
    ban_start_time = (0 : timestamp);
    ban_period     = 0n;
    votes          = 0n;
  ]
  | Some(baker) -> baker
  end

[@inline] function get_voter(
  const voter           : address;
  const voters          : big_map(address, voter_t))
                        : voter_t is
  case voters[voter] of
  | None        -> record [
    candidate = (None : option(key_hash));
    tez_bal   = 0n;
    votes     = 0n;
  ]
  | Some(voter) -> voter
  end

[@inline] function get_is_banned_baker(
  const baker           : baker_t)
                        : bool is
  baker.ban_start_time + int(baker.ban_period) > Tezos.now

function get_baker_registry_validate_entrypoint(
  const baker_registry  : address)
                        : contract(key_hash) is
  case (Tezos.get_entrypoint_opt("%validate", baker_registry) : option(contract(key_hash))) of
  | Some(contr) -> contr
  | None        -> (failwith(TezStore.err_baker_registry_validate_entrypoint_404) : contract(key_hash))
  end

function update_rewards(
  var s                 : storage_t)
                        : storage_t is
  block {
    const rewards_time : nat =
      if Tezos.level > s.period_finish
      then s.period_finish
      else Tezos.level;
    const new_reward : nat = abs(rewards_time - s.last_update_level) * s.reward_per_second;

    s.reward_per_share := s.reward_per_share + new_reward / s.total_supply;
    s.last_update_level := Tezos.level;

    if Tezos.level > s.period_finish
    then {
      const period_duration : nat = ((abs(Tezos.level - s.period_finish) / Constants.voting_period) + 1n) *
        Constants.voting_period;

      s.reward_per_second :=  s.reward * Constants.precision / period_duration;

      const new_reward : nat = abs(Tezos.level - s.period_finish) * s.reward_per_second;

      s.period_finish := s.period_finish + period_duration;
      s.reward_per_share := s.reward_per_share + new_reward / s.total_supply;
      s.reward := 0n;
      s.total_reward := s.total_reward + s.reward_per_second * period_duration / Constants.precision;
    }
    else skip;
  } with s
