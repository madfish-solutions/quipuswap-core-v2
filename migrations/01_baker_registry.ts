import { BakerRegistry } from "../test/helpers/BakerRegistry";
import { Utils } from "../test/helpers/Utils";

import { bakerRegistryStorage } from "../storage/BakerRegistry";

import accounts from "../scripts/sandbox/accounts";

module.exports = async () => {
  const utils: Utils = new Utils();

  await utils.init(accounts.dev.sk);

  const bakerRegistry: BakerRegistry = await BakerRegistry.originate(
    utils.tezos,
    bakerRegistryStorage
  );

  console.log(`BakerRegistry: ${bakerRegistry.contract.address}`);
};
