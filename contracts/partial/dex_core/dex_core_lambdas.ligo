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

(* DEX *)

function launch_exchange(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops: list(operation) := nil;

    case action of
    | Launch_exchange(params) -> {
        if params.pair.token_a >= params.pair.token_b
        then failwith(DexCore.err_wrong_pair_order)
        else skip;

        const pair_info : (pair_t * nat) = get_pair_info(params.pair, s.token_to_id, s.pairs, s.tokens_count);
        var pair : pair_t := pair_info.0;
        const token_id : nat = pair_info.1;

        if s.tokens_count = token_id
        then {
          s.token_to_id[Bytes.pack(params.pair)] := token_id;
          s.tokens_count := s.tokens_count + 1n;

          if params.pair.token_b = Tez
          then {
            const deploy_res : (operation * address) = deploy_tez_store(
              (None : option(key_hash)),
              Tezos.amount,
              get_tez_store_initial_storage(unit)
            );

            ops := deploy_res.0 # ops;

            pair.tez_store := Some(deploy_res.1);
          }
          else skip;
        }
        else skip;

        if params.token_a_in < 1n
        then failwith(DexCore.err_zero_a_in)
        else skip;

        if (params.pair.token_b = Tez and Tezos.amount < 1mutez) or params.token_b_in < 1n
        then failwith(DexCore.err_zero_b_in)
        else skip;

        if pair.total_supply =/= 0n
        then failwith(DexCore.err_pair_listed)
        else skip;

        const init_shares : nat =
          if params.token_a_in < params.token_b_in
          then params.token_a_in
          else params.token_b_in;

        pair.token_a_pool := params.token_a_in;
        pair.token_b_pool := params.token_b_in;
        pair.total_supply := init_shares;

        s.ledger[(params.shares_recipient, token_id)] := init_shares;
        s.tokens[token_id] := params.pair;
        s.pairs[token_id] := pair;

        ops := transfer_token(Tezos.sender, Tezos.self_address, params.token_a_in, params.pair.token_a) # ops;

        if params.pair.token_b =/= Tez
        then ops := transfer_token(Tezos.sender, Tezos.self_address, params.token_b_in, params.pair.token_b) # ops
        else skip;

        if params.pair.token_b = Tez
        then {
          const invest_params : invest_tez_t = record [
            candidate = params.candidate;
            user      = params.shares_recipient;
          ];

          ops := invest_tez(invest_params, Tezos.amount, get_tez_store_or_fail(pair.tez_store)) # ops;
        }
        else skip;
      }
    | _ -> skip
    end
  } with (ops, s)

function invest_liquidity(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops: list(operation) := nil;

    case action of
    | Invest_liquidity(params) -> {
        var pair : pair_t := get_pair(params.pair_id, s.pairs);

        if pair.token_a_pool * pair.token_b_pool = 0n
        then failwith(DexCore.err_no_liquidity)
        else skip;

        if params.shares = 0n
        then failwith(DexCore.err_no_shares_expected)
        else skip;

        const tokens : tokens_t = get_tokens(params.pair_id, s.tokens);
        const tokens_a_required : nat = div_ceil(params.shares * pair.token_a_pool, pair.total_supply);
        const tokens_b_required : nat = div_ceil(params.shares * pair.token_b_pool, pair.total_supply);

        if tokens_a_required > params.token_a_in
        then failwith(DexCore.err_low_token_a_in)
        else skip;

        if (tokens.token_b = Tez and tokens_b_required > Tezos.amount / 1mutez)
          or tokens_b_required > params.token_b_in
        then failwith(DexCore.err_low_token_b_in)
        else skip;

        const sender_balance : nat = get_token_balance(params.shares_recipient, params.pair_id, s.ledger);

        s.ledger[(params.shares_recipient, params.pair_id)] := sender_balance + params.shares;

        pair.token_a_pool := pair.token_a_pool + tokens_a_required;
        pair.token_b_pool := pair.token_b_pool + tokens_b_required;
        pair.total_supply := pair.total_supply + params.shares;

        s.pairs[params.pair_id] := pair;

        ops := transfer_token(Tezos.sender, Tezos.self_address, tokens_a_required, tokens.token_a) # ops;
        ops := check_tez_or_token_and_transfer(params, tokens_b_required, tokens.token_b, pair.tez_store) # ops;
      }
    | _ -> skip
    end;
  } with (ops, s)

