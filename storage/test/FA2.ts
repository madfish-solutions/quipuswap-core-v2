import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { FA2Storage } from "../../test/types/FA2";

import accounts from "../../scripts/sandbox/accounts";

const totalSupply: BigNumber = new BigNumber(100_000_000_000);

export const fa2Storage: FA2Storage = {
  account_info: MichelsonMap.fromLiteral({
    [accounts.alice.pkh]: {
      balances: MichelsonMap.fromLiteral({
        [0]: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      }),
      allowances: [],
    },
    [accounts.bob.pkh]: {
      balances: MichelsonMap.fromLiteral({
        [0]: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      }),
      allowances: [],
    },
    [accounts.carol.pkh]: {
      balances: MichelsonMap.fromLiteral({
        [0]: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      }),
      allowances: [],
    },
    [accounts.dev.pkh]: {
      balances: MichelsonMap.fromLiteral({
        [0]: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      }),
      allowances: [],
    },
  }),
  token_info: MichelsonMap.fromLiteral({}),
  metadata: MichelsonMap.fromLiteral({}),
  token_metadata: MichelsonMap.fromLiteral({}),
  minters_info: MichelsonMap.fromLiteral({}),
  last_token_id: new BigNumber(1),
  admin: accounts.alice.pkh,
  permit_counter: new BigNumber(0),
  permits: MichelsonMap.fromLiteral({}),
  default_expiry: new BigNumber(1000),
  total_minter_shares: new BigNumber(0),
};
