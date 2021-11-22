import {
  OriginationOperation,
  TransactionOperation,
  WalletParamsWithKind,
  WalletOperationBatch,
  WalletOperation,
  TezosToolkit,
  Contract,
  OpKind,
} from "@taquito/taquito";

import fs from "fs";

import { BigNumber } from "bignumber.js";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import dexCorelambdas from "../../build/lambdas/dex_core_lambdas.json";

import { Utils } from "./Utils";

import {
  UpdateTokenMetadata,
  LaunchExchange,
  DexCoreStorage,
  AddManager,
  Fees,
  Ban,
} from "../types/DexCore";

export class DexCore {
  contract: Contract;
  storage: DexCoreStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    dexCoreAddress: string,
    tezos: TezosToolkit
  ): Promise<DexCore> {
    return new DexCore(await tezos.contract.at(dexCoreAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: DexCoreStorage
  ): Promise<DexCore> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/dex_core.json`).toString()
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

    return new DexCore(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: DexCoreStorage = await this.contract.storage();

    this.storage = {
      storage: storage.storage,
      dex_core_lambdas: storage.dex_core_lambdas,
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
    const parts: number = 6;

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

  async launchExchange(
    params: LaunchExchange,
    mutezAmount: number = 0
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .launch_exchange(...Utils.destructObj(params))
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setAdmin(newAdmin: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_admin(newAdmin)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async confirmAdmin(): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .confirm_admin([])
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async addManagers(params: AddManager[]): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .add_managers(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setFees(params: Fees): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_fees(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setCycleDuration(
    cycleDuration: BigNumber
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_cycle_duration(cycleDuration.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async updateTokenMetadata(
    params: UpdateTokenMetadata
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .update_token_metadata(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async ban(params: Ban): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .ban(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}
