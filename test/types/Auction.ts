import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { Token } from "./Common";

export type ReceiveFees = {
  devFee: BigNumber;
  publicFee: BigNumber;
};

export type ReceiveFee = {
  token: Token;
  fee: BigNumber;
};

export type LaunchAuction = {
  token: Token;
  amt: BigNumber;
  bid: BigNumber;
};

export type PlaceBid = {
  auction_id: BigNumber;
  bid: BigNumber;
};

export type UpdateWhitelist = {
  token: Token;
  add: boolean;
};

export type WithdrawFee = {
  token: Token;
  receiver: string;
};

export type Fees = {
  dev_fee_f: BigNumber;
  bid_fee_f: BigNumber;
};

export type AuctionStorage = {
  storage: {
    auctions: MichelsonMap<MichelsonMapKey, unknown>;
    dev_fee_balances_f: MichelsonMap<MichelsonMapKey, unknown>;
    public_fee_balances_f: MichelsonMap<MichelsonMapKey, unknown>;
    whitelist: Token[];
    fees: Fees;
    baker: string;
    admin: string;
    pending_admin: string;
    dex_core: string;
    quipu_token: string;
    quipu_token_id: BigNumber;
    bid_fee_balance: BigNumber;
    auctions_count: BigNumber;
    auction_duration: BigNumber;
    min_bid: BigNumber;
  };
  auction_lambdas: MichelsonMap<MichelsonMapKey, unknown>;
  metadata: MichelsonMap<MichelsonMapKey, unknown>;
};
