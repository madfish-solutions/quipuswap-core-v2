import { OriginationOperation, TezosToolkit, Contract } from "@taquito/taquito";

import fs from "fs";

import { confirmOperation } from "../../scripts/confirmation";

import { FlashSwapAgentStorage } from "../types/FlashSwapAgent";

export class FlashSwapAgent {
  contract: Contract;
  storage: FlashSwapAgentStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    flashSwapAgentAddress: string,
    tezos: TezosToolkit
  ): Promise<FlashSwapAgent> {
    return new FlashSwapAgent(
      await tezos.contract.at(flashSwapAgentAddress),
      tezos
    );
  }

  static async originate(
    tezos: TezosToolkit,
    storage: FlashSwapAgentStorage
  ): Promise<FlashSwapAgent> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`test/contracts/flash_swap_agent.json`).toString()
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

    return new FlashSwapAgent(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(): Promise<void> {
    this.storage = await this.contract.storage();
  }
}
