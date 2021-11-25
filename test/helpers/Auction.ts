import {
  OriginationOperation,
  WalletParamsWithKind,
  WalletOperationBatch,
  WalletOperation,
  TezosToolkit,
  Contract,
  OpKind,
} from "@taquito/taquito";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import dexCorelambdas from "../../build/lambdas/dex_core_lambdas.json";

import { AuctionStorage } from "../types/Auction";

export class Auction {
  contract: Contract;
  storage: AuctionStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    auctionAddress: string,
    tezos: TezosToolkit
  ): Promise<Auction> {
    return new Auction(await tezos.contract.at(auctionAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: AuctionStorage
  ): Promise<Auction> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/auction.json`).toString()
    );
    const operation: OriginationOperation = await tezos.contract
      .originate({
        code: artifacts.michelson,
        storage: storage,
      })
      .catch((e) => {
        console.error(e);

        return null;
      });

    await confirmOperation(tezos, operation.hash);

    return new Auction(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: AuctionStorage = await this.contract.storage();

    this.storage = {
      storage: storage.storage,
      auction_lambdas: storage.auction_lambdas,
      metadata: storage.metadata,
    };

    for (const key in maps) {
      this.storage.storage[key] = await maps[key].reduce(
        async (prev: any, current: any) => {
          try {
            return {
              ...(await prev),
              [current]: await storage.storage[key].get(current),
            };
          } catch (ex) {
            return {
              ...(await prev),
              [current]: 0,
            };
          }
        },
        Promise.resolve({})
      );
    }
  }

  async setLambdas(): Promise<void> {
    let params: WalletParamsWithKind[] = [];
    const parts: number = 1;

    for (let i: number = 0; i < dexCorelambdas.length; ) {
      for (
        let j: number = 0;
        j < Math.ceil(dexCorelambdas.length / parts);
        ++j
      ) {
        if (i + j >= dexCorelambdas.length) break;

        params.push({
          kind: OpKind.TRANSACTION,
          ...this.contract.methods
            .setup_func(i + j, dexCorelambdas[i + j])
            .toTransferParams(),
        });
      }

      const batch: WalletOperationBatch = this.tezos.wallet.batch(params);
      const operation: WalletOperation = await batch.send();

      await confirmOperation(this.tezos, operation.opHash);

      params = [];
      i += Math.ceil(dexCorelambdas.length / parts);
    }
  }
}
