import accounts from "./scripts/sandbox/accounts";

export default {
  confirmationPollingTimeoutSecond: 500000,
  syncInterval: 0, // 0 for tests, 5000 for deploying
  confirmTimeout: 90000, // 90000 for tests, 180000 for deploying
  buildDir: "build",
  migrationsDir: "migrations",
  contractsDir: "contracts/main",
  ligoVersion: "0.45.0",
  network: "development",
  networks: {
    development: {
      rpc: "http://localhost:8732",
      network_id: "*",
      secretKey: accounts.alice.sk,
    },
    ghostnet: {
      rpc: "https://rpc.ghostnet.teztnets.xyz",
      port: 443,
      network_id: "*",
      secretKey: accounts.dev.sk,
    },
    jakartanet: {
      rpc: "https://jakartanet.tezos.marigold.dev",
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
