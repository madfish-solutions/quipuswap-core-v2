import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { FA12Storage } from "../../test/types/FA12";

import accounts from "../../scripts/sandbox/accounts";

const totalSupply: BigNumber = new BigNumber(100_000_000_000);

export const fa12Storage: FA12Storage = {
  total_supply: totalSupply,
  ledger: MichelsonMap.fromLiteral({
    [accounts.alice.pkh]: {
      balance: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      allowances: MichelsonMap.fromLiteral({}),
    },
    [accounts.bob.pkh]: {
      balance: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      allowances: MichelsonMap.fromLiteral({}),
    },
    [accounts.carol.pkh]: {
      balance: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      allowances: MichelsonMap.fromLiteral({}),
    },
    [accounts.dev.pkh]: {
      balance: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      allowances: MichelsonMap.fromLiteral({}),
    },
  }),
  metadata: MichelsonMap.fromLiteral({}),
  token_metadata: MichelsonMap.fromLiteral({}),
};
