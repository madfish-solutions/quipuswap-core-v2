import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

export type Fees = {
  dev_fee: BigNumber;
  bid_fee: BigNumber;
};

export type AuctionStorage = {
  storage: {
    auctions: MichelsonMap<MichelsonMapKey, unknown>;
    dev_fee_balance: MichelsonMap<MichelsonMapKey, unknown>;
    public_fee_balance: MichelsonMap<MichelsonMapKey, unknown>;
    whitelist: string[];
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
