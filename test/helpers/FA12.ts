import {
  OriginationOperation,
  TransactionOperation,
  TezosToolkit,
  Contract,
} from "@taquito/taquito";

import fs from "fs";

import { BigNumber } from "bignumber.js";

import { confirmOperation } from "../../scripts/confirmation";

import { FA12Storage } from "../types/FA12";

export class FA12 {
  contract: Contract;
  storage: FA12Storage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(fa12Address: string, tezos: TezosToolkit): Promise<FA12> {
    return new FA12(await tezos.contract.at(fa12Address), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: FA12Storage
  ): Promise<FA12> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`test/contracts/fa12.json`).toString()
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

    return new FA12(await tezos.contract.at(operation.contractAddress), tezos);
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: FA12Storage = await this.contract.storage();

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

  async transfer(
    from: string,
    to: string,
    value: BigNumber
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .transfer(from, to, value.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async approve(
    spender: string,
    value: BigNumber
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .approve(spender, value.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  getBalance(user: string): BigNumber {
    return this.storage.ledger[user] !== undefined
      ? this.storage.ledger[user].balance
      : new BigNumber(0);
  }
}
