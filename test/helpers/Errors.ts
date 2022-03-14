export enum DexCore {
  ERR_UNKNOWN_FUNC = "100",
  ERR_FUNC_SET = "101",
  ERR_HIGH_FUNC_INDEX = "102",
  ERR_CANT_UNPACK_LAMBDA = "103",
  ERR_WRONG_PAIR_ORDER = "104",
  ERR_ZERO_A_IN = "105",
  ERR_ZERO_B_IN = "106",
  ERR_PAIR_LISTED = "107",
  ERR_PAIR_NOT_LISTED = "108",
  ERR_NO_LIQUIDITY = "109",
  ERR_NO_SHARES_EXPECTED = "110",
  ERR_LOW_TOKEN_A_IN = "111",
  ERR_LOW_TOKEN_B_IN = "112",
  ERR_TEZ_STORE_404 = "113",
  ERR_INSUFFICIENT_LIQUIDITY = "114",
  ERR_DUST_OUT = "115",
  ERR_HIGH_MIN_OUT = "116",
  ERR_EMPTY_ROUTE = "117",
  ERR_ZERO_IN = "118",
  ERR_WRONG_ROUTE = "119",
  ERR_WRONG_TEZ_AMOUNT = "120",
  ERR_TEZ_STORE_INVEST_TEZ_ENTRYPOINT_404 = "121",
  ERR_TEZ_STORE_DIVEST_TEZ_ENTRYPOINT_404 = "122",
  ERR_TEZ_STORE_BAN_BAKER_ENTRYPOINT_404 = "123",
  ERR_TEZ_STORE_VOTE_ENTRYPOINT_404 = "124",
  ERR_TEZ_STORE_IS_BANNED_BAKER_VIEW_404 = "125",
  ERR_FLASH_SWAPS_PROXY_DEFAULT_ENTRYPOINT_404 = "126",
  ERR_TEZ_STORE_GET_TEZ_BALANCE_VIEW_404 = "127",
  ERR_FLASH_SWAP_CALLBACK_1_404 = "128",
  ERR_FLASH_SWAP_CALLBACK_2_404 = "129",
  ERR_FLASH_SWAP_CALLBACK_3_404 = "130",
  ERR_FA12_BALANCE_CALLBACK_1_404 = "131",
  ERR_FA2_BALANCE_CALLBACK_1_404 = "132",
  ERR_FA12_BALANCE_CALLBACK_2_404 = "133",
  ERR_FA2_BALANCE_CALLBACK_2_404 = "134",
  ERR_WRONG_FLASH_SWAP_TOKEN_A_RETURNS = "135",
  ERR_WRONG_FLASH_SWAP_TOKEN_B_RETURNS = "136",
  ERR_WRONG_FLASH_SWAP_RETURNS = "137",
  ERR_CAN_NOT_REFER_YOURSELF = "138",
  ERR_TEZ_STORE_WITHDRAW_REWARDS_ENTRYPOINT_404 = "139",
  ERR_INSUFFICIENT_INTERFACE_FEE_BALANCE = "140",
  ERR_TEZ_STORE_GET_USER_CANDIDATE_VIEW_404 = "141",
  ERR_LAUNCH_CALLBACK_404 = "142",
  ERR_AUCTION_RECEIVE_FEE_ENTRYPOINT_404 = "143",
  ERR_REENTRANCY = "144",
  ERR_CLOSE_ENTRYPOINT_404 = "145",
  ERR_NOT_ENTERED = "146",
  ERR_TOO_FEW_SWAPS = "147",
}

export enum TezStore {
  ERR_INSUFFICIENT_TEZ_BALANCE = "200",
  ERR_BAKER_REGISTRY_VALIDATE_ENTRYPOINT_404 = "201",
  ERR_DEX_CORE_GET_TOTAL_SUPPLY_VIEW_404 = "202",
  ERR_DEX_CORE_GET_VOTING_PERIOD_VIEW_404 = "203",
  ERR_DEX_CORE_GET_COLLECTING_PERIOD_VIEW_404 = "204",
  ERR_DEX_CORE_GET_CYCLE_DURATION_VIEW_404 = "205",
}

export enum Auction {
  ERR_UNKNOWN_FUNC = "300",
  ERR_CANT_UNPACK_LAMBDA = "301",
  ERR_HIGH_FUNC_INDEX = "302",
  ERR_FUNC_SET = "303",
  ERR_AUCTION_NOT_FOUND = "304",
  ERR_WHITELISTED_TOKEN = "305",
  ERR_NOT_WHITELISTED_TOKEN = "306",
  ERR_INSUFFICIENT_BALANCE = "307",
  ERR_LOW_BID = "308",
  ERR_AUCTION_FINISHED = "309",
  ERR_AUCTION_NOT_FINISHED = "310",
}

export enum Common {
  ERR_NOT_ADMIN = "400",
  ERR_NOT_PENDING_ADMIN = "401",
  ERR_NOT_MANAGER = "402",
  ERR_NOT_DEX_CORE = "403",
  ERR_FA12_TRANSFER_ENTRYPOINT_404 = "404",
  ERR_FA2_TRANSFER_ENTRYPOINT_404 = "405",
  ERR_NOT_A_NAT = "406",
  ERR_FA12_BALANCE_OF_ENTRYPOINT_404 = "407",
  ERR_FA2_BALANCE_OF_ENTRYPOINT_404 = "408",
  ERR_WRONG_TOKEN_TYPE = "409",
}

export enum FA2 {
  FA2_TOKEN_UNDEFINED = "FA2_TOKEN_UNDEFINED",
  FA2_NOT_OWNER = "FA2_NOT_OWNER",
  FA2_NOT_OPERATOR = "FA2_NOT_OPERATOR",
  FA2_INSUFFICIENT_BALANCE = "FA2_INSUFFICIENT_BALANCE",
}

export enum Permits {
  NOT_PERMIT_ISSUER = "NOT_PERMIT_ISSUER",
  EXPIRED_PERMIT = "EXPIRED_PERMIT",
  EXPIRY_TOO_BIG = "EXPIRY_TOO_BIG",
  DUP_PERMIT = "DUP_PERMIT",
  MISSIGNED = "MISSIGNED",
}