function divest_liquidity(
  const action          : action_t;
  var s                 : storage_t)
                        : return_t is
  block {
    var ops: list(operation) := nil;

    case action of
    | Divest_liquidity(params) -> {
        if s.tokens_count = params.pair_id
        then failwith(DexCore.err_pair_not_listed)
        else skip;

        var pair : pair_t := get_pair(params.pair_id, s.pairs);

        if pair.token_a_pool * pair.token_b_pool = 0n
        then failwith(DexCore.err_no_liquidity)
        else skip;

        const sender_balance : nat = get_token_balance(Tezos.sender, params.pair_id, s.ledger);

        if params.shares > sender_balance
        then failwith(DexCore.err_insufficient_lp)
        else skip;

        s.ledger[(Tezos.sender, params.pair_id)] := abs(sender_balance - params.shares);

        const token_a_divested : nat = pair.token_a_pool * params.shares / pair.total_supply;
        const token_b_divested : nat = pair.token_b_pool * params.shares / pair.total_supply;

        if params.min_token_a_out = 0n or params.min_token_b_out = 0n
        then failwith(DexCore.err_dust_out)
        else skip;

        if token_a_divested < params.min_token_a_out or token_b_divested < params.min_token_b_out
        then failwith(DexCore.err_high_min_out)
        else skip;

        pair.token_a_pool := abs(pair.token_a_pool - token_a_divested);
        pair.token_b_pool := abs(pair.token_b_pool - token_b_divested);
        pair.total_supply := abs(pair.total_supply - params.shares);

        s.pairs[params.pair_id] := pair;

        const tokens : tokens_t = get_tokens(params.pair_id, s.tokens);

        ops := transfer_token(Tezos.self_address, params.liquidity_recipient, token_a_divested, tokens.token_a) # ops;
        ops := divest_tez_or_transfer_tokens(
          params.liquidity_recipient,
          token_b_divested,
          tokens.token_b,
          pair.tez_store
        ) # ops;
      }
    | _ -> skip
    end;
  } with (ops, s)

(* ADMIN *)

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

(* VIEWS *)

function get_reserves(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Get_reserves(params) -> {
      function look_up_reserves(
        const l         : list(reserves_res_t);
        const pair_id   : reserves_req_t)
                        : list(reserves_res_t) is
        block {
          if pair_id > s.tokens_count
          then failwith(DexCore.err_pair_not_listed)
          else skip;

          const tokens : tokens_t = get_tokens(pair_id, s.tokens);
          const pair : pair_t = get_pair(pair_id, s.pairs);
          const response : reserves_res_t = record [
            request  = pair_id;
            reserves = record [
              token_a      = tokens.token_a;
              token_b      = tokens.token_b;
              token_a_pool = pair.token_a_pool;
              token_b_pool = pair.token_b_pool;
            ];
          ];
        } with response # l;

      const response : list(reserves_res_t) = List.fold(
        look_up_reserves,
        params.requests,
        (nil : list(reserves_res_t))
      );

      ops := Tezos.transaction(response, 0mutez, params.callback) # ops;
    }
    | _ -> skip
    end
  } with (ops, s)

function get_total_supply(
  const action          : action_t;
  const s               : storage_t)
                        : return_t is
  block {
    var ops : list(operation) := nil;

    case action of
    | Get_total_supply(params) -> {
      function look_up_total_supply(
        const l         : list(total_supply_res_t);
        const pair_id   : total_supply_req_t)
                        : list(total_supply_res_t) is
        block {
          if pair_id > s.tokens_count
          then failwith(DexCore.err_pair_not_listed)
          else skip;

          const pair : pair_t = get_pair(pair_id, s.pairs);
          const response : total_supply_res_t = record [
            request      = pair_id;
            total_supply = pair.total_supply;
          ];
        } with response # l;

      const response : list(total_supply_res_t) = List.fold(
        look_up_total_supply,
        params.requests,
        (nil : list(total_supply_res_t))
      );

      ops := Tezos.transaction(response, 0mutez, params.callback) # ops;
    }
    | _ -> skip
    end
  } with (ops, s)
