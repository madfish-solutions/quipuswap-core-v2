import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { zeroAddress } from "../test/helpers/Utils";

import { DexCoreStorage } from "../test/types/DexCore";

export const dexCoreStorage: DexCoreStorage = {
  storage: {
    token_metadata: MichelsonMap.fromLiteral({}),
    ledger: MichelsonMap.fromLiteral({}),
    accounts: MichelsonMap.fromLiteral({}),
    tokens: MichelsonMap.fromLiteral({}),
    token_to_id: MichelsonMap.fromLiteral({}),
    pairs: MichelsonMap.fromLiteral({}),
    permits: new MichelsonMap(),
    interface_fee: MichelsonMap.fromLiteral({}),
    interface_tez_fee: MichelsonMap.fromLiteral({}),
    auction_fee: MichelsonMap.fromLiteral({}),
    auction_tez_fee: MichelsonMap.fromLiteral({}),
    managers: [],
    fees: {
      interface_fee: new BigNumber(0),
      swap_fee: new BigNumber(0),
      auction_fee: new BigNumber(0),
      withdraw_fee_reward: new BigNumber(0),
    },
    admin: zeroAddress,
    pending_admin: undefined,
    baker_registry: zeroAddress,
    flash_swaps_proxy: zeroAddress,
    auction: zeroAddress,
    permits_counter: new BigNumber(0),
    default_expiry: new BigNumber(0),
    entered: false,
    tokens_count: new BigNumber(0),
    collecting_period: new BigNumber(0),
  },
  dex_core_lambdas: MichelsonMap.fromLiteral({}),
  metadata: MichelsonMap.fromLiteral({
    "": Buffer.from("tezos-storage:core", "ascii").toString("hex"),
    core: Buffer.from(
      JSON.stringify({
        name: "QuipuSwap Exchange 2.0",
        version: "v1.0.0",
        description:
          "Decentralized exchange for the Tezos based-assets featured with flash loans and price oracle.",
        authors: ["Madfish.Solutions <https://www.madfish.solutions>"],
        source: {
          tools: ["Ligo", "Flextesa"],
        },
        homepage: "https://quipuswap.com",
        interfaces: ["TZIP-16"],
        errors: [],
        views: [],
      }),
      "ascii"
    ).toString("hex"),
  }),
};
