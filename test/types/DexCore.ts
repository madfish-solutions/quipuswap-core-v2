import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

export type Fees = {
  interface_fee: BigNumber;
  swap_fee: BigNumber;
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
    bakers: MichelsonMap<MichelsonMapKey, unknown>;
    managers: string[];
    fees: Fees;
    admin: string;
    pending_admin: string;
    permits_counter: BigNumber;
    default_expiry: BigNumber;
    cycle_duration: BigNumber;
    tokens_count: BigNumber;
  };
  dex_core_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
};
