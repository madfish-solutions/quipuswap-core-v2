import { FlashSwapsProxy } from "../test/helpers/FlashSwapsProxy";
import { DexCore } from "../test/helpers/DexCore";
import { Utils } from "../test/helpers/Utils";

import { flashSwapsProxyStorage } from "../storage/FlashSwapsProxy";

import accounts from "../scripts/sandbox/accounts";

import DexCoreBuild from "../build/dex_core.json";

import env from "../env";

module.exports = async () => {
  const utils: Utils = new Utils();

  await utils.init(accounts.dev.sk);

  flashSwapsProxyStorage.dex_core =
    DexCoreBuild["networks"][env.network]["dex_core"];

  const flashSwapsProxy: FlashSwapsProxy = await FlashSwapsProxy.originate(
    utils.tezos,
    flashSwapsProxyStorage
  );
  const dexCore: DexCore = await DexCore.init(
    DexCoreBuild["networks"][env.network]["dex_core"],
    utils.tezos
  );

  await dexCore.setFlashSwapsProxy(flashSwapsProxy.contract.address);

  console.log(`FlashSwapsProxy: ${flashSwapsProxy.contract.address}`);
};
