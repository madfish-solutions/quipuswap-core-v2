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

function get_user_reward_info_or_default(
  const user_address    : address;
  const users_rewards   : big_map(address, user_reward_info_t))
                        : user_reward_info_t is
  case users_rewards[user_address] of
  | None                   -> record [
      reward         = 0n;
      reward_paid    = 0n;
    ]
  | Some(user_reward_info) -> user_reward_info
  end

function get_baker_registry_validate_entrypoint(
  const baker_registry  : address)
                        : contract(key_hash) is
  case (Tezos.get_entrypoint_opt("%validate", baker_registry) : option(contract(key_hash))) of
  | Some(contr) -> contr
  | None        -> (failwith(TezStore.err_baker_registry_validate_entrypoint_404) : contract(key_hash))
  end

function get_pair_total_supply(
  const dex_core        : address;
  const pair_id         : token_id_t)
                        : nat is
  block {
    const total_supply_response : list(total_supply_res_t) =
      case (Tezos.call_view("get_total_supply", list [pair_id], dex_core) : option(list(total_supply_res_t))) of
    | Some(v) -> v
    | None    -> failwith(TezStore.err_dex_core_get_total_supply_view_404)
    end;

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

function get_voting_period(
  const dex_core        : address)
                        : nat is
  block {
    const voting_period : nat = case (Tezos.call_view("get_voting_period", Unit, dex_core) : option(nat)) of
    | Some(v) -> v
    | None    -> failwith(TezStore.err_dex_core_get_voting_period_view_404)
    end;
  } with voting_period

function get_collecting_period(
  const dex_core        : address)
                        : nat is
  block {
    const collecting_period : nat = case (Tezos.call_view("get_collecting_period", Unit, dex_core) : option(nat)) of
    | Some(v) -> v
    | None    -> failwith(TezStore.err_dex_core_get_collecting_period_view_404)
    end;
  } with collecting_period

function get_cycle_duration(
  const dex_core        : address)
                        : nat is
  block {
    const cycle_duration : nat = case (Tezos.call_view("get_cycle_duration", Unit, dex_core) : option(nat)) of
    | Some(v) -> v
    | None    -> failwith(TezStore.err_dex_core_get_cycle_duration_view_404)
    end;
  } with cycle_duration

function update_rewards(
  var new_amount        : nat;
  var s                 : storage_t)
                        : storage_t is
  block {
    const total_supply : nat = get_pair_total_supply(s.dex_core, s.pair_id);
    const rewards_level : nat =
      if Tezos.level > s.collecting_period_ends
      then s.collecting_period_ends
      else Tezos.level;
    const new_reward : nat = get_nat_or_fail(rewards_level - s.last_update_level) * s.reward_per_block;

    s.reward_per_share := s.reward_per_share + new_reward / total_supply;
    s.next_reward := s.next_reward + new_amount;
    s.last_update_level := Tezos.level;

    if Tezos.level > s.collecting_period_ends
    then {
      const collecting_period : nat = get_collecting_period(s.dex_core);
      const period_duration : nat = ((get_nat_or_fail(Tezos.level - s.collecting_period_ends) / collecting_period) + 1n) *
        collecting_period * get_cycle_duration(s.dex_core);

      s.reward_per_block :=  s.next_reward * Constants.precision / period_duration;

      const new_reward : nat = get_nat_or_fail(Tezos.level - s.collecting_period_ends) * s.reward_per_block;

      s.collecting_period_ends := s.collecting_period_ends + collecting_period;
      s.reward_per_share := s.reward_per_share + new_reward / total_supply;
      s.total_reward := s.total_reward + s.reward_per_block * period_duration / Constants.precision;
      s.next_reward := 0n;
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
    var user_reward_info : user_reward_info_t := get_user_reward_info_or_default(user_address, s.users_rewards);
    const current_reward : nat = current_balance * s.reward_per_share;

    user_reward_info.reward := user_reward_info.reward + get_nat_or_fail(current_reward - user_reward_info.reward_paid);
    user_reward_info.reward_paid := new_balance * s.reward_per_share;

    s.users_rewards[user_address] := user_reward_info;
  } with s