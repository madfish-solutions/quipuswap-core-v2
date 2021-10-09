import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

export type Fees = {
  interface_fee: BigNumber;
  swap_fee: BigNumber;
};

export type DexCoreStorage = {
  token_metadata: MichelsonMap<MichelsonMapKey, unknown>;
  managers: string[];
  fees: Fees;
  admin: string;
  pending_admin: string;
  cycle_duration: BigNumber;
};
