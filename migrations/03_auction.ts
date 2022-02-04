import { DexCore } from "../test/helpers/DexCore";
import { Auction } from "../test/helpers/Auction";
import { Utils } from "../test/helpers/Utils";

import { auctionStorage } from "../storage/Auction";

import accounts from "../scripts/sandbox/accounts";

import { BigNumber } from "bignumber.js";

import DexCoreBuild from "../build/dex_core.json";

import env from "../env";

module.exports = async () => {
  const utils: Utils = new Utils();

  await utils.init(accounts.dev.sk);

  auctionStorage.storage.fees = {
    dev_fee_f: new BigNumber(0.5 * 10 ** 18),
    bid_fee_f: new BigNumber(0.5 * 10 ** 18),
  };
  auctionStorage.storage.admin = accounts.dev.pkh;
  auctionStorage.storage.dex_core =
    DexCoreBuild["networks"][env.network]["dex_core"];
  auctionStorage.storage.quipu_token = "KT1VowcKqZFGhdcDZA3UN1vrjBLmxV5bxgfJ"; // Hangzhounet QUIPU
  auctionStorage.storage.auction_duration = new BigNumber(86400); // 24 hours
  auctionStorage.storage.min_bid = new BigNumber(10); // 0.000010 QUIPU tokens

  const auction: Auction = await Auction.originate(utils.tezos, auctionStorage);

  await auction.setLambdas();

  const dexCore: DexCore = await DexCore.init(
    DexCoreBuild["networks"][env.network]["dex_core"],
    utils.tezos
  );

  await dexCore.setAuction(auction.contract.address);

  console.log(`Auction: ${auction.contract.address}`);
};
