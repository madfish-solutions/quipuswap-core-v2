import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { zeroAddress } from "../test/helpers/Utils";

import { AuctionStorage } from "../test/types/Auction";

export const auctionStorage: AuctionStorage = {
  storage: {
    auctions: MichelsonMap.fromLiteral({}),
    dev_fee_balances_f: MichelsonMap.fromLiteral({}),
    public_fee_balances_f: MichelsonMap.fromLiteral({}),
    whitelist: [],
    quipu_token: {
      token: zeroAddress,
      id: new BigNumber(0),
    },
    fees: {
      dev_fee_f: new BigNumber(0),
      bid_fee_f: new BigNumber(0),
    },
    baker: undefined,
    admin: zeroAddress,
    pending_admin: undefined,
    dex_core: zeroAddress,
    bid_fee_balance_f: new BigNumber(0),
    auctions_count: new BigNumber(0),
    auction_duration: new BigNumber(0),
    min_bid: new BigNumber(0),
  },
  auction_lambdas: MichelsonMap.fromLiteral({}),
  metadata: MichelsonMap.fromLiteral({
    "": Buffer.from("tezos-storage:core", "ascii").toString("hex"),
    core: Buffer.from(
      JSON.stringify({
        name: "QuipuSwap Fee Auction",
        version: "v1.0.0",
        description:
          "Auction for trading fees charged on QuipuSwap Exchange 2.0. Anyone can bid on protocol fees with QUIPU.",
        authors: ["Madfish.Solutions <https://www.madfish.solutions>"],
        source: {
          tools: ["Ligo", "Flextesa"],
        },
        homepage: "https://quipuswap.com",
        interfaces: ["TZIP-16"],
        errors: [],
        views: [],
      }),
      "ascii"
    ).toString("hex"),
  }),
};
