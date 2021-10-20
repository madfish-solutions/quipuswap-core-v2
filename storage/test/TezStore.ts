import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { TezStoreStorage } from "test/types/TezStore";

export const tezStoreStorage: TezStoreStorage = {
  ledger: MichelsonMap.fromLiteral({}),
  voters: MichelsonMap.fromLiteral({}),
  bakers: MichelsonMap.fromLiteral({}),
  current_delegated: null,
  next_candidate: null,
  baker_registry: null,
  dex_core: null,
  total_votes: new BigNumber(0),
};
