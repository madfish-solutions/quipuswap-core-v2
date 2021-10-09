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
  } with (no_operations, s)

function confirm_admin(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Confirm_admin -> {
        only_pending_admin(s.pending_admin);

        s.admin := s.pending_admin;
        s.pending_admin := zero_address;
      }
    | _ -> skip
    end
  } with (no_operations, s)

function add_managers(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Add_managers(params) -> {
        only_admin(s.admin);

        function add_manager(
          var s         : storage_t;
          const param   : add_manager_t)
                        : storage_t is
          block {
            s.managers := Set.update(param.manager, param.add, s.managers);
          } with s;

        s := List.fold(add_manager, params, s);
      }
    | _ -> skip
    end
  } with (no_operations, s)

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
  } with (no_operations, s)

function set_cycle_duration(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Set_cycle_duration(cycle_duration) -> {
        only_admin(s.admin);

        s.cycle_duration := cycle_duration;
      }
    | _ -> skip
    end
  } with (no_operations, s)

function update_token_metadata(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Update_token_metadata(params) -> {
        only_manager(s.managers);

        function upd_token_metadata(
          var metadata  : token_metadata_t;
          const pair    : metadata_pair_t)
                        : token_metadata_t is
          block {
            metadata.token_info[pair.key] := pair.value;
          } with metadata;

        var metadata : token_metadata_t := get_token_metadata(params.token_id, s.token_metadata);

        metadata := List.fold(upd_token_metadata, params.token_info, metadata);

        s.token_metadata[params.token_id] := metadata;
      }
    | _ -> skip
    end
  } with (no_operations, s)
