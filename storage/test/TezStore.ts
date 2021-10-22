import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { zeroAddress } from "test/helpers/Utils";

import { TezStoreStorage } from "test/types/TezStore";

export const tezStoreStorage: TezStoreStorage = {
  ledger: MichelsonMap.fromLiteral({}),
  voters: MichelsonMap.fromLiteral({}),
  bakers: MichelsonMap.fromLiteral({}),
  current_delegated: zeroAddress,
  next_candidate: zeroAddress,
  baker_registry: null,
  dex_core: null,
  total_votes: new BigNumber(0),
};
