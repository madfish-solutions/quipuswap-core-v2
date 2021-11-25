import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { zeroAddress } from "../test/helpers/Utils";

import { DexCoreStorage } from "../test/types/DexCore";

export const dexCoreStorage: DexCoreStorage = {
  storage: {
    token_metadata: MichelsonMap.fromLiteral({}),
    ledger: MichelsonMap.fromLiteral({}),
    accounts: MichelsonMap.fromLiteral({}),
    tokens: MichelsonMap.fromLiteral({}),
    token_to_id: MichelsonMap.fromLiteral({}),
    pairs: MichelsonMap.fromLiteral({}),
    permits: MichelsonMap.fromLiteral({}),
    tok_interface_fee: MichelsonMap.fromLiteral({}),
    tez_interface_fee: MichelsonMap.fromLiteral({}),
    auction_fee: MichelsonMap.fromLiteral({}),
    managers: [],
    fees: {
      interface_fee: new BigNumber(0),
      swap_fee: new BigNumber(0),
      auction_fee: new BigNumber(0),
      withdraw_fee_reward: new BigNumber(0),
    },
    tmp: {
      pair_id: new BigNumber(0),
      amount_a_out: new BigNumber(0),
      amount_b_out: new BigNumber(0),
      referrer: zeroAddress,
      token_a_balance_1: new BigNumber(0),
      token_b_balance_1: new BigNumber(0),
      token_a_balance_2: new BigNumber(0),
      token_b_balance_2: new BigNumber(0),
    },
    last_block_timestamp: null,
    admin: zeroAddress,
    pending_admin: zeroAddress,
    baker_registry: zeroAddress,
    flash_swaps_proxy: zeroAddress,
    auction: zeroAddress,
    permits_counter: new BigNumber(0),
    default_expiry: new BigNumber(0),
    tokens_count: new BigNumber(0),
    cycle_duration: new BigNumber(0),
    collecting_period: new BigNumber(0),
    voting_period: new BigNumber(0),
  },
  dex_core_lambdas: MichelsonMap.fromLiteral({}),
  metadata: MichelsonMap.fromLiteral({}),
};
