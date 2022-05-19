import accounts from "./scripts/sandbox/accounts";

export default {
  confirmationPollingTimeoutSecond: 500000,
  syncInterval: 5000, // 0 for tests, 5000 for deploying
  confirmTimeout: 180000, // 90000 for tests, 180000 for deploying
  buildDir: "build",
  migrationsDir: "migrations",
  contractsDir: "contracts/main",
  ligoVersion: "next",
  network: "ithacanet",
  networks: {
    development: {
      rpc: "http://localhost:8732",
      network_id: "*",
      secretKey: accounts.alice.sk,
    },
    ithacanet: {
      rpc: "https://jakartanet.tezos.marigold.dev",
      // rpc: "https://rpc.ithacanet.teztnets.xyz",
      port: 443,
      network_id: "*",
      secretKey: accounts.dev.sk,
    },
    mainnet: {
      rpc: "https://mainnet.api.tez.ie",
      port: 443,
      network_id: "*",
      secretKey: accounts.dev.sk,
    },
  },
};
