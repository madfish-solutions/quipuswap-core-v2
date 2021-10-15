[@inline] function has_expired(
  const default_expiry  : seconds_t;
  const user_expiry_opt : option(seconds_t);
  const permit_info     : permit_info_t)
                        : bool is
  block {
    const expiry : seconds_t = case permit_info.expiry of
    | Some(expiry) -> expiry
    | None         -> case user_expiry_opt of
      | Some(user_expiry) -> user_expiry
      | None              -> default_expiry
      end
    end
  } with permit_info.created_at + int(expiry) < Tezos.now

[@inline] function delete_expired_permits(
  const default_expiry  : seconds_t;
  const user            : address;
  const permits         : permits_t)
                        : permits_t is
  case Big_map.find_opt(user, permits) of
  | None               -> permits
  | Some(user_permits) -> block {
    [@inline] function delete_expired_permit(
      const permits     : map(blake2b_hash_t, permit_info_t);
      const key_value   : blake2b_hash_t * permit_info_t)
                        : map(blake2b_hash_t, permit_info_t) is
      if has_expired(default_expiry, user_permits.expiry, key_value.1)
      then Map.remove(key_value.0, permits)
      else permits;

    const updated_permits : map(blake2b_hash_t, permit_info_t) = Map.fold(
      delete_expired_permit,
      user_permits.permits,
      user_permits.permits
    );
    const updated_user_permits: user_permits_t = user_permits with record [permits = updated_permits]
  } with Big_map.update(user, Some(updated_user_permits), permits)
  end

function check_duplicates(
  const default_expiry  : seconds_t;
  const user_expiry_opt : option(seconds_t);
  const user_permits    : user_permits_t;
  const permit          : blake2b_hash_t)
                        : unit is
  case Map.find_opt(permit, user_permits.permits) of
  | None              -> unit
  | Some(permit_info) ->
    if not has_expired(default_expiry, user_expiry_opt, permit_info)
    then failwith("DUP_PERMIT")
    else unit
  end

function insert_permit(
  const default_expiry  : seconds_t;
  const user            : address;
  const permit          : blake2b_hash_t;
  const permits         : permits_t)
                        : permits_t is
  block {
    const user_permits : user_permits_t = case Big_map.find_opt(user, permits) of
    | Some(user_permits) -> user_permits
    | None               -> new_user_permits
    end;

    check_duplicates(default_expiry, user_permits.expiry, user_permits, permit);

    const updated_user_permits : user_permits_t = user_permits with record [
      permits = Map.add(
        permit,
        record [
          created_at = Tezos.now;
          expiry     = (None : option(seconds_t));
        ],
        user_permits.permits
      )
    ];
  } with Big_map.update(user, Some(updated_user_permits), permits)

function sender_check(
  const expected_user   : address;
  const s               : storage_t;
  const action          : action_t;
  const err_message     : string)
                        : storage_t is
  if Tezos.sender = expected_user
  then s
  else block {
    const action_hash : blake2b_hash_t = Crypto.blake2b(Bytes.pack(action));
    const user_permits : user_permits_t = case Big_map.find_opt(expected_user, s.permits) of
    | Some(user_permits) -> user_permits
    | None               -> (failwith(err_message) : user_permits_t)
    end;
  } with case Map.find_opt(action_hash, user_permits.permits) of
    | None              -> (failwith(err_message) : storage_t)
    | Some(permit_info) ->
      if has_expired(s.default_expiry, user_permits.expiry, permit_info)
      then (failwith("EXPIRED_PERMIT") : storage_t)
      else s with record [
        permits = Big_map.update(
          expected_user,
          Some(
            user_permits with record [
              permits = Map.remove(action_hash, user_permits.permits)
            ]
          ),
          s.permits
        )
      ]
    end

[@inline] function set_user_default_expiry(
  const user            : address;
  const new_expiry      : seconds_t;
  const permits         : permits_t)
                        : permits_t is
  block {
    const user_permits : user_permits_t = case Big_map.find_opt(user, permits) of
    | Some(user_permits) -> user_permits
    | None               -> new_user_permits
    end;
    const updated_user_permits : user_permits_t = user_permits with record [expiry = Some(new_expiry)];
  } with Big_map.update(user, Some(updated_user_permits), permits)

[@inline] function set_permit_expiry_with_check(
  const permit_info     : permit_info_t;
  const new_expiry      : seconds_t)
                        : option(permit_info_t) is
  block {
    const permit_age: int = Tezos.now - permit_info.created_at;
  } with
    if permit_age >= int(new_expiry)
    then (None : option(permit_info_t))
    else Some(permit_info with record [expiry = Some(new_expiry)])

function set_permit_expiry(
  const user            : address;
  const permit          : blake2b_hash_t;
  const new_expiry      : seconds_t;
  const permits         : permits_t;
  const default_expiry  : seconds_t)
                        : permits_t is
  if new_expiry < permit_expiry_limit
  then case Big_map.find_opt(user, permits) of
  | None               -> permits
  | Some(user_permits) -> case Map.find_opt(permit, user_permits.permits) of
    | None              -> permits
    | Some(permit_info) -> block {
      const updated_user_permits : user_permits_t = if has_expired(default_expiry, user_permits.expiry, permit_info)
        then user_permits
        else user_permits with record [
          permits = Map.update(
            permit,
            set_permit_expiry_with_check(permit_info, new_expiry),
            user_permits.permits
          )
        ];
    } with Big_map.update(user, Some(updated_user_permits), permits)
    end
  end
  else (failwith("EXPIRY_TOO_BIG") : permits_t)
