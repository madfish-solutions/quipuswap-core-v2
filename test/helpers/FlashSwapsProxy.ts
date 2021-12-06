import {
  OriginationOperation,
  TransactionOperation,
  TezosToolkit,
  Contract,
} from "@taquito/taquito";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import { FlashSwapsProxyStorage } from "../types/FlashSwapsProxy";

export class FlashSwapsProxy {
  contract: Contract;
  storage: FlashSwapsProxyStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    flashSwapsProxyAddress: string,
    tezos: TezosToolkit
  ): Promise<FlashSwapsProxy> {
    return new FlashSwapsProxy(
      await tezos.contract.at(flashSwapsProxyAddress),
      tezos
    );
  }

  static async originate(
    tezos: TezosToolkit,
    storage: FlashSwapsProxyStorage
  ): Promise<FlashSwapsProxy> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/flash_swaps_proxy.json`).toString()
    );
    const operation: OriginationOperation = await tezos.contract
      .originate({
        code: artifacts.michelson,
        storage: storage.dex_core,
      })
      .catch((e) => {
        console.error(e);

        return null;
      });

    await confirmOperation(tezos, operation.hash);

    return new FlashSwapsProxy(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(): Promise<void> {
    this.storage = await this.contract.storage();
  }

  async call(params: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .default(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}
