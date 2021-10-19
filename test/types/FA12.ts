import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

export type UserFA12Info = {
  balance: BigNumber;
  allowances: MichelsonMap<MichelsonMapKey, unknown>;
};

export type FA12Storage = {
  total_supply: BigNumber;
  ledger: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
  token_metadata: MichelsonMap<MichelsonMapKey, unknown>;
};
