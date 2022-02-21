import {
  OriginationOperation,
  TransactionOperation,
  TezosToolkit,
  Contract,
} from "@taquito/taquito";

import fs from "fs";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import { BigNumber } from "bignumber.js";

import { Pair } from "test/types/DexCore";
import { Utils } from "./Utils";
import {
  TezStoreStorage,
  WithdrawRewards,
  UpdateRewards,
  DivestTez,
  BanBaker,
  Vote,
} from "../types/TezStore";

export class TezStore {
  storage: TezStoreStorage;
  tezos: TezosToolkit;
  contract: Contract;

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

  static async updateContractInstance(
    tezStoreAddress: string,
    tezos: TezosToolkit
  ) {
    return await TezStore.init(tezStoreAddress, tezos);
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
    const operation: TransactionOperation = await this.contract.methodsObject
      .divest_tez(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawRewards(
    params: WithdrawRewards
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .withdraw_rewards(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async banBaker(params: BanBaker): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .ban_baker(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async vote(params: Vote): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .vote(params)
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

  async updateRewards(
    amount: BigNumber,
    storage: TezStoreStorage,
    pair: Pair,
    utils: Utils
  ): Promise<UpdateRewards> {
    const totalSupply: BigNumber = pair.total_supply;

    if (totalSupply.gt(new BigNumber(0))) {
      const rewardsLevel: BigNumber = new BigNumber(
        await utils.getLastBlock()
      ).gt(storage.collecting_period_ends)
        ? storage.collecting_period_ends
        : new BigNumber(await utils.getLastBlock());
      const newReward: BigNumber = rewardsLevel
        .minus(storage.last_update_level)
        .multipliedBy(storage.reward_per_block);

      return {
        rewardPerShare: storage.reward_per_share.plus(
          newReward.dividedBy(totalSupply).integerValue(BigNumber.ROUND_DOWN)
        ),
        nextReward: storage.next_reward.plus(amount),
        lastUpdateLevel: new BigNumber(await utils.getLastBlock()),
      };
    }

    return {
      rewardPerShare: storage.reward_per_share,
      nextReward: storage.next_reward,
      lastUpdateLevel: storage.last_update_level,
    };
  }
}
