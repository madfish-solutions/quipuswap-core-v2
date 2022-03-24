import { BakerRegistry } from "../../helpers/BakerRegistry";
import { TezStore } from "../../helpers/TezStore";
import { DexCore } from "../../helpers/DexCore";
import { Utils } from "../../helpers/Utils";
import { FA2 } from "../../helpers/FA2";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa2Storage } from "../../../storage/test/FA2";

import { PRECISION } from "../../helpers/Constants";
import { SBAccount } from "../../types/Common";
import { Common } from "../../helpers/Errors";
import {
  UpdateUserRewards,
  WithdrawRewards,
  TezStoreStorage,
  UpdateRewards,
} from "../../types/TezStore";
import {
  DexCoreStorage,
  LaunchExchange,
  WithdrawProfit,
  Pair,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe.skip("TezStore (withdraw rewards)", async () => {
  var bakerRegistry: BakerRegistry;
  var tezStore: TezStore;
  var dexCore: DexCore;
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
    dexCoreStorage.storage.cycle_duration = new BigNumber(1);
    dexCoreStorage.storage.voting_period = new BigNumber(10);
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

    tezStore = await TezStore.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store,
      dexCore.tezos
    );
  });

  it("should fail if not dex core is trying to withdraw rewards", async () => {
    const params: WithdrawRewards = {
      receiver: alice.pkh,
      user: alice.pkh,
      current_balance: new BigNumber(0),
      new_balance: new BigNumber(0),
    };

    await rejects(tezStore.withdrawRewards(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should withdraw user's rewards - 1", async () => {
    const amount: BigNumber = new BigNumber(100);
    const receiver: string = bob.pkh;
    const user: string = alice.pkh;

    await tezStore.default(amount.toNumber());
    await utils.bakeBlocks(4);
    await dexCore.updateStorage({
      pairs: [pairId],
      ledger: [[user, pairId]],
    });
    await tezStore.updateStorage({
      users_rewards: [user],
    });

    const withdrawProfitParams: WithdrawProfit = {
      receiver: receiver,
      pair_id: pairId,
    };

    await dexCore.withdrawProfit(withdrawProfitParams);

    const expectedRewardsInfo: UpdateRewards = await TezStore.updateRewards(
      tezStore.storage,
      dexCore.storage,
      dexCore.storage.storage.pairs[pairId.toFixed()].total_supply,
      utils
    );
    const expectedUserRewardsInfo: UpdateUserRewards =
      await TezStore.updateUserRewards(
        tezStore.storage,
        user,
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        expectedRewardsInfo.rewardPerShare
      );
    const actualReward: BigNumber = expectedUserRewardsInfo.reward_f
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_DOWN);

    await tezStore.updateStorage({
      users_rewards: [user],
    });

    expect(tezStore.storage.reward_paid).to.be.bignumber.equal(actualReward);
    expect(tezStore.storage.users_rewards[user].reward_f).to.be.bignumber.equal(
      expectedUserRewardsInfo.reward_f.minus(
        actualReward.multipliedBy(PRECISION)
      )
    );
    expect(
      tezStore.storage.users_rewards[user].reward_paid_f
    ).to.be.bignumber.equal(expectedUserRewardsInfo.rewardPaid_f);
  });

  it("should withdraw user's rewards - 2", async () => {
    const receiver: string = bob.pkh;
    const user: string = alice.pkh;

    await tezStore.default(400);
    await utils.bakeBlocks(5);
    await dexCore.updateStorage({
      pairs: [pairId],
      ledger: [[user, pairId]],
    });
    await tezStore.updateStorage({
      users_rewards: [user],
    });

    const prevTezStoreStorage: TezStoreStorage = tezStore.storage;
    const withdrawProfitParams: WithdrawProfit = {
      receiver: receiver,
      pair_id: pairId,
    };

    await dexCore.withdrawProfit(withdrawProfitParams);

    const expectedRewardsInfo: UpdateRewards = await TezStore.updateRewards(
      prevTezStoreStorage,
      dexCore.storage,
      dexCore.storage.storage.pairs[pairId.toFixed()].total_supply,
      utils
    );
    const expectedUserRewardsInfo: UpdateUserRewards =
      await TezStore.updateUserRewards(
        prevTezStoreStorage,
        user,
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        expectedRewardsInfo.rewardPerShare
      );
    const actualReward: BigNumber = expectedUserRewardsInfo.reward_f
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_DOWN);

    await tezStore.updateStorage({
      users_rewards: [user],
    });

    expect(tezStore.storage.reward_paid).to.be.bignumber.equal(
      prevTezStoreStorage.reward_paid.plus(actualReward)
    );
    expect(tezStore.storage.users_rewards[user].reward_f).to.be.bignumber.equal(
      expectedUserRewardsInfo.reward_f.minus(
        actualReward.multipliedBy(PRECISION)
      )
    );
    expect(
      tezStore.storage.users_rewards[user].reward_paid_f
    ).to.be.bignumber.equal(expectedUserRewardsInfo.rewardPaid_f);
  });

  it("should update global rewards", async () => {
    await tezStore.default(200);
    await utils.bakeBlocks(3);
    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tezStore.updateStorage();

    const prevTezStoreStorage: TezStoreStorage = tezStore.storage;
    const prevDexCoreStorage: DexCoreStorage = dexCore.storage;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const withdrawProfitParams: WithdrawProfit = {
      receiver: bob.pkh,
      pair_id: pairId,
    };

    await dexCore.withdrawProfit(withdrawProfitParams);
    await tezStore.updateStorage();

    const expectedRewardsInfo: UpdateRewards = await TezStore.updateRewards(
      prevTezStoreStorage,
      prevDexCoreStorage,
      prevPair.total_supply,
      utils
    );

    expect(tezStore.storage.reward_per_share).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerShare
    );
    expect(tezStore.storage.reward_per_block).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerBlock
    );
    expect(tezStore.storage.next_reward).to.be.bignumber.equal(
      prevTezStoreStorage.next_reward
    );
    expect(tezStore.storage.last_update_level).to.be.bignumber.equal(
      expectedRewardsInfo.lastUpdateLevel
    );
    expect(tezStore.storage.collecting_period_end).to.be.bignumber.equal(
      expectedRewardsInfo.collectingPeriodEnd
    );
  });

  it("should update user rewards", async () => {
    const user: string = alice.pkh;

    await tezStore.default(200);
    await utils.bakeBlocks(5);
    await dexCore.updateStorage({
      pairs: [pairId],
      ledger: [[user, pairId]],
    });
    await tezStore.updateStorage({
      users_rewards: [user],
    });

    const prevTezStoreStorage: TezStoreStorage = tezStore.storage;
    const prevDexCoreStorage: DexCoreStorage = dexCore.storage;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const withdrawProfitParams: WithdrawProfit = {
      receiver: bob.pkh,
      pair_id: pairId,
    };

    await dexCore.withdrawProfit(withdrawProfitParams);

    const expectedRewardsInfo: UpdateRewards = await TezStore.updateRewards(
      prevTezStoreStorage,
      prevDexCoreStorage,
      prevPair.total_supply,
      utils
    );
    const expectedUserRewardsInfo: UpdateUserRewards =
      await TezStore.updateUserRewards(
        prevTezStoreStorage,
        user,
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        dexCore.storage.storage.ledger[`${user},${pairId}`],
        expectedRewardsInfo.rewardPerShare
      );
    const actualReward: BigNumber = expectedUserRewardsInfo.reward_f
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_DOWN);

    await tezStore.updateStorage({
      users_rewards: [user],
    });

    expect(tezStore.storage.users_rewards[user].reward_f).to.be.bignumber.equal(
      expectedUserRewardsInfo.reward_f.minus(
        actualReward.multipliedBy(PRECISION)
      )
    );
    expect(
      tezStore.storage.users_rewards[user].reward_paid_f
    ).to.be.bignumber.equal(expectedUserRewardsInfo.rewardPaid_f);
  });
});
