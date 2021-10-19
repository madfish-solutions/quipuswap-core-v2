import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

export type UserFA2Info = {
  balances: MichelsonMap<MichelsonMapKey, unknown>;
  allowances: string[];
};

export type UserFA2LPInfo = {
  balance: BigNumber;
  allowances: string[];
};

export type Operator = {
  owner: string;
  operator: string;
  token_id: BigNumber;
};

export type UpdateOperator =
  | { add_operator: Operator }
  | { remove_operator: Operator };

export type TransferDestination = {
  to_: string;
  token_id: BigNumber;
  amount: BigNumber;
};

export type Transfer = {
  from_: string;
  txs: TransferDestination[];
};

export type BalanceRequest = {
  owner: string;
  token_id: BigNumber;
};

export type BalanceResponse = {
  request: BalanceRequest;
  balance: BigNumber;
};

export type FA2Storage = {
  account_info: MichelsonMap<MichelsonMapKey, unknown>;
  token_info: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
  token_metadata: MichelsonMap<MichelsonMapKey, unknown>;
  minters_info: MichelsonMap<MichelsonMapKey, unknown>;
  last_token_id: BigNumber;
  admin: string;
  permit_counter: BigNumber;
  permits: MichelsonMap<MichelsonMapKey, unknown>;
  default_expiry: BigNumber;
  total_minter_shares: BigNumber;
};
