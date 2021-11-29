import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { zeroAddress } from "../test/helpers/Utils";

import { AuctionStorage } from "../test/types/Auction";

export const auctionStorage: AuctionStorage = {
  storage: {
    auctions: MichelsonMap.fromLiteral({}),
    dev_fee_balance: MichelsonMap.fromLiteral({}),
    public_fee_balance: MichelsonMap.fromLiteral({}),
    whitelist: [],
    fees: {
      dev_fee: new BigNumber(0),
      bid_fee: new BigNumber(0),
    },
    baker: zeroAddress,
    admin: zeroAddress,
    pending_admin: zeroAddress,
    dex_core: zeroAddress,
    quipu_token: zeroAddress,
    quipu_token_id: new BigNumber(0),
    bid_fee_balance: new BigNumber(0),
    auctions_count: new BigNumber(0),
    auction_duration: new BigNumber(0),
    min_bid: new BigNumber(0),
  },
  auction_lambdas: MichelsonMap.fromLiteral({}),
  metadata: MichelsonMap.fromLiteral({}),
};
