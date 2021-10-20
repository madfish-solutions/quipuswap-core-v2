module DexCore is {
  [@inline] const err_unknown_func                        : string = "100";
  [@inline] const err_func_set                            : string = "101";
  [@inline] const err_high_func_index                     : string = "102";
  [@inline] const err_cant_unpack_lambda                  : string = "103";
  [@inline] const err_wrong_pair_order                    : string = "104";
  [@inline] const err_zero_a_in                           : string = "105";
  [@inline] const err_zero_b_in                           : string = "106";
  [@inline] const err_pair_listed                         : string = "107";
  [@inline] const err_pair_not_listed                     : string = "108";
  [@inline] const err_no_liquidity                        : string = "109";
  [@inline] const err_no_shares_expected                  : string = "110";
  [@inline] const err_low_token_a_in                      : string = "111";
  [@inline] const err_low_token_b_in                      : string = "112";
  [@inline] const err_tez_store_404                       : string = "113";
  [@inline] const err_insufficient_lp                     : string = "114";
  [@inline] const err_dust_out                            : string = "115";
  [@inline] const err_high_min_out                        : string = "116";
  [@inline] const err_empty_route                         : string = "117";
  [@inline] const err_zero_in                             : string = "118";
  [@inline] const err_wrong_route                         : string = "119";
  [@inline] const err_wrong_tez_amount                    : string = "120";
  [@inline] const err_tez_store_invest_tez_entrypoint_404 : string = "121";
  [@inline] const err_tez_store_divest_tez_entrypoint_404 : string = "122";
  [@inline] const err_tez_store_ban_baker_entrypoint_404  : string = "123";
  [@inline] const err_tez_store_vote_entrypoint_404       : string = "124";
}

module TezStore is {
  [@inline] const err_not_dex_core             : string = "200";
  [@inline] const err_insufficient_tez_balance : string = "201";
}

module Common is {
  [@inline] const err_not_admin                    : string = "300";
  [@inline] const err_not_pending_admin            : string = "301";
  [@inline] const err_not_manager                  : string = "302";
  [@inline] const err_fa12_transfer_entrypoint_404 : string = "303";
  [@inline] const err_fa2_transfer_entrypoint_404  : string = "304";
}
