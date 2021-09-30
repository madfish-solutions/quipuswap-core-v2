import {
  OriginationOperation,
  TransactionOperation,
  TezosToolkit,
  Contract,
} from "@taquito/taquito";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import { BakerRegistryStorage } from "../types/BakerRegistry";

export class BakerRegistry {
  contract: Contract;
  storage: BakerRegistryStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    bakerRegistryAddress: string,
    tezos: TezosToolkit
  ): Promise<BakerRegistry> {
    return new BakerRegistry(
      await tezos.contract.at(bakerRegistryAddress),
      tezos
    );
  }

  static async originate(
    tezos: TezosToolkit,
    storage: BakerRegistryStorage
  ): Promise<BakerRegistry> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/baker_registry.json`).toString()
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

    return new BakerRegistry(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(keys: string[]): Promise<void> {
    const storage: BakerRegistryStorage = await this.contract.storage();

    this.storage = await keys.reduce(async (prev: any, current: any) => {
      try {
        return {
          ...(await prev),
          [current]: await storage.get(current),
        };
      } catch (ex) {
        return {
          ...(await prev),
          [current]: 0,
        };
      }
    }, Promise.resolve({}));
  }

  async validate(baker: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .validate(baker)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async register(baker: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .register(baker)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}
