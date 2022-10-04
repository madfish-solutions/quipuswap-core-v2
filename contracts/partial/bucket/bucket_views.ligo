[@view] function is_banned_baker(
  const baker           : is_banned_baker_t;
  const s               : storage_t)
                        : bool is
  check_is_banned_baker(unwrap_or(s.bakers[baker], Constants.default_baker))

[@view] function get_tez_balance(
  const _               : unit;
  const _s              : storage_t)
                        : nat is
  Tezos.balance / 1mutez

[@view] function get_user_candidate(
  const user_addr       : address;
  const s               : storage_t)
                        : key_hash is
  block {
    const user : user_t = unwrap_or(s.users[user_addr], Constants.default_user);
  } with unwrap_or(user.candidate, s.current_delegated)

[@view] function get_user_reward(
  const user_addr       : address;
  const s               : storage_t)
                        : nat is
  if s.total_supply > 0n
  then block {

    const rewards_level : nat =
      if Tezos.level > s.collecting_period_end
      then s.collecting_period_end
      else Tezos.level;
    const new_reward : nat = get_nat_or_fail(rewards_level - s.last_update_level) * s.reward_per_block;

    var reward_per_share := s.reward_per_share + (new_reward / s.total_supply);

    if Tezos.level > s.collecting_period_end
    then {
      const collecting_period : nat = get_collecting_period(s.dex_core);
      const period_duration : nat = (
        (get_nat_or_fail(Tezos.level - s.collecting_period_end) / collecting_period) + 1n
      ) * collecting_period;

      const reward_per_block = (s.next_reward * Constants.precision) / period_duration;

      const new_reward : nat = get_nat_or_fail(Tezos.level - s.collecting_period_end) * s.reward_per_block;

      reward_per_share := s.reward_per_share + (new_reward / s.total_supply);
    } else skip;
    var user_reward_info : user_reward_info_t := unwrap_or(
      s.users_rewards[user_addr],
      Constants.default_user_reward_info
    );

    const user : user_t = unwrap_or(s.users[user_addr], Constants.default_user);

    const current_reward : nat = user.votes * s.reward_per_share;
    const reward : nat = user_reward_info.reward_f + get_nat_or_fail(
      current_reward - user_reward_info.reward_paid_f);
  } with reward / Constants.precision
  else 0n