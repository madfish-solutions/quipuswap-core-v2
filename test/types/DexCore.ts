import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { BanBaker, Vote } from "./TezStore";

import { Token } from "./Common";

export type Tokens = {
  token_a: Token;
  token_b: Token;
};

export type SwapSlice = {
  direction: { a_to_b: undefined } | { b_to_a: undefined };
  pair_id: BigNumber;
};

export type LaunchExchange = {
  pair: Tokens;
  token_a_in: BigNumber;
  token_b_in: BigNumber;
  shares_receiver: string;
  candidate: string;
};

export type InvestLiquidity = {
  pair_id: BigNumber;
  token_a_in: BigNumber;
  token_b_in: BigNumber;
  shares: BigNumber;
  shares_receiver: string;
  candidate: string;
};

export type DivestLiquidity = {
  pair_id: BigNumber;
  min_token_a_out: BigNumber;
  min_token_b_out: BigNumber;
  shares: BigNumber;
  liquidity_receiver: string;
  candidate: string;
};

export type FlashSwap = {
  lambda: string;
  pair_id: BigNumber;
  receiver: string;
  referrer: string;
  amount_a_out: BigNumber;
  amount_b_out: BigNumber;
};

export type Swap = {
  swaps: SwapSlice[];
  receiver: string;
  referrer: string;
  amount_in: BigNumber;
  min_amount_out: BigNumber;
};

export type WithdrawProfit = {
  receiver: string;
  pair_id: BigNumber;
};

export type ClaimTokFee = {
  token: Token;
  receiver: string;
  amount: BigNumber;
};

export type ClaimTezFee = {
  pair_id: BigNumber;
  receiver: string;
  amount: BigNumber;
};

export type AddManager = {
  manager: string;
  add: boolean;
};

export type Fees = {
  interface_fee: BigNumber;
  swap_fee: BigNumber;
  auction_fee: BigNumber;
  withdraw_fee_reward: BigNumber;
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

export type SetExpiry = {
  issuer: string;
  expiry: BigNumber;
  permit_hash: string | undefined | null;
};

export type LaunchCallback = {
  vote_params: Vote;
  tez_store: string;
};

export type CheckIsBannedBaker = {
  pair_id: BigNumber;
  baker: string;
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

export type CumulativePrices = {
  tokenACumulativePrice: BigNumber;
  tokenBCumulativePrice: BigNumber;
};

export type Pair = {
  token_a_pool: BigNumber;
  token_b_pool: BigNumber;
  token_a_price_cum: BigNumber;
  token_b_price_cum: BigNumber;
  total_supply: BigNumber;
  last_block_timestamp: string;
  tez_store: string | undefined | null;
};

export type RequiredTokens = {
  tokens_a_required: BigNumber;
  tokens_b_required: BigNumber;
};

export type DivestedTokens = {
  token_a_divested: BigNumber;
  token_b_divested: BigNumber;
};
