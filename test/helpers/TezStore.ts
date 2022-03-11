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

import { DexCoreStorage, Pair } from "test/types/DexCore";
import { PRECISION } from "./Constants";
import { Utils } from "./Utils";
import {
  UpdateUserRewards,
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
      .send({
        amount: mutezAmount,
        mutez: true,
        fee: 1000000,
        gasLimit: 1040000,
      });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  static async updateRewards(
    tezStoreStorage: TezStoreStorage,
    dexCoreStorage: DexCoreStorage,
    totalSupply: BigNumber,
    utils: Utils
  ): Promise<UpdateRewards> {
    const level: BigNumber = await utils.getLastBlock();
    let collectingPeriodEnds: BigNumber =
      tezStoreStorage.collecting_period_ends;

    if (totalSupply.isGreaterThan(0)) {
      const rewardsLevel: BigNumber = level.isGreaterThan(collectingPeriodEnds)
        ? collectingPeriodEnds
        : level;
      const newReward: BigNumber = rewardsLevel
        .minus(tezStoreStorage.last_update_level)
        .multipliedBy(tezStoreStorage.reward_per_block);
      let rewardPerShare: BigNumber = tezStoreStorage.reward_per_share.plus(
        newReward.dividedBy(totalSupply).integerValue(BigNumber.ROUND_DOWN)
      );

      if (level.isGreaterThan(collectingPeriodEnds)) {
        const collectingPeriod: BigNumber =
          dexCoreStorage.storage.collecting_period;
        const periodDuration: BigNumber = level
          .minus(collectingPeriodEnds)
          .dividedBy(collectingPeriod)
          .integerValue(BigNumber.ROUND_DOWN)
          .plus(1)
          .multipliedBy(collectingPeriod)
          .multipliedBy(dexCoreStorage.storage.cycle_duration);
        const rewardPerBlock: BigNumber = tezStoreStorage.next_reward
          .multipliedBy(PRECISION)
          .dividedBy(periodDuration)
          .integerValue(BigNumber.ROUND_DOWN);
        const newReward: BigNumber = level
          .minus(collectingPeriodEnds)
          .multipliedBy(rewardPerBlock);

        collectingPeriodEnds = collectingPeriodEnds.plus(periodDuration);
        rewardPerShare = rewardPerShare.plus(
          newReward.dividedBy(totalSupply).integerValue(BigNumber.ROUND_DOWN)
        );

        const totalReward: BigNumber = tezStoreStorage.total_reward.plus(
          rewardPerBlock
            .multipliedBy(periodDuration)
            .dividedBy(PRECISION)
            .integerValue(BigNumber.ROUND_DOWN)
        );

        return {
          rewardPerShare: rewardPerShare,
          rewardPerBlock: rewardPerBlock,
          totalReward: totalReward,
          lastUpdateLevel: level,
          collectingPeriodEnds: collectingPeriodEnds,
        };
      }

      return {
        rewardPerShare: rewardPerShare,
        rewardPerBlock: tezStoreStorage.reward_per_block,
        totalReward: tezStoreStorage.total_reward,
        lastUpdateLevel: level,
        collectingPeriodEnds: tezStoreStorage.collecting_period_ends,
      };
    }

    return {
      rewardPerShare: tezStoreStorage.reward_per_share,
      rewardPerBlock: tezStoreStorage.reward_per_block,
      totalReward: tezStoreStorage.total_reward,
      lastUpdateLevel: tezStoreStorage.last_update_level,
      collectingPeriodEnds: tezStoreStorage.collecting_period_ends,
    };
  }

  static async updateUserRewards(
    tezStoreStorage: TezStoreStorage,
    user: string,
    currentBalance: BigNumber,
    newBalance: BigNumber,
    rewardPerShare: BigNumber
  ): Promise<UpdateUserRewards> {
    const currentReward: BigNumber =
      currentBalance.multipliedBy(rewardPerShare);

    return {
      reward_f: tezStoreStorage.users_rewards[user].reward_f.plus(
        currentReward.minus(tezStoreStorage.users_rewards[user].reward_paid_f)
      ),
      rewardPaid_f: newBalance.multipliedBy(rewardPerShare),
    };
  }
}
