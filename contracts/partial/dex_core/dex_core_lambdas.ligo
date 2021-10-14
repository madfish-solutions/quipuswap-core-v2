const deploy_tez_store : deploy_tez_store_t =
[%Michelson(
  {|
    {
      UNPPAIIR;
      CREATE_CONTRACT
#include "../../compiled/tez_store.tz"
      ;
      PAIR;
    }
  |} : deploy_tez_store_t
)];

function launch_exchange(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops: list(operation) := nil;

    case action of
    | Launch_exchange(params) -> {
        if params.pair.token_a >= params.pair.token_b
        then failwith("Dex/wrong-pair-order")
        else skip;

        const pair_info : (pair_t * nat) = get_pair_info(params.pair, s.token_to_id, s.pairs, s.tokens_count);
        var pair : pair_t := pair_info.0;
        const token_id : nat = pair_info.1;

        if s.tokens_count = token_id
        then {
          s.token_to_id[Bytes.pack(params.pair)] := token_id;
          s.tokens_count := s.tokens_count + 1n;
        }
        else skip;

        if (params.pair.token_a = Tez and Tezos.amount < 1mutez) or params.token_a_in < 1n
        then failwith("Dex/no-token-a-in")
        else skip;

        if params.token_b_in < 1n
        then failwith("Dex/no-token-b-in")
        else skip;

        if pair.total_supply =/= 0n
        then failwith("Dex/pair-exist")
        else skip;

        const init_shares : nat =
          if params.token_a_in < params.token_b_in
          then params.token_a_in
          else params.token_b_in;

        pair.token_a_pool := params.token_a_in;
        pair.token_b_pool := params.token_b_in;
        pair.total_supply := init_shares;

        s.ledger[(Tezos.sender, token_id)] := init_shares;
        s.tokens[token_id] := params.pair;

        if params.pair.token_a = Tez
        then {
          const tez_store_storage : tez_store_t = record [
            a = 0n;
          ];
          const deploy_res : (operation * address) = deploy_tez_store(
            (None : option(key_hash)),
            Tezos.amount,
            tez_store_storage
          );

          pair.tez_store := Some(deploy_res.1);

          ops := transfer_token(
            Tezos.sender,
            deploy_res.1,
            Tezos.amount / 1mutez,
            params.pair.token_a
          ) # ops;
          ops := deploy_res.0 # ops;
        }
        else skip;

        s.pairs[token_id] := pair;

        if params.pair.token_a =/= Tez
        then {
          ops := transfer_token(
            Tezos.sender,
            Tezos.self_address,
            params.token_a_in,
            params.pair.token_a
          ) # ops;
        }
        else skip;

        ops := transfer_token(
          Tezos.sender,
          Tezos.self_address,
          params.token_b_in,
          params.pair.token_b
        ) # ops;
      }
    | _ -> skip
    end
  } with (ops, s)

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
  } with ((nil : list(operation)), s)

function confirm_admin(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
    | Confirm_admin -> {
        only_pending_admin(s.pending_admin);

        s.admin := s.pending_admin;
        s.pending_admin := Constants.zero_address;
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)

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
  } with ((nil : list(operation)), s)

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
  } with ((nil : list(operation)), s)

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
  } with ((nil : list(operation)), s)

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
  } with ((nil : list(operation)), s)

function ban_bakers(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    case action of
      Ban_bakers(params) -> {
        only_admin(s.admin);

        function ban_baker(
          var s           : storage_t;
          const params    : ban_baker_t)
                          : storage_t is
          block {
            var baker : baker_t := get_baker(params.baker, s.bakers);

            baker.ban_period := params.ban_period;
            baker.ban_start_time := Tezos.now;

            s.bakers[params.baker] := baker;
          } with s;

        s := List.fold(ban_baker, params, s);
      }
    | _ -> skip
    end
  } with ((nil : list(operation)), s)
