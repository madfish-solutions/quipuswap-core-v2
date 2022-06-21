import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { BanBaker, Vote } from "./Bucket";

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
  deadline: string;
};

export type InvestLiquidity = {
  pair_id: BigNumber;
  token_a_in: BigNumber;
  token_b_in: BigNumber;
  shares: BigNumber;
  shares_receiver: string;
  candidate: string;
  deadline: string;
};

export type DivestLiquidity = {
  pair_id: BigNumber;
  min_token_a_out: BigNumber;
  min_token_b_out: BigNumber;
  shares: BigNumber;
  liquidity_receiver: string;
  candidate: string;
  deadline: string;
};

export type Swap = {
  lambda: undefined | null;
  swaps: SwapSlice[];
  deadline: string;
  receiver: string;
  referrer: string;
  amount_in: BigNumber;
  min_amount_out: BigNumber;
  flash: boolean;
};

export type WithdrawProfit = {
  receiver: string;
  pair_id: BigNumber;
};

export type ClaimFee = {
  token: Token;
  receiver: string;
};

export type ClaimTezFee = {
  pair_id: BigNumber;
  receiver: string;
};

export type WithdrawAuctionFee = {
  pair_id: BigNumber | undefined | null;
  token: Token;
};

export type DexVote = {
  pair_id: BigNumber;
  candidate: string;
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
  token_info: MichelsonMap<MichelsonMapKey, unknown>;
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
  bucket: string;
};

export type FlashSwapCallback = {
  pair_id: BigNumber;
  prev_tez_balance: BigNumber;
  amount_in: BigNumber;
};

export type CheckIsBannedBaker = {
  pair_id: BigNumber;
  baker: string;
};

export type DexCoreStorage = {
  storage: {
    token_metadata: MichelsonMap<MichelsonMapKey, unknown>;
    ledger: MichelsonMap<MichelsonMapKey, unknown>;
    accounts: MichelsonMap<MichelsonMapKey, unknown>;
    tokens: MichelsonMap<MichelsonMapKey, unknown>;
    token_to_id: MichelsonMap<MichelsonMapKey, unknown>;
    pairs: MichelsonMap<MichelsonMapKey, unknown>;
    permits: MichelsonMap<string, UserPermits>;
    interface_fee: MichelsonMap<MichelsonMapKey, unknown>;
    interface_tez_fee: MichelsonMap<MichelsonMapKey, unknown>;
    auction_fee: MichelsonMap<MichelsonMapKey, unknown>;
    auction_tez_fee: MichelsonMap<MichelsonMapKey, unknown>;
    managers: string[];
    fees: Fees;
    admin: string;
    pending_admin: string | undefined | null;
    baker_registry: string;
    flash_swaps_proxy: string;
    auction: string;
    permits_counter: BigNumber;
    default_expiry: BigNumber;
    entered: boolean;
    tokens_count: BigNumber;
    collecting_period: BigNumber;
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
  token_a_price_cml: BigNumber;
  token_b_price_cml: BigNumber;
  total_supply: BigNumber;
  last_block_timestamp: string;
  bucket: string | undefined | null;
};

export type RequiredTokens = {
  tokens_a_required: BigNumber;
  tokens_b_required: BigNumber;
};

export type TokensPerShare = {
  token_a_amt: BigNumber;
  token_b_amt: BigNumber;
};

export type TokensPerShareRequest = {
  pair_id: BigNumber;
  shares_amt: BigNumber;
};

export type SwapMinResRequest = {
  swaps: SwapSlice[];
  amount_in: BigNumber;
};

export type Permit = {
  created_at: string;
  expiry: BigNumber | null | undefined;
};

export type UserPermits = {
  permits: MichelsonMap<MichelsonMapKey, Permit>;
  expiry: BigNumber | null | undefined;
};

export type CalculateSwap = {
  out: BigNumber;
  interfaceFee: BigNumber;
  auctionFee: BigNumber;
  newFromPool: BigNumber;
  newToPool: BigNumber;
};
