import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

export type BanBaker = {
  baker: string;
  ban_period: BigNumber;
};

export type TezStoreStorage = {
  ledger: MichelsonMap<MichelsonMapKey, unknown>;
  voters: MichelsonMap<MichelsonMapKey, unknown>;
  bakers: MichelsonMap<MichelsonMapKey, unknown>;
  current_delegated: string | undefined | null;
  next_candidate: string | undefined | null;
  baker_registry: string;
  dex_core: string;
  total_votes: BigNumber;
};
