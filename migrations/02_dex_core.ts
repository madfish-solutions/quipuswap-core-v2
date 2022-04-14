import { DexCore } from "../test/helpers/DexCore";
import { Utils } from "../test/helpers/Utils";

import { dexCoreStorage } from "../storage/DexCore";

import accounts from "../scripts/sandbox/accounts";

import { BigNumber } from "bignumber.js";

import BakerRegistryBuild from "../build/baker_registry.json";

import env from "../env";

module.exports = async () => {
  const utils: Utils = new Utils();

  await utils.init(accounts.dev.sk);

  dexCoreStorage.storage.managers = [accounts.dev.pkh];
  dexCoreStorage.storage.fees = {
    interface_fee: new BigNumber(0.3 * 10 ** 18),
    swap_fee: new BigNumber(0.3 * 10 ** 18),
    auction_fee: new BigNumber(0.3 * 10 ** 18),
    withdraw_fee_reward: new BigNumber(3 * 10 ** 18),
  };
  dexCoreStorage.storage.admin = accounts.dev.pkh;
  dexCoreStorage.storage.baker_registry =
    BakerRegistryBuild["networks"][env.network]["baker_registry"];
  dexCoreStorage.storage.default_expiry = new BigNumber(86400); // 24 hours
  dexCoreStorage.storage.collecting_period = new BigNumber(12); // 12 cycles

  const dexCore: DexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

  await dexCore.setLambdas();

  console.log(`DexCore: ${dexCore.contract.address}`);
};
