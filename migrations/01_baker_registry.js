const { TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { migrate } = require("../scripts/helpers");

const { bakerRegistryStorage } = require("../storage/BakerRegistry");

const env = require("../env");

import accounts from "../scripts/sandbox/accounts";

module.exports = async (tezos) => {
  tezos = new TezosToolkit(tezos.rpc.url);

  tezos.setProvider({
    config: {
      confirmationPollingTimeoutSecond: env.confirmationPollingTimeoutSecond,
    },
    signer: await InMemorySigner.fromSecretKey(accounts.alice.sk),
  });

  const bakerRegistryAddress = await migrate(
    tezos,
    "baker_registry",
    bakerRegistryStorage
  );

  console.log(`BakerRegistry: ${bakerRegistryAddress}`);
};
