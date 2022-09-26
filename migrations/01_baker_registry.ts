import { TezosToolkit } from "@taquito/taquito";

import { bakerRegistryStorage } from "../storage/BakerRegistry";

import { migrate } from "../scripts/helpers";

module.exports = async (tezos: TezosToolkit, network: string) => {
  const bakerRegistryAddress: string = await migrate(
    tezos,
    "baker_registry",
    bakerRegistryStorage,
    network,
  );

  console.log(`BakerRegistry: ${bakerRegistryAddress}`);
};
