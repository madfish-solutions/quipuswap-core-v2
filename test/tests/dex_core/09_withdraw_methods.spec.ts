import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { PRECISION } from "../../helpers/Constants";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
import { FA12 } from "../../helpers/FA12";
import { FA2 } from "../../helpers/FA2";
import {
  defaultCollectingPeriod,
  defaultCycleDuration,
  defaultVotingPeriod,
  Utils,
} from "../../helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { auctionStorage } from "../../../storage/Auction";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";
import { fa2Storage } from "../../../storage/test/FA2";

import { SBAccount, Token } from "test/types/Common";
import {
  LaunchExchange,
  WithdrawProfit,
  ClaimFee,
  Swap,
} from "test/types/DexCore";

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
    dexCoreStorage.storage.collecting_period = defaultCollectingPeriod;
    dexCoreStorage.storage.cycle_duration = defaultCycleDuration;
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

  it("should fail if pair does not have TEZ store contract (not TOK/TEZ pair)", async () => {
    const params: WithdrawProfit = {
      receiver: alice.pkh,
      pair_id: new BigNumber(0),
    };

    await rejects(dexCore.withdrawProfit(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_TEZ_STORE_404);

      return true;
    });
  });

  it("should fail if reentrancy", async () => {
    const claimParams: ClaimFee = {
      token: { fa12: fa12Token1.contract.address },
      receiver: alice.pkh,
      amount: new BigNumber(0),
    };

    await rejects(dexCore2.claimInterfaceFee(claimParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if insufficient interface fee balance - 1", async () => {
    const claimParams: ClaimFee = {
      token: { fa12: fa12Token1.contract.address },
      receiver: alice.pkh,
      amount: new BigNumber(1),
    };

    await rejects(dexCore.claimInterfaceFee(claimParams), (err: Error) => {
      expect(err.message).to.equal(
        DexCoreErrors.ERR_INSUFFICIENT_INTERFACE_FEE_BALANCE
      );

      return true;
    });
  });

  it("should fail if insufficient interface fee balance - 2", async () => {
    const token: Token = { fa12: fa12Token1.contract.address };
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(333),
      min_amount_out: new BigNumber(0),
    };

    await fa12Token1.approve(dexCore.contract.address, swapParams.amount_in);
    await dexCore.swap(swapParams);
    await dexCore.updateStorage({
      interface_fee: [[token, swapParams.referrer]],
    });

    const availableInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ]
        .dividedBy(PRECISION)
        .integerValue(BigNumber.ROUND_FLOOR);
    const claimParams: ClaimFee = {
      token: token,
      receiver: alice.pkh,
      amount: availableInterfaceFee.plus(1),
    };

    await utils.setProvider(bob.sk);
    await rejects(dexCore.claimInterfaceFee(claimParams), (err: Error) => {
      expect(err.message).to.equal(
        DexCoreErrors.ERR_INSUFFICIENT_INTERFACE_FEE_BALANCE
      );

      return true;
    });
  });

  it("should claim FA1.2 interface fee and transfer it to a receiver - 1", async () => {
    const token: Token = { fa12: fa12Token1.contract.address };
    const receiver: string = carol.pkh;
    const referrer: string = bob.pkh;

    await dexCore.updateStorage({
      interface_fee: [[token, referrer]],
    });
    await fa12Token1.updateStorage({
      ledger: [receiver, dexCore.contract.address],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token.toString()},${referrer}`];
    const prevReceiverTokBalance: BigNumber = fa12Token1.getBalance(receiver);
    const prevDexCoreTokBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const claimParams: ClaimFee = {
      token: token,
      receiver: receiver,
      amount: new BigNumber(25),
    };

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
      prevInterfaceFee.minus(claimParams.amount.multipliedBy(PRECISION))
    );
    expect(currReceiverTokBalance).to.be.bignumber.equal(
      prevReceiverTokBalance.plus(claimParams.amount)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.minus(claimParams.amount)
    );
  });

  it("should claim FA1.2 interface fee and transfer it to a receiver - 2", async () => {
    const token: Token = { fa12: fa12Token1.contract.address };
    const receiver: string = alice.pkh;
    const referrer: string = bob.pkh;

    await dexCore.updateStorage({
      interface_fee: [[token, referrer]],
    });
    await fa12Token1.updateStorage({
      ledger: [receiver, dexCore.contract.address],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token.toString()},${referrer}`];
    const prevReceiverTokBalance: BigNumber = fa12Token1.getBalance(receiver);
    const prevDexCoreTokBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const claimParams: ClaimFee = {
      token: token,
      receiver: receiver,
      amount: prevInterfaceFee
        .dividedBy(PRECISION)
        .integerValue(BigNumber.ROUND_FLOOR),
    };

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
      prevInterfaceFee.minus(claimParams.amount.multipliedBy(PRECISION))
    );
    expect(currReceiverTokBalance).to.be.bignumber.equal(
      prevReceiverTokBalance.plus(claimParams.amount)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.minus(claimParams.amount)
    );
  });

  it("should claim FA2 interface fee and transfer it to a receiver - 1", async () => {
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
    const prevReceiverTokBalance: BigNumber = await fa2Token1.getBalance(
      receiver
    );
    const prevDexCoreTokBalance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const claimParams: ClaimFee = {
      token: token,
      receiver: receiver,
      amount: new BigNumber(30),
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
      prevInterfaceFee.minus(claimParams.amount.multipliedBy(PRECISION))
    );
    expect(currReceiverTokBalance).to.be.bignumber.equal(
      prevReceiverTokBalance.plus(claimParams.amount)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.minus(claimParams.amount)
    );
  });

  it("should claim FA2 interface fee and transfer it to a receiver - 2", async () => {
    const token: Token = {
      fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
    };
    const receiver: string = alice.pkh;
    const referrer: string = bob.pkh;

    await dexCore.updateStorage({
      interface_fee: [[token, referrer]],
    });
    await fa2Token1.updateStorage({
      account_info: [receiver, dexCore.contract.address],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token.toString()},${referrer}`];
    const prevReceiverTokBalance: BigNumber = await fa2Token1.getBalance(
      receiver
    );
    const prevDexCoreTokBalance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const claimParams: ClaimFee = {
      token: token,
      receiver: receiver,
      amount: prevInterfaceFee
        .dividedBy(PRECISION)
        .integerValue(BigNumber.ROUND_FLOOR),
    };

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
      prevInterfaceFee.minus(claimParams.amount.multipliedBy(PRECISION))
    );
    expect(currReceiverTokBalance).to.be.bignumber.equal(
      prevReceiverTokBalance.plus(claimParams.amount)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.minus(claimParams.amount)
    );
  });

  it("should claim TEZ interface fee and transfer it to a receiver - 1", async () => {
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
      interface_fee: [[token, referrer]],
      interface_tez_fee: [[pairId, referrer]],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token},${referrer}`];
    const prevInterfaceTezFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[`${pairId},${referrer}`];
    const prevTezReceiverBalance: BigNumber = await utils.tezos.tz.getBalance(
      receiver
    );
    const prevTezDexCoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevTezTezStoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );
    const claimParams: ClaimFee = {
      token: token,
      receiver: receiver,
      amount: new BigNumber(35),
    };

    await utils.setProvider(bob.sk);
    await dexCore.claimInterfaceFee(claimParams);
    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token, referrer]],
      interface_tez_fee: [[pairId, referrer]],
    });

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token},${referrer}`];
    const currInterfaceTezFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[`${pairId},${referrer}`];
    const currTezReceiverBalance: BigNumber = await utils.tezos.tz.getBalance(
      receiver
    );
    const currTezDexCoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currTezTezStoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.minus(claimParams.amount.multipliedBy(PRECISION))
    );
    expect(currInterfaceTezFee).to.be.bignumber.equal(prevInterfaceTezFee);
    expect(currTezReceiverBalance).to.be.bignumber.equal(
      prevTezReceiverBalance.plus(claimParams.amount)
    );
    expect(currTezDexCoreBalance).to.be.bignumber.equal(
      prevTezDexCoreBalance.minus(claimParams.amount)
    );
    expect(currTezTezStoreBalance).to.be.bignumber.equal(
      prevTezTezStoreBalance
    );
  });

  it("should claim TEZ interface fee and transfer it to a receiver - 2", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const token: Token = { tez: undefined };
    const receiver: string = alice.pkh;
    const referrer: string = bob.pkh;

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token, referrer]],
      interface_tez_fee: [[pairId, referrer]],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token},${referrer}`];
    const prevInterfaceTezFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[`${pairId},${referrer}`];
    const prevTezReceiverBalance: BigNumber = await utils.tezos.tz.getBalance(
      receiver
    );
    const prevTezDexCoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevTezTezStoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );
    const claimParams: ClaimFee = {
      token: token,
      receiver: receiver,
      amount: prevInterfaceFee
        .dividedBy(PRECISION)
        .integerValue(BigNumber.ROUND_FLOOR),
    };

    await dexCore.claimInterfaceFee(claimParams);
    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token, referrer]],
      interface_tez_fee: [[pairId, referrer]],
    });

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token},${referrer}`];
    const currInterfaceTezFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[`${pairId},${referrer}`];
    const currTezReceiverBalance: BigNumber = await utils.tezos.tz.getBalance(
      receiver
    );
    const currTezDexCoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currTezTezStoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.minus(claimParams.amount.multipliedBy(PRECISION))
    );
    expect(currInterfaceTezFee).to.be.bignumber.equal(prevInterfaceTezFee);
    expect(currTezReceiverBalance).to.be.bignumber.equal(
      prevTezReceiverBalance.plus(claimParams.amount)
    );
    expect(currTezDexCoreBalance).to.be.bignumber.equal(
      prevTezDexCoreBalance.minus(claimParams.amount)
    );
    expect(currTezTezStoreBalance).to.be.bignumber.equal(
      prevTezTezStoreBalance
    );
  });

  it("should fail if reentrancy", async () => {
    const token: Token = { fa12: fa12Token1.contract.address };

    await rejects(dexCore2.withdrawAuctionFee(token), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should withdraw FA1.2 auction fee", async () => {
    const token: Token = { fa12: fa12Token1.contract.address };

    await dexCore.updateStorage({ auction_fee: [token] });
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, auction.contract.address, alice.pkh],
    });

    const prevAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const prevDexCoreTokBal: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAuctionTokBal: BigNumber = fa12Token1.getBalance(
      auction.contract.address
    );
    const prevAliceTokBal: BigNumber = fa12Token1.getBalance(alice.pkh);

    await utils.setProvider(alice.sk);
    await dexCore.withdrawAuctionFee(token);
    await dexCore.updateStorage({ auction_fee: [token] });
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
      dexCore.storage.storage.auction_fee[token.toString()];
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
    const token: Token = {
      fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
    };

    await dexCore.updateStorage({ auction_fee: [token] });
    await fa2Token1.updateStorage({
      account_info: [
        dexCore.contract.address,
        auction.contract.address,
        alice.pkh,
      ],
    });

    const prevAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const prevDexCoreTokBal: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAuctionTokBal: BigNumber = await fa2Token1.getBalance(
      auction.contract.address
    );
    const prevAliceTokBal: BigNumber = await fa2Token1.getBalance(alice.pkh);

    await dexCore.withdrawAuctionFee(token);
    await dexCore.updateStorage({ auction_fee: [token] });
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
      dexCore.storage.storage.auction_fee[token.toString()];
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
    const pairId: BigNumber = new BigNumber(1);
    const token: Token = { tez: undefined };

    await dexCore.updateStorage({
      pairs: [pairId],
      auction_fee: [token],
      auction_tez_fee: [pairId],
    });

    const prevAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const prevAuctionTezFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairId.toString()];
    const prevTezTezStoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );
    const prevDexCoreTokBal: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevAuctionTokBal: BigNumber = await utils.tezos.tz.getBalance(
      auction.contract.address
    );

    await dexCore.withdrawAuctionFee(token);
    await dexCore.updateStorage({
      pairs: [pairId],
      auction_fee: [token],
      auction_tez_fee: [pairId],
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
      dexCore.storage.storage.auction_fee[token.toString()];
    const currAuctionTezFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairId.toString()];
    const currTezTezStoreBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );
    const currDexCoreTokBal: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currAuctionTokBal: BigNumber = await utils.tezos.tz.getBalance(
      auction.contract.address
    );

    expect(currAuctionFee).to.be.bignumber.equal(
      prevAuctionFee.minus(
        userReward.plus(actualAuctionFee).multipliedBy(PRECISION)
      )
    );
    expect(currAuctionTezFee).to.be.bignumber.equal(prevAuctionTezFee);
    expect(currTezTezStoreBalance).to.be.bignumber.equal(
      prevTezTezStoreBalance
    );
    expect(currDexCoreTokBal).to.be.bignumber.equal(
      prevDexCoreTokBal.minus(userReward.plus(actualAuctionFee))
    );
    expect(currAuctionTokBal).to.be.bignumber.equal(
      prevAuctionTokBal.plus(actualAuctionFee)
    );
  });
});
