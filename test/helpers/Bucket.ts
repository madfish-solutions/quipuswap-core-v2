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
  WithdrawRewards,
  BucketStorage,
  UpdateRewards,
  BanBaker,
  PourOver,
  PourOut,
  Vote,
} from "../types/Bucket";

export class Bucket {
  storage: BucketStorage;
  tezos: TezosToolkit;
  contract: Contract;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    bucketAddress: string,
    tezos: TezosToolkit
  ): Promise<Bucket> {
    return new Bucket(await tezos.contract.at(bucketAddress), tezos);
  }

  static async updateContractInstance(
    bucketAddress: string,
    tezos: TezosToolkit
  ) {
    return await Bucket.init(bucketAddress, tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: BucketStorage
  ): Promise<Bucket> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/bucket.json`).toString()
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

    return new Bucket(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: BucketStorage = await this.contract.storage();

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

  async fill(mutezAmount: number = 0): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .fill([])
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async pourOut(
    params: PourOut,
    mutezAmount: number = 0
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .pour_out(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async pourOver(
    params: PourOver,
    mutezAmount: number = 0
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .pour_over(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawRewards(
    params: WithdrawRewards,
    mutezAmount: number = 0
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .withdraw_rewards(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async banBaker(
    params: BanBaker,
    mutezAmount: number = 0
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .ban_baker(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async vote(
    params: Vote,
    mutezAmount: number = 0
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .vote(params)
      .send({ amount: mutezAmount, mutez: true });

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
    bucketStorage: BucketStorage,
    dexCoreStorage: DexCoreStorage,
    totalSupply: BigNumber,
    nextReward: BigNumber,
    utils: Utils
  ): Promise<UpdateRewards> {
    const level: BigNumber = await utils.getLastBlock();
    let collectingPeriodEnd: BigNumber = bucketStorage.collecting_period_end;

    if (totalSupply.isGreaterThan(0)) {
      const rewardsLevel: BigNumber = level.isGreaterThan(collectingPeriodEnd)
        ? collectingPeriodEnd
        : level;
      const newReward: BigNumber = rewardsLevel
        .minus(bucketStorage.last_update_level)
        .multipliedBy(bucketStorage.reward_per_block);
      let rewardPerShare: BigNumber = bucketStorage.reward_per_share.plus(
        newReward.dividedBy(totalSupply).integerValue(BigNumber.ROUND_DOWN)
      );

      if (level.isGreaterThan(collectingPeriodEnd)) {
        const collectingPeriod: BigNumber =
          dexCoreStorage.storage.collecting_period;
        const periodDuration: BigNumber = level
          .minus(collectingPeriodEnd)
          .dividedBy(collectingPeriod)
          .integerValue(BigNumber.ROUND_DOWN)
          .plus(1)
          .multipliedBy(collectingPeriod);
        const rewardPerBlock: BigNumber = nextReward
          .multipliedBy(PRECISION)
          .dividedBy(periodDuration)
          .integerValue(BigNumber.ROUND_DOWN);
        const newReward: BigNumber = level
          .minus(collectingPeriodEnd)
          .multipliedBy(rewardPerBlock);

        collectingPeriodEnd = collectingPeriodEnd.plus(periodDuration);
        rewardPerShare = rewardPerShare.plus(
          newReward.dividedBy(totalSupply).integerValue(BigNumber.ROUND_DOWN)
        );

        return {
          rewardPerShare: rewardPerShare,
          rewardPerBlock: rewardPerBlock,
          lastUpdateLevel: level,
          collectingPeriodEnd: collectingPeriodEnd,
        };
      }

      return {
        rewardPerShare: rewardPerShare,
        rewardPerBlock: bucketStorage.reward_per_block,
        lastUpdateLevel: level,
        collectingPeriodEnd: bucketStorage.collecting_period_end,
      };
    }

    return {
      rewardPerShare: bucketStorage.reward_per_share,
      rewardPerBlock: bucketStorage.reward_per_block,
      lastUpdateLevel: bucketStorage.last_update_level,
      collectingPeriodEnd: bucketStorage.collecting_period_end,
    };
  }

  static async updateUserRewards(
    bucketStorage: BucketStorage,
    user: string,
    currentBalance: BigNumber,
    newBalance: BigNumber,
    rewardPerShare: BigNumber
  ): Promise<UpdateUserRewards> {
    const currentReward: BigNumber =
      currentBalance.multipliedBy(rewardPerShare);

    return {
      reward_f: bucketStorage.users_rewards[user].reward_f.plus(
        currentReward.minus(bucketStorage.users_rewards[user].reward_paid_f)
      ),
      rewardPaid_f: newBalance.multipliedBy(rewardPerShare),
    };
  }
}
