import { defaultVotingPeriod, Utils } from "../../helpers/Utils";
import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { PRECISION } from "../../helpers/Constants";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
import { Bucket } from "../../helpers/Bucket";
import { FA12 } from "../../helpers/FA12";
import { FA2 } from "../../helpers/FA2";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { auctionStorage } from "../../../storage/Auction";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";
import { fa2Storage } from "../../../storage/test/FA2";

import { SBAccount, Token } from "../../types/Common";
import {
  UpdateUserRewards,
  BucketStorage,
  UpdateRewards,
} from "../../types/Bucket";
import {
  WithdrawAuctionFee,
  LaunchExchange,
  WithdrawProfit,
  ClaimTezFee,
  ClaimFee,
  Swap,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (withdraw methods)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore2: DexCore;
  var auction: Auction;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa2Token1: FA2;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;
  var carol: SBAccount = accounts.carol;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = new BigNumber(3);
    dexCoreStorage.storage.cycle_duration = new BigNumber(1);
    dexCoreStorage.storage.voting_period = defaultVotingPeriod;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;
    dexCoreStorage.storage.fees = {
      interface_fee: new BigNumber(0.25).multipliedBy(PRECISION),
      swap_fee: new BigNumber(0.0005).multipliedBy(PRECISION),
      auction_fee: new BigNumber(0.25).multipliedBy(PRECISION),
      withdraw_fee_reward: new BigNumber(0.05).multipliedBy(PRECISION),
    };

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    dexCoreStorage.storage.entered = true;

    dexCore2 = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();
    await dexCore2.setLambdas();

    fa12Token1 = await FA12.originate(utils.tezos, fa12Storage);
    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = dexCore.contract.address;
    auctionStorage.storage.quipu_token = fa2Token1.contract.address;

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();
    await dexCore.setAuction(auction.contract.address);

    let launchParams: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: launchParams.pair.token_b["fa2"].id,
        },
      },
    ]);
    await dexCore.launchExchange(launchParams);

    launchParams = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );
  });

  it("should fail if reentrancy", async () => {
    const params: WithdrawProfit = {
      receiver: alice.pkh,
      pair_id: new BigNumber(0),
    };

    await rejects(dexCore2.withdrawProfit(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    const params: WithdrawProfit = {
      receiver: alice.pkh,
      pair_id: new BigNumber(666),
    };

    await rejects(dexCore.withdrawProfit(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if pair does not have bucket contract (not TOK/TEZ pair)", async () => {
    const params: WithdrawProfit = {
      receiver: alice.pkh,
      pair_id: new BigNumber(0),
    };

    await rejects(dexCore.withdrawProfit(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_BUCKET_404);

      return true;
    });
  });

  it.skip("should withdraw user's profit - 1", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const amount: BigNumber = new BigNumber(100);
    const receiver: string = bob.pkh;
    const user: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId],
    });

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      utils.tezos
    );

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

  it.skip("should withdraw user's profit - 2", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const receiver: string = bob.pkh;
    const user: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId],
    });

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      utils.tezos
    );

    await utils.bakeBlocks(3);
    await bucket.default(400);
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

    const prevBucketStorage: BucketStorage = bucket.storage;
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

  it("should fail if reentrancy", async () => {
    const claimParams: ClaimFee = {
      token: { fa12: fa12Token1.contract.address },
      receiver: alice.pkh,
    };

    await rejects(dexCore2.claimInterfaceFee(claimParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should claim FA1.2 interface fee and transfer it to a receiver", async () => {
    const token: Token = { fa12: fa12Token1.contract.address };
    const receiver: string = carol.pkh;
    const referrer: string = bob.pkh;
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      receiver: receiver,
      referrer: referrer,
      amount_in: new BigNumber(333),
      min_amount_out: new BigNumber(0),
    };

    await fa12Token1.approve(dexCore.contract.address, swapParams.amount_in);
    await dexCore.swap(swapParams);
    await dexCore.updateStorage({
      interface_fee: [[token, referrer]],
    });
    await fa12Token1.updateStorage({
      ledger: [receiver, dexCore.contract.address],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token.toString()},${referrer}`];
    const actualPrevInterfaceFee: BigNumber = prevInterfaceFee
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR);
    const prevReceiverTokBalance: BigNumber = fa12Token1.getBalance(receiver);
    const prevDexCoreTokBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const claimParams: ClaimFee = {
      token: token,
      receiver: receiver,
    };

    await utils.setProvider(bob.sk);
    await dexCore.claimInterfaceFee(claimParams);
    await dexCore.updateStorage({
      interface_fee: [[token, referrer]],
    });
    await fa12Token1.updateStorage({
      ledger: [receiver, dexCore.contract.address],
    });

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token.toString()},${referrer}`];
    const currReceiverTokBalance: BigNumber = fa12Token1.getBalance(receiver);
    const currDexCoreTokBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.minus(actualPrevInterfaceFee.multipliedBy(PRECISION))
    );
    expect(currReceiverTokBalance).to.be.bignumber.equal(
      prevReceiverTokBalance.plus(actualPrevInterfaceFee)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.minus(actualPrevInterfaceFee)
    );
  });

  it("should claim FA2 interface fee and transfer it to a receiver", async () => {
    const token: Token = {
      fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
    };
    const receiver: string = alice.pkh;
    const referrer: string = bob.pkh;
    const swapParams: Swap = {
      swaps: [{ direction: { b_to_a: undefined }, pair_id: new BigNumber(0) }],
      receiver: receiver,
      referrer: referrer,
      amount_in: new BigNumber(333),
      min_amount_out: new BigNumber(0),
    };

    await utils.setProvider(alice.sk);
    await dexCore.swap(swapParams);
    await dexCore.updateStorage({
      interface_fee: [[token, referrer]],
    });
    await fa2Token1.updateStorage({
      account_info: [receiver, dexCore.contract.address],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token.toString()},${referrer}`];
    const actualPrevInterfaceFee: BigNumber = prevInterfaceFee
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR);
    const prevReceiverTokBalance: BigNumber = await fa2Token1.getBalance(
      receiver
    );
    const prevDexCoreTokBalance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const claimParams: ClaimFee = {
      token: token,
      receiver: receiver,
    };

    await utils.setProvider(bob.sk);
    await dexCore.claimInterfaceFee(claimParams);
    await dexCore.updateStorage({
      interface_fee: [[token, referrer]],
    });
    await fa2Token1.updateStorage({
      account_info: [receiver, dexCore.contract.address],
    });

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token.toString()},${referrer}`];
    const currReceiverTokBalance: BigNumber = await fa2Token1.getBalance(
      receiver
    );
    const currDexCoreTokBalance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.minus(actualPrevInterfaceFee.multipliedBy(PRECISION))
    );
    expect(currReceiverTokBalance).to.be.bignumber.equal(
      prevReceiverTokBalance.plus(actualPrevInterfaceFee)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.minus(actualPrevInterfaceFee)
    );
  });

  it("should fail if reentrancy", async () => {
    const claimParams: ClaimTezFee = {
      pair_id: new BigNumber(0),
      receiver: alice.pkh,
    };

    await rejects(dexCore2.claimInterfaceTezFee(claimParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    const claimParams: ClaimTezFee = {
      pair_id: new BigNumber(666),
      receiver: alice.pkh,
    };

    await rejects(dexCore.claimInterfaceTezFee(claimParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should claim TEZ interface fee and transfer it to a receiver", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const token: Token = { tez: undefined };
    const receiver: string = alice.pkh;
    const referrer: string = bob.pkh;
    const swapParams: Swap = {
      swaps: [{ direction: { b_to_a: undefined }, pair_id: new BigNumber(1) }],
      receiver: receiver,
      referrer: referrer,
      amount_in: new BigNumber(333),
      min_amount_out: new BigNumber(0),
    };

    await utils.setProvider(alice.sk);
    await dexCore.swap(swapParams, swapParams.amount_in.toNumber());
    await dexCore.updateStorage({
      pairs: [pairId],
      interface_tez_fee: [[pairId, referrer]],
    });

    const prevInterfaceTezFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[`${pairId},${referrer}`];
    const actualPrevInterfaceTezFee: BigNumber = prevInterfaceTezFee
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR);
    const prevTezReceiverBalance: BigNumber = await utils.tezos.tz.getBalance(
      receiver
    );
    const prevTezDexCoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevTezBucketBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket
    );
    const claimParams: ClaimTezFee = {
      pair_id: pairId,
      receiver: receiver,
    };

    await utils.setProvider(bob.sk);
    await dexCore.claimInterfaceTezFee(claimParams);
    await dexCore.updateStorage({
      pairs: [pairId],
      interface_tez_fee: [[pairId, referrer]],
    });

    const currInterfaceTezFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[`${pairId},${referrer}`];
    const currTezReceiverBalance: BigNumber = await utils.tezos.tz.getBalance(
      receiver
    );
    const currTezDexCoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currTezBucketBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket
    );

    expect(currInterfaceTezFee).to.be.bignumber.equal(
      prevInterfaceTezFee.minus(
        actualPrevInterfaceTezFee.multipliedBy(PRECISION)
      )
    );
    expect(currTezReceiverBalance).to.be.bignumber.equal(
      prevTezReceiverBalance.plus(actualPrevInterfaceTezFee)
    );
    expect(currTezBucketBalance).to.be.bignumber.equal(
      prevTezBucketBalance.minus(actualPrevInterfaceTezFee)
    );
    expect(currTezDexCoreBalance).to.be.bignumber.equal(prevTezDexCoreBalance);
  });

  it("should fail if reentrancy", async () => {
    const params: WithdrawAuctionFee = {
      pair_id: undefined,
      token: { fa12: fa12Token1.contract.address },
    };

    await rejects(dexCore2.withdrawAuctionFee(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if user did not passed pair ID in time of withdrawing TEZ auction fee", async () => {
    const params: WithdrawAuctionFee = {
      pair_id: undefined,
      token: { tez: undefined },
    };

    await rejects(dexCore.withdrawAuctionFee(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_NO_PAIR_ID);

      return true;
    });
  });

  it("should fail if pair not listed in time of withdrawing TEZ auction fee", async () => {
    const params: WithdrawAuctionFee = {
      pair_id: new BigNumber(666),
      token: { tez: undefined },
    };

    await rejects(dexCore.withdrawAuctionFee(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should withdraw FA1.2 auction fee", async () => {
    const params: WithdrawAuctionFee = {
      pair_id: undefined,
      token: { fa12: fa12Token1.contract.address },
    };

    await dexCore.updateStorage({ auction_fee: [params.token] });
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, auction.contract.address, alice.pkh],
    });

    const prevAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[params.token.toString()];
    const prevDexCoreTokBal: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAuctionTokBal: BigNumber = fa12Token1.getBalance(
      auction.contract.address
    );
    const prevAliceTokBal: BigNumber = fa12Token1.getBalance(alice.pkh);

    await utils.setProvider(alice.sk);
    await dexCore.withdrawAuctionFee(params);
    await dexCore.updateStorage({ auction_fee: [params.token] });
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, auction.contract.address, alice.pkh],
    });

    const userReward: BigNumber = prevAuctionFee
      .multipliedBy(dexCore.storage.storage.fees.withdraw_fee_reward)
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR)
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR);
    const actualAuctionFee: BigNumber = prevAuctionFee
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR)
      .minus(userReward);
    const currAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[params.token.toString()];
    const currDexCoreTokBal: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAuctionTokBal: BigNumber = fa12Token1.getBalance(
      auction.contract.address
    );
    const currAliceTokBal: BigNumber = fa12Token1.getBalance(alice.pkh);

    expect(currAuctionFee).to.be.bignumber.equal(
      prevAuctionFee.minus(
        userReward.plus(actualAuctionFee).multipliedBy(PRECISION)
      )
    );
    expect(currDexCoreTokBal).to.be.bignumber.equal(
      prevDexCoreTokBal.minus(userReward.plus(actualAuctionFee))
    );
    expect(currAuctionTokBal).to.be.bignumber.equal(
      prevAuctionTokBal.plus(actualAuctionFee)
    );
    expect(currAliceTokBal).to.be.bignumber.equal(
      prevAliceTokBal.plus(userReward)
    );
  });

  it("should withdraw FA2 auction fee", async () => {
    const params: WithdrawAuctionFee = {
      pair_id: undefined,
      token: {
        fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
      },
    };

    await dexCore.updateStorage({ auction_fee: [params.token] });
    await fa2Token1.updateStorage({
      account_info: [
        dexCore.contract.address,
        auction.contract.address,
        alice.pkh,
      ],
    });

    const prevAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[params.token.toString()];
    const prevDexCoreTokBal: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAuctionTokBal: BigNumber = await fa2Token1.getBalance(
      auction.contract.address
    );
    const prevAliceTokBal: BigNumber = await fa2Token1.getBalance(alice.pkh);

    await dexCore.withdrawAuctionFee(params);
    await dexCore.updateStorage({ auction_fee: [params.token] });
    await fa2Token1.updateStorage({
      account_info: [
        dexCore.contract.address,
        auction.contract.address,
        alice.pkh,
      ],
    });

    const userReward: BigNumber = prevAuctionFee
      .multipliedBy(dexCore.storage.storage.fees.withdraw_fee_reward)
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR)
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR);
    const actualAuctionFee: BigNumber = prevAuctionFee
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR)
      .minus(userReward);
    const currAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[params.token.toString()];
    const currDexCoreTokBal: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currAuctionTokBal: BigNumber = await fa2Token1.getBalance(
      auction.contract.address
    );
    const currAliceTokBal: BigNumber = await fa2Token1.getBalance(alice.pkh);

    expect(currAuctionFee).to.be.bignumber.equal(
      prevAuctionFee.minus(
        userReward.plus(actualAuctionFee).multipliedBy(PRECISION)
      )
    );
    expect(currDexCoreTokBal).to.be.bignumber.equal(
      prevDexCoreTokBal.minus(userReward.plus(actualAuctionFee))
    );
    expect(currAuctionTokBal).to.be.bignumber.equal(
      prevAuctionTokBal.plus(actualAuctionFee)
    );
    expect(currAliceTokBal).to.be.bignumber.equal(
      prevAliceTokBal.plus(userReward)
    );
  });

  it("should withdraw TEZ auction fee", async () => {
    const params: WithdrawAuctionFee = {
      pair_id: new BigNumber(1),
      token: { tez: undefined },
    };

    await dexCore.updateStorage({
      pairs: [params.pair_id],
      auction_tez_fee: [params.pair_id],
    });

    const prevAuctionTezFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[params.pair_id.toString()];
    const prevTezBucketBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].bucket
    );
    const prevDexCoreTokBal: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevAuctionTokBal: BigNumber = await utils.tezos.tz.getBalance(
      auction.contract.address
    );

    await dexCore.withdrawAuctionFee(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
      auction_tez_fee: [params.pair_id],
    });

    const userReward: BigNumber = prevAuctionTezFee
      .multipliedBy(dexCore.storage.storage.fees.withdraw_fee_reward)
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR)
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR);
    const actualAuctionFee: BigNumber = prevAuctionTezFee
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_FLOOR)
      .minus(userReward);
    const currAuctionTezFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[params.pair_id.toString()];
    const currTezBucketBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].bucket
    );
    const currDexCoreTokBal: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currAuctionTokBal: BigNumber = await utils.tezos.tz.getBalance(
      auction.contract.address
    );

    expect(currAuctionTezFee).to.be.bignumber.equal(
      prevAuctionTezFee.minus(
        userReward.plus(actualAuctionFee).multipliedBy(PRECISION)
      )
    );
    expect(currTezBucketBalance).to.be.bignumber.equal(
      prevTezBucketBalance.minus(userReward.plus(actualAuctionFee))
    );
    expect(currAuctionTokBal).to.be.bignumber.equal(
      prevAuctionTokBal.plus(actualAuctionFee)
    );
    expect(currDexCoreTokBal).to.be.bignumber.equal(prevDexCoreTokBal);
  });
});
