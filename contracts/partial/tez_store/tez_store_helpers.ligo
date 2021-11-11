[@inline] function get_baker_or_default(
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

[@inline] function get_user_or_default(
  const user            : address;
  const users           : big_map(address, user_t))
                        : user_t is
  case users[user] of
  | None        -> record [
    candidate = (None : option(key_hash));
    tez_bal   = 0n;
    votes     = 0n;
  ]
  | Some(user) -> user
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

function get_pair_total_supply(
  const response        : list(total_supply_res_t);
  const pair_id         : token_id_t)
                        : nat is
  block {
    var total_supply : nat := 0n;

    function get_total_supply(
      var total_supply  : nat;
      const v           : total_supply_res_t)
                        : nat is
      block {
        if v.request = pair_id
        then total_supply := v.total_supply
        else skip;
      } with total_supply;

    total_supply := List.fold(get_total_supply, response, total_supply);
  } with total_supply

function update_rewards(
  var s                 : storage_t)
                        : storage_t is
  block {
    const total_supply_response : list(total_supply_res_t) =
      case (Tezos.call_view("get_total_supply", list [s.pair_id], s.dex_core) : option(list(total_supply_res_t))) of
    | Some(v) -> v
    | None    -> failwith(TezStore.err_dex_core_get_total_supply_view_404)
    end;
    const total_supply : nat = get_pair_total_supply(total_supply_response, s.pair_id);
    const rewards_time : nat =
      if Tezos.level > s.period_finish
      then s.period_finish
      else Tezos.level;
    const new_reward : nat = abs(rewards_time - s.last_update_level) * s.reward_per_second;

    s.reward_per_share := s.reward_per_share + new_reward / total_supply;
    s.last_update_level := Tezos.level;

    if Tezos.level > s.period_finish
    then {
      const period_duration : nat = ((abs(Tezos.level - s.period_finish) / Constants.voting_period) + 1n) *
        Constants.voting_period;

      s.reward_per_second :=  s.reward * Constants.precision / period_duration;

      const new_reward : nat = abs(Tezos.level - s.period_finish) * s.reward_per_second;

      s.period_finish := s.period_finish + period_duration;
      s.reward_per_share := s.reward_per_share + new_reward / total_supply;
      s.reward := 0n;
      s.total_reward := s.total_reward + s.reward_per_second * period_duration / Constants.precision;
    }
    else skip;
  } with s
