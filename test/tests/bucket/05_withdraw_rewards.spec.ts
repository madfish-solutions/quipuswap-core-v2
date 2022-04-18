import { BakerRegistry } from "../../helpers/BakerRegistry";
import { DexCore } from "../../helpers/DexCore";
import { Bucket } from "../../helpers/Bucket";
import { Utils } from "../../helpers/Utils";
import { FA2 } from "../../helpers/FA2";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { bucketStorage } from "../../../storage/test/Bucket";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa2Storage } from "../../../storage/test/FA2";

import { PRECISION } from "../../helpers/Constants";
import { SBAccount } from "../../types/Common";
import { Common } from "../../helpers/Errors";
import {
  UpdateUserRewards,
  WithdrawRewards,
  BucketStorage,
  UpdateRewards,
} from "../../types/Bucket";
import {
  DexCoreStorage,
  LaunchExchange,
  WithdrawProfit,
  Pair,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe.skip("Bucket (withdraw rewards)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;
  var bucket2: Bucket;
  var bucket: Bucket;
  var fa2Token1: FA2;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  var pairId: BigNumber = new BigNumber(0);

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = new BigNumber(3);
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    const launchParams: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );
    await dexCore.updateStorage({
      pairs: [pairId],
    });

    bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      dexCore.tezos
    );

    bucketStorage.baker_registry = bakerRegistry.contract.address;
    bucketStorage.dex_core = alice.pkh;

    bucket2 = await Bucket.originate(utils.tezos, bucketStorage);
  });

  it("should fail if not dex core is trying to withdraw rewards", async () => {
    const params: WithdrawRewards = {
      receiver: alice.pkh,
      user: alice.pkh,
      current_balance: new BigNumber(0),
      new_balance: new BigNumber(0),
    };

    await rejects(bucket.withdrawRewards(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const params: WithdrawRewards = {
      receiver: alice.pkh,
      user: alice.pkh,
      current_balance: new BigNumber(0),
      new_balance: new BigNumber(0),
    };

    await rejects(bucket2.withdrawRewards(params, 1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should withdraw user's rewards - 1", async () => {
    const amount: BigNumber = new BigNumber(100);
    const receiver: string = bob.pkh;
    const user: string = alice.pkh;

    await bucket.default(amount.toNumber());
    await utils.bakeBlocks(4);
    await dexCore.updateStorage({
      pairs: [pairId],
      ledger: [[user, pairId]],
    });
    await bucket.updateStorage({
      users_rewards: [user],
    });

    const withdrawProfitParams: WithdrawProfit = {
      receiver: receiver,
      pair_id: pairId,
    };

    await dexCore.withdrawProfit(withdrawProfitParams);

    const expectedRewardsInfo: UpdateRewards = await Bucket.updateRewards(
      bucket.storage,
      dexCore.storage,
      dexCore.storage.storage.pairs[pairId.toFixed()].total_supply,
      utils
    );
    const expectedUserRewardsInfo: UpdateUserRewards =
      await Bucket.updateUserRewards(
        bucket.storage,
        user,
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        expectedRewardsInfo.rewardPerShare
      );
    const actualReward: BigNumber = expectedUserRewardsInfo.reward_f
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_DOWN);

    await bucket.updateStorage({
      users_rewards: [user],
    });

    expect(bucket.storage.reward_paid).to.be.bignumber.equal(actualReward);
    expect(bucket.storage.users_rewards[user].reward_f).to.be.bignumber.equal(
      expectedUserRewardsInfo.reward_f.minus(
        actualReward.multipliedBy(PRECISION)
      )
    );
    expect(
      bucket.storage.users_rewards[user].reward_paid_f
    ).to.be.bignumber.equal(expectedUserRewardsInfo.rewardPaid_f);
  });

  it("should withdraw user's rewards - 2", async () => {
    const receiver: string = bob.pkh;
    const user: string = alice.pkh;

    await bucket.default(400);
    await utils.bakeBlocks(5);
    await dexCore.updateStorage({
      pairs: [pairId],
      ledger: [[user, pairId]],
    });
    await bucket.updateStorage({
      users_rewards: [user],
    });

    const prevBucketStorage: BucketStorage = bucket.storage;
    const withdrawProfitParams: WithdrawProfit = {
      receiver: receiver,
      pair_id: pairId,
    };

    await dexCore.withdrawProfit(withdrawProfitParams);

    const expectedRewardsInfo: UpdateRewards = await Bucket.updateRewards(
      prevBucketStorage,
      dexCore.storage,
      dexCore.storage.storage.pairs[pairId.toFixed()].total_supply,
      utils
    );
    const expectedUserRewardsInfo: UpdateUserRewards =
      await Bucket.updateUserRewards(
        prevBucketStorage,
        user,
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        expectedRewardsInfo.rewardPerShare
      );
    const actualReward: BigNumber = expectedUserRewardsInfo.reward_f
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_DOWN);

    await bucket.updateStorage({
      users_rewards: [user],
    });

    expect(bucket.storage.reward_paid).to.be.bignumber.equal(
      prevBucketStorage.reward_paid.plus(actualReward)
    );
    expect(bucket.storage.users_rewards[user].reward_f).to.be.bignumber.equal(
      expectedUserRewardsInfo.reward_f.minus(
        actualReward.multipliedBy(PRECISION)
      )
    );
    expect(
      bucket.storage.users_rewards[user].reward_paid_f
    ).to.be.bignumber.equal(expectedUserRewardsInfo.rewardPaid_f);
  });

  it("should update global rewards", async () => {
    await bucket.default(200);
    await utils.bakeBlocks(3);
    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await bucket.updateStorage();

    const prevBucketStorage: BucketStorage = bucket.storage;
    const prevDexCoreStorage: DexCoreStorage = dexCore.storage;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const withdrawProfitParams: WithdrawProfit = {
      receiver: bob.pkh,
      pair_id: pairId,
    };

    await dexCore.withdrawProfit(withdrawProfitParams);
    await bucket.updateStorage();

    const expectedRewardsInfo: UpdateRewards = await Bucket.updateRewards(
      prevBucketStorage,
      prevDexCoreStorage,
      prevPair.total_supply,
      utils
    );

    expect(bucket.storage.reward_per_share).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerShare
    );
    expect(bucket.storage.reward_per_block).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerBlock
    );
    expect(bucket.storage.next_reward).to.be.bignumber.equal(
      prevBucketStorage.next_reward
    );
    expect(bucket.storage.last_update_level).to.be.bignumber.equal(
      expectedRewardsInfo.lastUpdateLevel
    );
    expect(bucket.storage.collecting_period_end).to.be.bignumber.equal(
      expectedRewardsInfo.collectingPeriodEnd
    );
  });

  it("should update user rewards", async () => {
    const user: string = alice.pkh;

    await bucket.default(200);
    await utils.bakeBlocks(5);
    await dexCore.updateStorage({
      pairs: [pairId],
      ledger: [[user, pairId]],
    });
    await bucket.updateStorage({
      users_rewards: [user],
    });

    const prevBucketStorage: BucketStorage = bucket.storage;
    const prevDexCoreStorage: DexCoreStorage = dexCore.storage;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const withdrawProfitParams: WithdrawProfit = {
      receiver: bob.pkh,
      pair_id: pairId,
    };

    await dexCore.withdrawProfit(withdrawProfitParams);

    const expectedRewardsInfo: UpdateRewards = await Bucket.updateRewards(
      prevBucketStorage,
      prevDexCoreStorage,
      prevPair.total_supply,
      utils
    );
    const expectedUserRewardsInfo: UpdateUserRewards =
      await Bucket.updateUserRewards(
        prevBucketStorage,
        user,
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        expectedRewardsInfo.rewardPerShare
      );
    const actualReward: BigNumber = expectedUserRewardsInfo.reward_f
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_DOWN);

    await bucket.updateStorage({
      users_rewards: [user],
    });

    expect(bucket.storage.users_rewards[user].reward_f).to.be.bignumber.equal(
      expectedUserRewardsInfo.reward_f.minus(
        actualReward.multipliedBy(PRECISION)
      )
    );
    expect(
      bucket.storage.users_rewards[user].reward_paid_f
    ).to.be.bignumber.equal(expectedUserRewardsInfo.rewardPaid_f);
  });
});
