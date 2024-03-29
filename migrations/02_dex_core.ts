import { TezosToolkit } from "@taquito/taquito";

import { DexCore } from "../test/helpers/DexCore";

import { dexCoreStorage } from "../storage/DexCore";

import accounts from "../scripts/sandbox/accounts";

import { migrate } from "../scripts/helpers";

import { BigNumber } from "bignumber.js";

import BakerRegistryBuild from "../build/baker_registry.json";

module.exports = async (tezos: TezosToolkit, network: string) => {
  dexCoreStorage.storage.managers = [accounts.dev.pkh];
  dexCoreStorage.storage.fees = {
    interface_fee: new BigNumber(0.0005 * 10 ** 18),
    swap_fee: new BigNumber("2250000000000000"),
    auction_fee: new BigNumber(0.00075 * 10 ** 18),
    withdraw_fee_reward: new BigNumber(0),
  };
  dexCoreStorage.storage.admin = accounts.dev.pkh;
  dexCoreStorage.storage.baker_registry =
    BakerRegistryBuild["networks"][network]["baker_registry"];
  dexCoreStorage.storage.baker_rate_f = new BigNumber(0.5 * 10 ** 18);
  dexCoreStorage.storage.default_expiry = new BigNumber(86400 * 365.33); // 1 year
  dexCoreStorage.storage.collecting_period = new BigNumber(86400 * 21); // 21 days

  const dexCoreAddress: string = (await migrate(
    tezos,
    "dex_core",
    dexCoreStorage,
    network,
  ))!;
  const dexCore: DexCore = await DexCore.init(dexCoreAddress, tezos);
  await dexCore.setLambdas();

  console.log(`DexCore: ${dexCoreAddress}`);
};
