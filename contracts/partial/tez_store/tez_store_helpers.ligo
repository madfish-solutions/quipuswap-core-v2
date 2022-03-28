function check_is_banned_baker(
  const baker           : baker_t)
                        : bool is
  baker.ban_start_time + int(baker.ban_period) > Tezos.now

function get_baker_registry_validate_entrypoint(
  const baker_registry  : address)
                        : contract(key_hash) is
  unwrap(
    (Tezos.get_entrypoint_opt("%validate", baker_registry) : option(contract(key_hash))),
    TezStore.err_baker_registry_validate_entrypoint_404
  )

function get_baker_registry_validate_op(
  const baker           : key_hash;
  const baker_registry  : address)
                        : operation is
  Tezos.transaction(baker, 0mutez, get_baker_registry_validate_entrypoint(baker_registry))

[@inline] function get_pair_total_supply(
  const dex_core        : address;
  const pair_id         : token_id_t)
                        : nat is
  block {
    const total_supply_response : list(total_supply_res_t) = unwrap(
      (Tezos.call_view("get_total_supply", list [pair_id], dex_core) : option(list(total_supply_res_t))),
      TezStore.err_dex_core_get_total_supply_view_404
    );

    function get_total_supply(
      var total_supply  : nat;
      const v           : total_supply_res_t)
                        : nat is
      block {
        if v.request = pair_id
        then total_supply := v.total_supply
        else skip;
      } with total_supply;
  } with List.fold(get_total_supply, total_supply_response, 0n)

[@inline] function get_voting_period(
  const dex_core        : address)
                        : nat is
  unwrap(
    (Tezos.call_view("get_voting_period", Unit, dex_core) : option(nat)),
    TezStore.err_dex_core_get_voting_period_view_404
  )

[@inline] function get_collecting_period(
  const dex_core        : address)
                        : nat is
  unwrap(
    (Tezos.call_view("get_collecting_period", Unit, dex_core) : option(nat)),
    TezStore.err_dex_core_get_collecting_period_view_404
  )

[@inline] function get_cycle_duration(
  const dex_core        : address)
                        : nat is
  unwrap(
    (Tezos.call_view("get_cycle_duration", Unit, dex_core) : option(nat)),
    TezStore.err_dex_core_get_cycle_duration_view_404
  )

function update_rewards(
  var s                 : storage_t)
                        : storage_t is
  block {
    const total_supply : nat = get_pair_total_supply(s.dex_core, s.pair_id);

    if total_supply > 0n
    then {
      const rewards_level : nat =
        if Tezos.level > s.collecting_period_end
        then s.collecting_period_end
        else Tezos.level;
      const new_reward : nat = get_nat_or_fail(rewards_level - s.last_update_level) * s.reward_per_block;

      s.reward_per_share := s.reward_per_share + (new_reward / total_supply);
      s.last_update_level := Tezos.level;

      if Tezos.level > s.collecting_period_end
      then {
        const collecting_period : nat = get_collecting_period(s.dex_core);
        const period_duration : nat = (
          (get_nat_or_fail(Tezos.level - s.collecting_period_end) / collecting_period) + 1n
        ) * collecting_period * get_cycle_duration(s.dex_core);

        s.reward_per_block := (s.next_reward * Constants.precision) / period_duration;

        const new_reward : nat = get_nat_or_fail(Tezos.level - s.collecting_period_end) * s.reward_per_block;

        s.collecting_period_end := s.collecting_period_end + period_duration;
        s.reward_per_share := s.reward_per_share + (new_reward / total_supply);
        s.total_reward := s.total_reward + ((s.reward_per_block * period_duration) / Constants.precision);
        s.next_reward := 0n;
      }
      else skip;
    }
    else skip;
  } with s

function update_user_reward(
  const user_address    : address;
  const current_balance : nat;
  const new_balance     : nat;
  var s                 : storage_t)
                        : storage_t is
  block {
    var user_reward_info : user_reward_info_t := unwrap_or(
      s.users_rewards[user_address],
      Constants.default_user_reward_info
    );
    const current_reward : nat = current_balance * s.reward_per_share;

    user_reward_info.reward_f := user_reward_info.reward_f + get_nat_or_fail(
      current_reward - user_reward_info.reward_paid_f
    );
    user_reward_info.reward_paid_f := new_balance * s.reward_per_share;

    s.users_rewards[user_address] := user_reward_info;
  } with s
