import {
  OriginationOperation,
  TransactionOperation,
  TezosToolkit,
  Contract,
} from "@taquito/taquito";

import fs from "fs";

import { BigNumber } from "bignumber.js";

import { confirmOperation } from "../../scripts/confirmation";

import { UpdateOperator, FA2Storage, Transfer } from "../types/FA2";

export class FA2 {
  contract: Contract;
  storage: FA2Storage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(fa2Address: string, tezos: TezosToolkit): Promise<FA2> {
    return new FA2(await tezos.contract.at(fa2Address), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: FA2Storage
  ): Promise<FA2> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`test/contracts/fa2.json`).toString()
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

    return new FA2(await tezos.contract.at(operation.contractAddress), tezos);
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: FA2Storage = await this.contract.storage();

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

  async transfer(params: Transfer[]): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .transfer(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async updateOperators(
    updateOperatorsParams: UpdateOperator[]
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .update_operators(updateOperatorsParams)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async getBalance(
    user: string,
    tokenId: BigNumber = new BigNumber(0)
  ): Promise<BigNumber> {
    if (
      this.storage.account_info[user] !== undefined &&
      this.storage.account_info[user].balances !== undefined
    ) {
      const balance: BigNumber = await this.storage.account_info[
        user
      ].balances.get(tokenId);

      return balance !== undefined ? new BigNumber(balance) : new BigNumber(0);
    }

    return new BigNumber(0);
  }
}
