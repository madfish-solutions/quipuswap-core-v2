import { BakerRegistry } from "../../helpers/BakerRegistry";
import { DexCore } from "../../helpers/DexCore";
import { Bucket } from "../../helpers/Bucket";
import { Utils } from "../../helpers/Utils";
import { FA2 } from "../../helpers/FA2";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa2Storage } from "../../../storage/test/FA2";

import { BucketStorage, UpdateRewards } from "../../types/Bucket";
import { SBAccount } from "../../types/Common";
import {
  DivestLiquidity,
  DexCoreStorage,
  LaunchExchange,
  TokensPerShare,
  Pair,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("Bucket (default)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;
  var fa2Token1: FA2;
  var bucket: Bucket;
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
    dexCoreStorage.storage.collecting_period = new BigNumber(4);
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
  });

  it("should update global rewards - 1", async () => {
    const amount: BigNumber = new BigNumber(100);

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await bucket.updateStorage();

    const prevBucketStorage: BucketStorage = bucket.storage;
    const prevDexCoreStorage: DexCoreStorage = dexCore.storage;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    await bucket.default(amount.toNumber());
    await bucket.updateStorage();

    const expectedRewardsInfo: UpdateRewards = await Bucket.updateRewards(
      prevBucketStorage,
      prevDexCoreStorage,
      prevPair.total_supply,
      prevBucketStorage.next_reward.plus(amount),
      utils
    );

    expect(bucket.storage.reward_per_share).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerShare
    );
    expect(bucket.storage.reward_per_block).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerBlock
    );
    expect(bucket.storage.next_reward).to.be.bignumber.equal(
      prevBucketStorage.next_reward.plus(amount)
    );
    expect(bucket.storage.last_update_level).to.be.bignumber.equal(
      expectedRewardsInfo.lastUpdateLevel
    );
    expect(bucket.storage.collecting_period_end).to.be.bignumber.equal(
      expectedRewardsInfo.collectingPeriodEnd
    );
  });

  it("should update global rewards - 2", async () => {
    const amount: BigNumber = new BigNumber(500);

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await bucket.updateStorage();

    const prevBucketStorage: BucketStorage = bucket.storage;
    const prevDexCoreStorage: DexCoreStorage = dexCore.storage;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    await utils.bakeBlocks(2);
    await bucket.default(amount.toNumber());
    await bucket.updateStorage();

    const expectedRewardsInfo: UpdateRewards = await Bucket.updateRewards(
      prevBucketStorage,
      prevDexCoreStorage,
      prevPair.total_supply,
      prevBucketStorage.next_reward.plus(amount),
      utils
    );

    expect(bucket.storage.reward_per_share).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerShare
    );
    expect(bucket.storage.reward_per_block).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerBlock
    );
    expect(bucket.storage.next_reward).to.be.bignumber.equal(new BigNumber(0));
    expect(bucket.storage.last_update_level).to.be.bignumber.equal(
      expectedRewardsInfo.lastUpdateLevel
    );
    expect(bucket.storage.collecting_period_end).to.be.bignumber.equal(
      expectedRewardsInfo.collectingPeriodEnd
    );
  });

  it("should update global rewards - 3", async () => {
    const amount: BigNumber = new BigNumber(999);

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await bucket.updateStorage();

    const prevBucketStorage: BucketStorage = bucket.storage;
    const prevDexCoreStorage: DexCoreStorage = dexCore.storage;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    await utils.bakeBlocks(2);
    await bucket.default(amount.toNumber());
    await bucket.updateStorage();

    const expectedRewardsInfo: UpdateRewards = await Bucket.updateRewards(
      prevBucketStorage,
      prevDexCoreStorage,
      prevPair.total_supply,
      prevBucketStorage.next_reward.plus(amount),
      utils
    );

    expect(bucket.storage.reward_per_share).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerShare
    );
    expect(bucket.storage.reward_per_block).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerBlock
    );
    expect(bucket.storage.next_reward).to.be.bignumber.equal(new BigNumber(0));
    expect(bucket.storage.last_update_level).to.be.bignumber.equal(
      expectedRewardsInfo.lastUpdateLevel
    );
    expect(bucket.storage.collecting_period_end).to.be.bignumber.equal(
      expectedRewardsInfo.collectingPeriodEnd
    );
  });

  it("should update global rewards - 4", async () => {
    const amount: BigNumber = new BigNumber(1000);

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await bucket.updateStorage();

    const prevBucketStorage: BucketStorage = bucket.storage;
    const prevDexCoreStorage: DexCoreStorage = dexCore.storage;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    await utils.bakeBlocks(5);
    await bucket.default(amount.toNumber());
    await bucket.updateStorage();

    const expectedRewardsInfo: UpdateRewards = await Bucket.updateRewards(
      prevBucketStorage,
      prevDexCoreStorage,
      prevPair.total_supply,
      prevBucketStorage.next_reward.plus(amount),
      utils
    );

    expect(bucket.storage.reward_per_share).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerShare
    );
    expect(bucket.storage.reward_per_block).to.be.bignumber.equal(
      expectedRewardsInfo.rewardPerBlock
    );
    expect(bucket.storage.next_reward).to.be.bignumber.equal(new BigNumber(0));
    expect(bucket.storage.last_update_level).to.be.bignumber.equal(
      expectedRewardsInfo.lastUpdateLevel
    );
    expect(bucket.storage.collecting_period_end).to.be.bignumber.equal(
      expectedRewardsInfo.collectingPeriodEnd
    );
  });

  it("should not update global rewards if pair total supply is 0", async () => {
    const amount: BigNumber = new BigNumber(100);
    const shares: BigNumber = new BigNumber(100);

    await dexCore.updateStorage({
      pairs: [pairId],
    });

    const divestedTokens: TokensPerShare = DexCore.getTokensPerShare(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_amt,
      min_token_b_out: divestedTokens.token_b_amt,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await dexCore.divestLiquidity(divestParams);
    await bucket.updateStorage();

    const prevBucketStorage: BucketStorage = bucket.storage;

    await bucket.default(amount.toNumber());
    await bucket.updateStorage();

    expect(bucket.storage.reward_per_share).to.be.bignumber.equal(
      prevBucketStorage.reward_per_share
    );
    expect(bucket.storage.reward_per_block).to.be.bignumber.equal(
      prevBucketStorage.reward_per_block
    );
    expect(bucket.storage.next_reward).to.be.bignumber.equal(
      prevBucketStorage.next_reward.plus(amount)
    );
    expect(bucket.storage.last_update_level).to.be.bignumber.equal(
      prevBucketStorage.last_update_level
    );
    expect(bucket.storage.collecting_period_end).to.be.bignumber.equal(
      prevBucketStorage.collecting_period_end
    );
  });
});
