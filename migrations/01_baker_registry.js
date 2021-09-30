const { TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");

const { migrate } = require("../scripts/helpers");

const { alice, dev } = require("../scripts/sandbox/accounts");

const { bakerRegistryStorage } = require("../storage/BakerRegistry");

const env = require("../env");

module.exports = async (tezos) => {
  const secretKey = env.network === "development" ? alice.sk : dev.sk;

  tezos = new TezosToolkit(tezos.rpc.url);

  tezos.setProvider({
    config: {
      confirmationPollingTimeoutSecond: env.confirmationPollingTimeoutSecond,
    },
    signer: await InMemorySigner.fromSecretKey(secretKey),
  });

  const bakerRegistryAddress = await migrate(
    tezos,
    "baker_registry",
    bakerRegistryStorage
  );

  console.log(`BakerRegistry: ${bakerRegistryAddress}`);
};
