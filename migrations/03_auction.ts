import { TezosToolkit } from "@taquito/taquito";

import { DexCore } from "../test/helpers/DexCore";
import { Auction } from "../test/helpers/Auction";

import { auctionStorage, auctionMockStorage } from "../storage/Auction";

import accounts from "../scripts/sandbox/accounts";

import { migrate } from "../scripts/helpers";

import { BigNumber } from "bignumber.js";

import DexCoreBuild from "../build/dex_core.json";

module.exports = async (tezos: TezosToolkit, network: string) => {
  // auctionStorage.storage.fees = {
  //   dev_fee_f: new BigNumber(0.5 * 10 ** 18),
  //   bid_fee_f: new BigNumber(0.5 * 10 ** 18),
  // };
  // auctionStorage.storage.admin = accounts.dev.pkh;
  // auctionStorage.storage.dex_core =
  //   DexCoreBuild["networks"][network]["dex_core"];
  // auctionStorage.storage.quipu_token.token =
  //   "KT19363aZDTjeRyoDkSLZhCk62pS4xfvxo6c"; // Ithaca QUIPU
  // auctionStorage.storage.quipu_token.id = new BigNumber(0); // Ithaca QUIPU
  // auctionStorage.storage.auction_duration = new BigNumber(86400); // 24 hours
  // auctionStorage.storage.min_bid = new BigNumber(10); // 0.000010 QUIPU tokens

  // const auctionAddress: string = await migrate(
  //   tezos,
  //   "auction",
  //   auctionStorage,
  //   network
  // );
  auctionMockStorage.owner = accounts.dev.pkh;
  auctionMockStorage.dex = DexCoreBuild["networks"][network]["dex_core"];

  const auctionMockAddress = await migrate(
    tezos,
    "auction_mock",
    auctionMockStorage,
    network,
  );

  const dexCore: DexCore = await DexCore.init(
    DexCoreBuild["networks"][network]["dex_core"],
    tezos,
  );

  await dexCore.setAuction(auctionMockAddress!);

  console.log(`AuctionMock: ${auctionMockAddress}`);
};
