import { DexCoreStorage } from "../test/types/DexCore";

import { zeroAddress } from "../test/helpers/Utils";

import { BigNumber } from "bignumber.js";
import { MichelsonMap } from "@taquito/michelson-encoder";

export const dexCoreStorage: DexCoreStorage = {
  metadata: MichelsonMap.fromLiteral({}),
  token_metadata: MichelsonMap.fromLiteral({}),
  ledger: MichelsonMap.fromLiteral({}),
  accounts: MichelsonMap.fromLiteral({}),
  permits: MichelsonMap.fromLiteral({}),
  bakers: MichelsonMap.fromLiteral({}),
  managers: [],
  fees: {
    interface_fee: new BigNumber(0),
    swap_fee: new BigNumber(0),
  },
  admin: zeroAddress,
  pending_admin: zeroAddress,
  permits_counter: new BigNumber(0),
  default_expiry: new BigNumber(0),
  cycle_duration: new BigNumber(0),
  tokens_count: new BigNumber(0),
};
