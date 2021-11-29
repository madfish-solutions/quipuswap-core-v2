import {
  OriginationOperation,
  TransactionOperation,
  TezosToolkit,
  Contract,
} from "@taquito/taquito";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import {
  TezStoreStorage,
  WithdrawRewards,
  DivestTez,
  BanBaker,
  Vote,
} from "../types/TezStore";

import { Utils } from "./Utils";

export class TezStore {
  contract: Contract;
  storage: TezStoreStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    tezStoreAddress: string,
    tezos: TezosToolkit
  ): Promise<TezStore> {
    return new TezStore(await tezos.contract.at(tezStoreAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: TezStoreStorage
  ): Promise<TezStore> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/tez_store.json`).toString()
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

    return new TezStore(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: TezStoreStorage = await this.contract.storage();

    this.storage = storage;

    for (const key in maps) {
      this.storage[key] = await maps[key].reduce(
        async (prev: any, current: any) => {
          try {
            return {
              ...(await prev),
              [current]: await storage[key].get(current),
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

  async investTez(
    user: string,
    mutezAmount: number = 0
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .invest_tez(user)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async divestTez(params: DivestTez): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .divest_tez(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawRewards(
    params: WithdrawRewards
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .withdraw_rewards(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async banBaker(params: BanBaker): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .ban_baker(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async vote(params: Vote): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .vote(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async default(mutezAmount: number = 0): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .default([])
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}
