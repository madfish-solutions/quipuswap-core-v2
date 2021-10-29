[@view] function check_is_banned_baker(
  const params          : check_is_banned_t;
  const s               : full_storage_t)
                        : bool is
  block {
    const pair : pair_t = get_pair_or_fail(params.pair_id, s.storage.pairs);
    const tez_store : address = get_tez_store_or_fail(pair.tez_store);
    const result : bool = case (Tezos.call_view("is_banned_baker", params.baker, tez_store) : option(bool)) of
    | Some(v) -> v
    | None    -> failwith(DexCore.err_tez_store_is_banned_baker_view_404)
    end;
  } with result

[@view] function get_reserves(
  const requests        : list(reserves_req_t);
  const s               : full_storage_t)
                        : list(reserves_res_t) is
  block {
    function look_up_reserves(
      const l         : list(reserves_res_t);
      const pair_id   : reserves_req_t)
                      : list(reserves_res_t) is
      block {
        const pair : pair_t = get_pair_or_fail(pair_id, s.storage.pairs);
        const response : reserves_res_t = record [
          request  = pair_id;
          reserves = record [
            token_a_pool = pair.token_a_pool;
            token_b_pool = pair.token_b_pool;
          ];
        ];
      } with response # l;

    const response : list(reserves_res_t) = List.fold(
      look_up_reserves,
      requests,
      (nil : list(reserves_res_t))
    );
  } with response

[@view] function get_total_supply(
  const requests        : list(total_supply_req_t);
  const s               : full_storage_t)
                        : list(total_supply_res_t) is
  block {
    function look_up_total_supply(
      const l         : list(total_supply_res_t);
      const pair_id   : total_supply_req_t)
                      : list(total_supply_res_t) is
      block {
        const pair : pair_t = get_pair_or_fail(pair_id, s.storage.pairs);
        const response : total_supply_res_t = record [
          request      = pair_id;
          total_supply = pair.total_supply;
        ];
      } with response # l;

    const response : list(total_supply_res_t) = List.fold(
      look_up_total_supply,
      requests,
      (nil : list(total_supply_res_t))
    );
  } with response

[@view] function get_swap_min_res(
  const _params         : get_swap_min_res_t;
  const _s              : full_storage_t)
                        : nat is
  block {
    skip;
  } with 0n

[@view] function get_toks_per_share(
  const requests        : list(toks_per_shr_req_t);
  const s               : full_storage_t)
                        : list(toks_per_shr_res_t) is
  block {
    function look_up_toks_per_share(
      const l         : list(toks_per_shr_res_t);
      const request   : toks_per_shr_req_t)
                      : list(toks_per_shr_res_t) is
      block {
        const pair : pair_t = get_pair_or_fail(request.pair_id, s.storage.pairs);
        const response : toks_per_shr_res_t = record [
          request          = request;
          tokens_per_share = record [
            token_a_amt = request.shares_amt * pair.token_a_pool / pair.total_supply;
            token_b_amt = request.shares_amt * pair.token_b_pool / pair.total_supply;
          ];
        ];
      } with response # l;

    const response : list(toks_per_shr_res_t) = List.fold(
      look_up_toks_per_share,
      requests,
      (nil : list(toks_per_shr_res_t))
    );
  } with response

[@view] function get_cumulative_prices(
  const requests        : list(cum_prices_req_t);
  const s               : full_storage_t)
                        : list(cum_prices_res_t) is
  block {
    function look_up_cumulative_prices(
      const l         : list(cum_prices_res_t);
      const pair_id   : token_id_t)
                      : list(cum_prices_res_t) is
      block {
        const pair : pair_t = get_pair_or_fail(pair_id, s.storage.pairs);
        const response : cum_prices_res_t = record [
          request           = pair_id;
          cumulative_prices = record [
            last_block_timestamp = s.storage.last_block_timestamp;
            token_a_price_cum    = pair.token_a_price_cum;
            token_b_price_cum    = pair.token_b_price_cum;
          ];
        ];
      } with response # l;

    const response : list(cum_prices_res_t) = List.fold(
      look_up_cumulative_prices,
      requests,
      (nil : list(cum_prices_res_t))
    );
  } with response
