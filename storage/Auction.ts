import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { zeroAddress } from "../test/helpers/Utils";

import { AuctionStorage, AuctionMockStorage } from "../test/types/Auction";

import auctionZIP16Errors from "./metadata/auctionZIP16Errors";

import commonZIP16Errors from "./metadata/commonZIP16Errors";

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
    bid_fee_balance: new BigNumber(0),
    auctions_count: new BigNumber(0),
    auction_duration: new BigNumber(0),
    auction_extension: new BigNumber(100),
    extension_trigger: new BigNumber(5),
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
        interfaces: ["TZIP-016"],
        errors: commonZIP16Errors.concat(auctionZIP16Errors),
        views: [],
      }),
      "ascii",
    ).toString("hex"),
  }),
};

export const auctionMockStorage: AuctionMockStorage = {
  owner: zeroAddress,
  pending_owner: null,
  dex: zeroAddress,
  fees: MichelsonMap.fromLiteral({}),
};
