import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { BanBaker } from "./TezStore";

export type Tez = undefined;

export type FA12Token = string;

export type FA2Token = {
  token: string;
  id: BigNumber;
};

export type Token = { tez: Tez } | { fa12: FA12Token } | { fa2: FA2Token };

export type Tokens = {
  token_a: Token;
  token_b: Token;
};

export type FlashSwap = {
  lambda: string;
  pair_id: BigNumber;
  receiver: string;
  referrer: string;
  amount_a_out: BigNumber;
  amount_b_out: BigNumber;
};

export type Pair = {
  token_a_pool: BigNumber;
  token_b_pool: BigNumber;
  token_a_price_cum: BigNumber;
  token_b_price_cum: BigNumber;
  total_supply: BigNumber;
  tez_store: string | null | undefined;
};

export type Fees = {
  interface_fee: BigNumber;
  swap_fee: BigNumber;
  auction_fee: BigNumber;
  withdraw_fee_reward: BigNumber;
};

export type Tmp = {
  pair_id: BigNumber;
  amount_a_out: BigNumber;
  amount_b_out: BigNumber;
  referrer: string;
  token_a_balance_1: BigNumber;
  token_b_balance_1: BigNumber;
  token_a_balance_2: BigNumber;
  token_b_balance_2: BigNumber;
};

export type LaunchExchange = {
  pair: Tokens;
  token_a_in: BigNumber;
  token_b_in: BigNumber;
  shares_receiver: string;
  candidate: string;
};

export type AddManager = {
  manager: string;
  add: boolean;
};

export type MetadataPair = {
  key: string;
  value: string;
};

export type UpdateTokenMetadata = {
  token_id: BigNumber;
  token_info: MetadataPair[];
};

export type Ban = {
  pair_id: BigNumber;
  ban_params: BanBaker;
};

export type DexCoreStorage = {
  storage: {
    token_metadata: MichelsonMap<MichelsonMapKey, unknown>;
    ledger: MichelsonMap<MichelsonMapKey, unknown>;
    accounts: MichelsonMap<MichelsonMapKey, unknown>;
    tokens: MichelsonMap<MichelsonMapKey, unknown>;
    token_to_id: MichelsonMap<MichelsonMapKey, unknown>;
    pairs: MichelsonMap<MichelsonMapKey, unknown>;
    permits: MichelsonMap<MichelsonMapKey, unknown>;
    tok_interface_fee: MichelsonMap<MichelsonMapKey, unknown>;
    tez_interface_fee: MichelsonMap<MichelsonMapKey, unknown>;
    auction_fee: MichelsonMap<MichelsonMapKey, unknown>;
    managers: string[];
    fees: Fees;
    tmp: Tmp;
    last_block_timestamp: string;
    admin: string;
    pending_admin: string;
    baker_registry: string;
    flash_swaps_proxy: string;
    auction: string;
    permits_counter: BigNumber;
    default_expiry: BigNumber;
    tokens_count: BigNumber;
    cycle_duration: BigNumber;
    collecting_period: BigNumber;
    voting_period: BigNumber;
  };
  dex_core_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
};
