[@view] function check_is_banned_baker(
  const params          : check_is_banned_t;
  const s               : full_storage_t)
                        : bool is
  block {
    const pair : pair_t = unwrap(s.storage.pairs[params.pair_id], DexCore.err_pair_not_listed);
    const bucket : address = unwrap(pair.bucket, DexCore.err_bucket_404);
  } with unwrap(
    (Tezos.call_view("is_banned_baker", params.baker, bucket) : option(bool)),
    DexCore.err_bucket_is_banned_baker_view_404
  )

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
        const pair : pair_t = unwrap(s.storage.pairs[pair_id], DexCore.err_pair_not_listed);
        const response : reserves_res_t = record [
          request  = pair_id;
          reserves = record [
            token_a_pool = pair.token_a_pool;
            token_b_pool = pair.token_b_pool;
          ];
        ];
      } with response # l;

    const response : list(reserves_res_t) = List.fold(look_up_reserves, requests, (nil : list(reserves_res_t)));
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
        const pair : pair_t = unwrap(s.storage.pairs[pair_id], DexCore.err_pair_not_listed);
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
  const params          : get_swap_min_res_t;
  const s               : full_storage_t)
                        : nat is
  block {
    const first_swap : swap_slice_t = unwrap(List.head_opt(params.swaps), DexCore.err_empty_route);
    const tokens : tokens_t = unwrap(s.storage.tokens[first_swap.pair_id], DexCore.err_pair_not_listed);
    const token : token_t = case first_swap.direction of [
    | A_to_b -> tokens.token_a
    | B_to_a -> tokens.token_b
    ];
    const tmp : tmp_swap_t = List.fold(
      swap_internal,
      params.swaps,
      record [
        s               = s.storage;
        forwards        = (nil : list(forward_t));
        token_in        = token;
        receiver        = Constants.zero_address;
        referrer        = Constants.zero_address;
        from_bucket     = (None : option(address));
        amount_in       = params.amount_in;
        counter         = 0n;
      ]
    );
  } with tmp.amount_in

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
        const pair : pair_t = unwrap(s.storage.pairs[request.pair_id], DexCore.err_pair_not_listed);

        assert_with_error(pair.token_a_pool * pair.token_b_pool =/= 0n, DexCore.err_no_liquidity);

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
        const pair : pair_t = unwrap(s.storage.pairs[pair_id], DexCore.err_pair_not_listed);
        const response : cum_prices_res_t = record [
          request           = pair_id;
          cumulative_prices = record [
            last_block_timestamp = pair.last_block_timestamp;
            token_a_price_cml    = pair.token_a_price_cml;
            token_b_price_cml    = pair.token_b_price_cml;
          ];
        ];
      } with response # l;

    const response : list(cum_prices_res_t) = List.fold(
      look_up_cumulative_prices,
      requests,
      (nil : list(cum_prices_res_t))
    );
  } with response

[@view] function get_collecting_period(
  const _               : unit;
  const s               : full_storage_t)
                        : nat is
  s.storage.collecting_period

[@view] function get_baker_rate(
  const _               : unit;
  const s               : full_storage_t)
                        : nat is
  s.storage.baker_rate_f
