import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { FA12Storage } from "../../test/types/FA12";

import { alice, bob, carol, dev } from "../../scripts/sandbox/accounts";

const totalSupply: BigNumber = new BigNumber(100_000_000_000);

export const fa12Storage: FA12Storage = {
  total_supply: totalSupply,
  ledger: MichelsonMap.fromLiteral({
    [alice.pkh]: {
      balance: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      allowances: MichelsonMap.fromLiteral({}),
    },
    [bob.pkh]: {
      balance: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      allowances: MichelsonMap.fromLiteral({}),
    },
    [carol.pkh]: {
      balance: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      allowances: MichelsonMap.fromLiteral({}),
    },
    [dev.pkh]: {
      balance: totalSupply.dividedBy(4).integerValue(BigNumber.ROUND_DOWN),
      allowances: MichelsonMap.fromLiteral({}),
    },
  }),
  metadata: MichelsonMap.fromLiteral({}),
  token_metadata: MichelsonMap.fromLiteral({}),
};
