import { TezosToolkit } from "@taquito/taquito";

import { DexCore } from "../test/helpers/DexCore";

import { flashSwapsProxyStorage } from "../storage/FlashSwapsProxy";

import { migrate } from "../scripts/helpers";

import DexCoreBuild from "../build/dex_core.json";

module.exports = async (tezos: TezosToolkit, network: string) => {
  flashSwapsProxyStorage.dex_core =
    DexCoreBuild["networks"][network]["dex_core"];

  const flashSwapsProxyAddress: string = await migrate(
    tezos,
    "flash_swaps_proxy",
    flashSwapsProxyStorage.dex_core,
    network
  );

  const dexCore: DexCore = await DexCore.init(
    DexCoreBuild["networks"][network]["dex_core"],
    tezos
  );

  await dexCore.setFlashSwapsProxy(flashSwapsProxyAddress);

  console.log(`FlashSwapsProxy: ${flashSwapsProxyAddress}`);
};
