import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { BanBaker } from "./TezStore";

export type Fees = {
  interface_fee: BigNumber;
  swap_fee: BigNumber;
};

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

export type LaunchExchange = {
  pair: Tokens;
  token_a_in: BigNumber;
  token_b_in: BigNumber;
  shares_recipient: string;
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
    referral_tokens: MichelsonMap<MichelsonMapKey, unknown>;
    referral_tez: MichelsonMap<MichelsonMapKey, unknown>;
    managers: string[];
    fees: Fees;
    last_block_timestamp: string;
    admin: string;
    pending_admin: string;
    baker_registry: string;
    flash_swaps_proxy: string;
    permits_counter: BigNumber;
    default_expiry: BigNumber;
    cycle_duration: BigNumber;
    tokens_count: BigNumber;
  };
  dex_core_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
};
