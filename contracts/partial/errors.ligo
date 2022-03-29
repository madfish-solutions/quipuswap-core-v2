module DexCore is {
  const err_unknown_func                              : string = "100";
  const err_func_set                                  : string = "101";
  const err_high_func_index                           : string = "102";
  const err_cant_unpack_lambda                        : string = "103";
  const err_wrong_pair_order                          : string = "104";
  const err_zero_a_in                                 : string = "105";
  const err_zero_b_in                                 : string = "106";
  const err_pair_listed                               : string = "107";
  const err_pair_not_listed                           : string = "108";
  const err_no_liquidity                              : string = "109";
  const err_no_shares_expected                        : string = "110";
  const err_low_token_a_in                            : string = "111";
  const err_low_token_b_in                            : string = "112";
  const err_bucket_404                                : string = "113";
  const err_insufficient_liquidity                    : string = "114";
  const err_dust_out                                  : string = "115";
  const err_high_min_out                              : string = "116";
  const err_empty_route                               : string = "117";
  const err_zero_in                                   : string = "118";
  const err_wrong_route                               : string = "119";
  const err_wrong_tez_amount                          : string = "120";
  const err_bucket_pour_out_entrypoint_404            : string = "121";
  const err_bucket_pour_over_entrypoint_404           : string = "122";
  const err_bucket_ban_baker_entrypoint_404           : string = "123";
  const err_bucket_vote_entrypoint_404                : string = "124";
  const err_bucket_is_banned_baker_view_404           : string = "125";
  const err_flash_swaps_proxy_default_entrypoint_404  : string = "126";
  const err_bucket_get_tez_balance_view_404           : string = "127";
  const err_flash_swap_callback_404                   : string = "128";
  const err_wrong_flash_swap_returns                  : string = "129";
  const err_can_not_refer_yourself                    : string = "130";
  const err_bucket_withdraw_rewards_entrypoint_404    : string = "131";
  const err_insufficient_interface_fee_balance        : string = "132";
  const err_bucket_get_user_candidate_view_404        : string = "133";
  const err_launch_callback_404                       : string = "134";
  const err_auction_receive_fee_entrypoint_404        : string = "135";
  const err_reentrancy                                : string = "136";
  const err_close_entrypoint_404                      : string = "137";
  const err_not_entered                               : string = "138";
  const err_too_few_swaps                             : string = "139";
  const err_can_not_perform_voting                    : string = "140";
  const err_tez_amount_mismatch                       : string = "141";
  const err_wrong_reserves_state                      : string = "142";
  const err_no_pair_id                                : string = "143";
  const err_action_outdated                           : string = "144";
}

module Bucket is {
  const err_baker_registry_validate_entrypoint_404  : string = "200";
  const err_dex_core_get_total_supply_view_404      : string = "201";
  const err_dex_core_get_voting_period_view_404     : string = "202";
  const err_dex_core_get_collecting_period_view_404 : string = "203";
  const err_dex_core_get_cycle_duration_view_404    : string = "204";
}

module Auction is {
  const err_unknown_func          : string = "300";
  const err_cant_unpack_lambda    : string = "301";
  const err_high_func_index       : string = "302";
  const err_func_set              : string = "303";
  const err_auction_not_found     : string = "304";
  const err_whitelisted_token     : string = "305";
  const err_not_whitelisted_token : string = "306";
  const err_insufficient_balance  : string = "307";
  const err_low_bid               : string = "308";
  const err_auction_finished      : string = "309";
  const err_auction_not_finished  : string = "310";
}

module Common is {
  const err_not_admin                      : string = "400";
  const err_not_pending_admin              : string = "401";
  const err_not_manager                    : string = "402";
  const err_not_dex_core                   : string = "403";
  const err_fa12_transfer_entrypoint_404   : string = "404";
  const err_fa2_transfer_entrypoint_404    : string = "405";
  const err_not_a_nat                      : string = "406";
  const err_fa12_balance_of_entrypoint_404 : string = "407";
  const err_fa2_balance_of_entrypoint_404  : string = "408";
  const err_wrong_token_type               : string = "409";
  const err_div_by_zero                    : string = "410";
  const err_contract_404                   : string = "411";
  const err_bucket_fill_entrypoint_404     : string = "412";
}
