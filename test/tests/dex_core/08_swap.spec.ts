import { Common, DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { PRECISION } from "../../helpers/Constants";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
import { FA12 } from "../../helpers/FA12";
import { FA2 } from "../../helpers/FA2";
import {
  defaultCollectingPeriod,
  zeroAddress,
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

import { SBAccount, Token } from "../../types/Common";
import {
  DivestLiquidity,
  TokensPerShare,
  LaunchExchange,
  CalculateSwap,
  Swap,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (swap)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore2: DexCore;
  var auction: Auction;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa12Token2: FA12;
  var fa12Token3: FA12;
  var fa2Token1: FA2;
  var fa2Token2: FA2;
  var fa2Token3: FA2;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

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
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;
    dexCoreStorage.storage.fees = {
      interface_fee: new BigNumber(0.0025).multipliedBy(PRECISION),
      swap_fee: new BigNumber(0.0005).multipliedBy(PRECISION),
      auction_fee: new BigNumber(0.0005).multipliedBy(PRECISION),
      withdraw_fee_reward: new BigNumber(0.0005).multipliedBy(PRECISION),
    };

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    dexCoreStorage.storage.entered = true;

    dexCore2 = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();
    await dexCore2.setLambdas();

    fa12Token1 = await FA12.originate(utils.tezos, fa12Storage);
    fa12Token2 = await FA12.originate(utils.tezos, fa12Storage);
    fa12Token3 = await FA12.originate(utils.tezos, fa12Storage);
    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);
    fa2Token2 = await FA2.originate(utils.tezos, fa2Storage);
    fa2Token3 = await FA2.originate(utils.tezos, fa2Storage);

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = dexCore.contract.address;
    auctionStorage.storage.quipu_token.token = fa2Token1.contract.address;

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();

    let launchParams: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );

    launchParams = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: launchParams.pair.token_a["fa2"].id,
        },
      },
    ]);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );

    launchParams = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { fa12: fa12Token2.contract.address },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    launchParams = DexCore.changeTokensOrderInPair(launchParams, false);

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await fa12Token2.approve(dexCore.contract.address, launchParams.token_b_in);
    await dexCore.launchExchange(launchParams);

    launchParams = {
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
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(launchParams);

    launchParams = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: {
          fa2: { token: fa2Token2.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    launchParams = DexCore.changeTokensOrderInPair(launchParams, false);

    await fa2Token2.updateOperators([
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
        token_a: { fa12: fa12Token3.contract.address },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token3.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(launchParams);

    launchParams = {
      pair: {
        token_a: { fa12: fa12Token3.contract.address },
        token_b: {
          fa2: { token: fa2Token2.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token3.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(launchParams);

    launchParams = {
      pair: {
        token_a: { fa12: fa12Token3.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token3.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );
  });

  it("should fail if reentrancy", async () => {
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000),
      receiver: zeroAddress,
      referrer: zeroAddress,
      amount_in: new BigNumber(0),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await rejects(dexCore2.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if action is outdated", async () => {
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000),
      receiver: alice.pkh,
      referrer: alice.pkh,
      amount_in: new BigNumber(1),
      min_amount_out: new BigNumber(1),
      flash: false,
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_ACTION_OUTDATED);

      return true;
    });
  });

  it("should fail if empty route", async () => {
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1),
      min_amount_out: new BigNumber(1),
      flash: false,
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_EMPTY_ROUTE);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [
        { direction: { a_to_b: undefined }, pair_id: new BigNumber(666) },
      ],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1),
      min_amount_out: new BigNumber(1),
      flash: false,
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if wrong TEZ amount was sent to swap", async () => {
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { b_to_a: undefined }, pair_id: new BigNumber(0) }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_TEZ_AMOUNT);

      return true;
    });
  });

  it("should fail if a user expects too high min out", async () => {
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(5),
      min_amount_out: new BigNumber(5),
      flash: false,
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_HIGH_MIN_OUT);

      return true;
    });
  });

  it("should fail if user passed zero amount in", async () => {
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(0),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_ZERO_IN);

      return true;
    });
  });

  it("should fail if user put a wrong route", async () => {
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [
        { direction: { a_to_b: undefined }, pair_id: new BigNumber(0) },
        { direction: { a_to_b: undefined }, pair_id: new BigNumber(0) },
      ],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(5),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_ROUTE);

      return true;
    });
  });

  it("should fail if from token isn't TEZ and positive TEZ tokens amount were passed", async () => {
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(5),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await rejects(dexCore.swap(swapParams, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should swap FA1.2 token to TEZ without referral code", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const token: Token = { fa12: fa12Token1.contract.address };
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(5),
      min_amount_out: new BigNumber(4),
      flash: false,
    };

    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTokBalance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const prevDexCoreTokBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevBobTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bob.pkh
    );

    await dexCore.updateStorage({ pairs: [pairId] });

    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket
    );
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    await fa12Token1.approve(dexCore.contract.address, swapParams.amount_in);
    await dexCore.swap(swapParams);
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTokBalance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const currDexCoreTokBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currBobTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bob.pkh
    );
    const currBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool,
      prevToPool
    );

    expect(currAliceTokBalance).to.be.bignumber.equal(
      prevAliceTokBalance.minus(swapParams.amount_in)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.plus(swapParams.amount_in)
    );
    expect(currBobTezBalance).to.be.bignumber.equal(
      prevBobTezBalance.plus(swapResult.out)
    );
    expect(currBucketTezBalance).to.be.bignumber.equal(
      prevBucketTezBalance.minus(swapResult.out)
    );

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ];
    const currTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    expect(currInterfaceFee).to.be.bignumber.equal(swapResult.interfaceFee);
    expect(currTokAuctionFee).to.be.bignumber.equal(swapResult.auctionFee);
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap FA2 token to TEZ with referral code", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const token: Token = {
      fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
    };
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(10),
      min_amount_out: new BigNumber(9),
      flash: false,
      referral_code: 42
    };

    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTokBalance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const prevDexCoreTokBalance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevBobTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bob.pkh
    );

    await dexCore.updateStorage({ pairs: [pairId] });

    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket
    );
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    await dexCore.swap(swapParams);
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTokBalance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const currDexCoreTokBalance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currBobTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bob.pkh
    );
    const currBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool,
      prevToPool
    );

    expect(currAliceTokBalance).to.be.bignumber.equal(
      prevAliceTokBalance.minus(swapParams.amount_in)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.plus(swapParams.amount_in)
    );
    expect(currBobTezBalance).to.be.bignumber.equal(
      prevBobTezBalance.plus(swapResult.out)
    );
    expect(currBucketTezBalance).to.be.bignumber.equal(
      prevBucketTezBalance.minus(swapResult.out)
    );

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token},${swapParams.referrer}`];
    const currAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    expect(currInterfaceFee).to.be.bignumber.equal(swapResult.interfaceFee);
    expect(currAuctionFee).to.be.bignumber.equal(swapResult.auctionFee);
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap TEZ to FA1.2 token", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(50),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTokBalance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const prevDexCoreTokBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({ pairs: [pairId] });

    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket
    );
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;

    await dexCore.swap(swapParams, swapParams.amount_in.toNumber());
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTokBalance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const currDexCoreTokBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_tez_fee: [[pairId, swapParams.referrer]],
      auction_tez_fee: [pairId],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool,
      prevToPool
    );

    expect(currAliceTokBalance).to.be.bignumber.equal(
      prevAliceTokBalance.plus(swapResult.out)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.minus(swapResult.out)
    );
    expect(currBucketTezBalance).to.be.bignumber.equal(
      prevBucketTezBalance.plus(swapParams.amount_in)
    );

    const currInterfaceTezFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairId},${swapParams.referrer}`
      ];
    const currAuctionTezFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairId.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;

    expect(currInterfaceTezFee).to.be.bignumber.equal(swapResult.interfaceFee);
    expect(currAuctionTezFee).to.be.bignumber.equal(swapResult.auctionFee);
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap TEZ to FA2 token", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(100),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTokBalance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const prevDexCoreTokBalance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      pairs: [pairId],
    });

    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket
    );
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;

    await dexCore.swap(swapParams, swapParams.amount_in.toNumber());
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTokBalance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const currDexCoreTokBalance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_tez_fee: [[pairId, swapParams.referrer]],
      auction_tez_fee: [pairId],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool,
      prevToPool
    );

    expect(currAliceTokBalance).to.be.bignumber.equal(
      prevAliceTokBalance.plus(swapResult.out)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.minus(swapResult.out)
    );
    expect(currBucketTezBalance).to.be.bignumber.equal(
      prevBucketTezBalance.plus(swapParams.amount_in)
    );

    const currInterfaceTezFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairId},${swapParams.referrer}`
      ];
    const currAuctionTezFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairId.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;

    expect(currInterfaceTezFee).to.be.bignumber.equal(swapResult.interfaceFee);
    expect(currAuctionTezFee).to.be.bignumber.equal(swapResult.auctionFee);
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap FA1.2 token to FA1.2 token", async () => {
    const pairId: BigNumber = new BigNumber(2);
    const token1: Token = {
      fa12: Utils.getMinFA12Token(
        fa12Token1.contract.address,
        fa12Token2.contract.address
      ),
    };
    const token2: Token = {
      fa12: Utils.getMaxFA12Token(
        fa12Token1.contract.address,
        fa12Token2.contract.address
      ),
    };
    const token1Contract: FA12 = await FA12.init(token1.fa12, utils.tezos);
    const token2Contract: FA12 = await FA12.init(token2.fa12, utils.tezos);
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(400),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await token1Contract.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await token2Contract.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTok1Balance: BigNumber = token1Contract.getBalance(
      alice.pkh
    );
    const prevDexCoreTok1Balance: BigNumber = token1Contract.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber = token2Contract.getBalance(
      alice.pkh
    );
    const prevDexCoreTok2Balance: BigNumber = token2Contract.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ] || new BigNumber(0);
    const prevAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()] ||
      new BigNumber(0);
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    await token1Contract.approve(
      dexCore.contract.address,
      swapParams.amount_in
    );
    await dexCore.swap(swapParams);
    await token1Contract.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await token2Contract.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTok1Balance: BigNumber = token1Contract.getBalance(
      alice.pkh
    );
    const currDexCoreTok1Balance: BigNumber = token1Contract.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber = token2Contract.getBalance(
      alice.pkh
    );
    const currDexCoreTok2Balance: BigNumber = token2Contract.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool,
      prevToPool
    );

    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(swapParams.amount_in)
    );
    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(swapParams.amount_in)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.plus(swapResult.out)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.minus(swapResult.out)
    );

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ];
    const currAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.plus(swapResult.interfaceFee)
    );
    expect(currAuctionFee).to.be.bignumber.equal(
      prevAuctionFee.plus(swapResult.auctionFee)
    );
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap FA1.2 token to FA2 token", async () => {
    const pairId: BigNumber = new BigNumber(3);
    const token: Token = { fa12: fa12Token1.contract.address };
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(333),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const prevDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ];
    const prevAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    await fa12Token1.approve(dexCore.contract.address, swapParams.amount_in);
    await dexCore.swap(swapParams);
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const currDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool,
      prevToPool
    );

    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(swapParams.amount_in)
    );
    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(swapParams.amount_in)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.plus(swapResult.out)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.minus(swapResult.out)
    );

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ];
    const currAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.plus(swapResult.interfaceFee)
    );
    expect(currAuctionFee).to.be.bignumber.equal(
      prevAuctionFee.plus(swapResult.auctionFee)
    );
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap FA2 token to FA1.2 token", async () => {
    const pairId: BigNumber = new BigNumber(3);
    const token: Token = {
      fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
    };
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(666),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const prevDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ];
    const prevAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;

    await dexCore.swap(swapParams);
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const currDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool,
      prevToPool
    );

    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.plus(swapResult.out)
    );
    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.minus(swapResult.out)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.minus(swapParams.amount_in)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.plus(swapParams.amount_in)
    );

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ];
    const currAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.plus(swapResult.interfaceFee)
    );
    expect(currAuctionFee).to.be.bignumber.equal(
      prevAuctionFee.plus(swapResult.auctionFee)
    );
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap FA2 token to FA2 token", async () => {
    const pairId: BigNumber = new BigNumber(4);
    const token1: Token = {
      fa2: Utils.getMinFA2Token(
        { token: fa2Token1.contract.address, id: new BigNumber(0) },
        { token: fa2Token2.contract.address, id: new BigNumber(0) }
      ),
    };
    const token2: Token = {
      fa2: Utils.getMaxFA2Token(
        { token: fa2Token1.contract.address, id: new BigNumber(0) },
        { token: fa2Token2.contract.address, id: new BigNumber(0) }
      ),
    };
    const token1Contract: FA2 = await FA2.init(token1.fa2.token, utils.tezos);
    const token2Contract: FA2 = await FA2.init(token2.fa2.token, utils.tezos);
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(999),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await token1Contract.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });
    await token2Contract.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTok1Balance: BigNumber = await token1Contract.getBalance(
      alice.pkh
    );
    const prevDexCoreTok1Balance: BigNumber = await token1Contract.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber = await token2Contract.getBalance(
      alice.pkh
    );
    const prevDexCoreTok2Balance: BigNumber = await token2Contract.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ] || new BigNumber(0);
    const prevAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()] ||
      new BigNumber(0);
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    await dexCore.swap(swapParams);
    await token1Contract.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });
    await token2Contract.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTok1Balance: BigNumber = await token1Contract.getBalance(
      alice.pkh
    );
    const currDexCoreTok1Balance: BigNumber = await token1Contract.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber = await token2Contract.getBalance(
      alice.pkh
    );
    const currDexCoreTok2Balance: BigNumber = await token2Contract.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool,
      prevToPool
    );

    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(swapParams.amount_in)
    );
    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(swapParams.amount_in)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.plus(swapResult.out)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.minus(swapResult.out)
    );

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ];
    const currAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.plus(swapResult.interfaceFee)
    );
    expect(currAuctionFee).to.be.bignumber.equal(
      prevAuctionFee.plus(swapResult.auctionFee)
    );
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should fail if pair does not have a liquidity", async () => {
    const pairId: BigNumber = new BigNumber(2);
    const shares: BigNumber = new BigNumber(5_000_000);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
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

    const swapParams: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(100),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_NO_LIQUIDITY);

      return true;
    });
  });

  it("should swap using FA1.2 -> FA2 -> FA1.2 route", async () => {
    const pairIds: BigNumber[] = [new BigNumber(3), new BigNumber(5)];
    const token1: Token = { fa12: fa12Token1.contract.address };
    const token2: Token = {
      fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
    };
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [
        { direction: { a_to_b: undefined }, pair_id: pairIds[0] },
        { direction: { b_to_a: undefined }, pair_id: pairIds[1] },
      ],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(500),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa12Token3.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const prevDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok3Balance: BigNumber = fa12Token3.getBalance(alice.pkh);
    const prevDexCoreTok3Balance: BigNumber = fa12Token3.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const prevTok1InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ];
    const prevTok1AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];

    await dexCore.updateStorage({
      pairs: pairIds,
      interface_fee: [[token2, swapParams.referrer]],
      auction_fee: [token2],
    });

    const prevTok2InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token2.toString()},${swapParams.referrer}`
      ];
    const prevTok2AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token2.toString()];
    const prevFromPool1: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_a_pool;
    const prevFromPool2: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_b_pool;
    const prevToPool1: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_b_pool;
    const prevToPool2: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_a_pool;

    await fa12Token1.approve(dexCore.contract.address, swapParams.amount_in);
    await dexCore.swap(swapParams);
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa12Token3.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const currDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok3Balance: BigNumber = fa12Token3.getBalance(alice.pkh);
    const currDexCoreTok3Balance: BigNumber = fa12Token3.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const swapResult1: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool1,
      prevToPool1
    );
    const swapResult2: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapResult1.out,
      prevFromPool2,
      prevToPool2
    );

    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(swapParams.amount_in)
    );
    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(swapParams.amount_in)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(prevAliceTok2Balance);
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance
    );
    expect(currAliceTok3Balance).to.be.bignumber.equal(
      prevAliceTok3Balance.plus(swapResult2.out)
    );
    expect(currDexCoreTok3Balance).to.be.bignumber.equal(
      prevDexCoreTok3Balance.minus(swapResult2.out)
    );

    const currTok1InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ];
    const currTok1AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];

    await dexCore.updateStorage({
      pairs: pairIds,
      interface_fee: [[token2, swapParams.referrer]],
      auction_fee: [token2],
    });

    const currTok2InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token2.toString()},${swapParams.referrer}`
      ];
    const currTok2AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token2.toString()];
    const currPair1FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_a_pool;
    const currPair1ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_b_pool;
    const currPair2FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_b_pool;
    const currPair2ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_a_pool;

    expect(currTok1InterfaceFee).to.be.bignumber.equal(
      prevTok1InterfaceFee.plus(swapResult1.interfaceFee)
    );
    expect(currTok2InterfaceFee).to.be.bignumber.equal(
      prevTok2InterfaceFee.plus(swapResult2.interfaceFee)
    );
    expect(currTok1AuctionFee).to.be.bignumber.equal(
      prevTok1AuctionFee.plus(swapResult1.auctionFee)
    );
    expect(currTok2AuctionFee).to.be.bignumber.equal(
      prevTok2AuctionFee.plus(swapResult2.auctionFee)
    );
    expect(currPair1FromPool).to.be.bignumber.equal(swapResult1.newFromPool);
    expect(currPair1ToPool).to.be.bignumber.equal(swapResult1.newToPool);
    expect(currPair2FromPool).to.be.bignumber.equal(swapResult2.newFromPool);
    expect(currPair2ToPool).to.be.bignumber.equal(swapResult2.newToPool);
  });

  it("should swap using FA1.2 -> FA2 -> FA1.2 -> FA2 route", async () => {
    const pairIds: BigNumber[] = [
      new BigNumber(3),
      new BigNumber(5),
      new BigNumber(6),
    ];
    const token1: Token = { fa12: fa12Token1.contract.address };
    const token2: Token = {
      fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
    };
    const token3: Token = { fa12: fa12Token3.contract.address };
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [
        { direction: { a_to_b: undefined }, pair_id: pairIds[0] },
        { direction: { b_to_a: undefined }, pair_id: pairIds[1] },
        { direction: { a_to_b: undefined }, pair_id: pairIds[2] },
      ],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(999),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa12Token3.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token2.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const prevDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok3Balance: BigNumber = fa12Token3.getBalance(alice.pkh);
    const prevDexCoreTok3Balance: BigNumber = fa12Token3.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok4Balance: BigNumber = await fa2Token2.getBalance(
      alice.pkh
    );
    const prevDexCoreTok4Balance: BigNumber = await fa2Token2.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const prevTok1InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ];
    const prevTok1AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];

    await dexCore.updateStorage({
      interface_fee: [[token2, swapParams.referrer]],
      auction_fee: [token2],
    });

    const prevTok2InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token2.toString()},${swapParams.referrer}`
      ];
    const prevTok2AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token2.toString()];

    await dexCore.updateStorage({
      pairs: pairIds,
      interface_fee: [[token3, swapParams.referrer]],
      auction_fee: [token3],
    });

    const prevTok3InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token3.toString()},${swapParams.referrer}`
      ] || new BigNumber(0);
    const prevTok3AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token3.toString()] ||
      new BigNumber(0);
    const prevFromPool1: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_a_pool;
    const prevFromPool2: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_b_pool;
    const prevFromPool3: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_a_pool;
    const prevToPool1: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_b_pool;
    const prevToPool2: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_a_pool;
    const prevToPool3: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_b_pool;

    await fa12Token1.approve(dexCore.contract.address, swapParams.amount_in);
    await dexCore.swap(swapParams);
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa12Token3.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token2.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const currDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok3Balance: BigNumber = fa12Token3.getBalance(alice.pkh);
    const currDexCoreTok3Balance: BigNumber = fa12Token3.getBalance(
      dexCore.contract.address
    );
    const currAliceTok4Balance: BigNumber = await fa2Token2.getBalance(
      alice.pkh
    );
    const currDexCoreTok4Balance: BigNumber = await fa2Token2.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const swapResult1: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool1,
      prevToPool1
    );
    const swapResult2: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapResult1.out,
      prevFromPool2,
      prevToPool2
    );
    const swapResult3: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapResult2.out,
      prevFromPool3,
      prevToPool3
    );

    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(swapParams.amount_in)
    );
    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(swapParams.amount_in)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(prevAliceTok2Balance);
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance
    );
    expect(currAliceTok3Balance).to.be.bignumber.equal(prevAliceTok3Balance);
    expect(currDexCoreTok3Balance).to.be.bignumber.equal(
      prevDexCoreTok3Balance
    );
    expect(currAliceTok4Balance).to.be.bignumber.equal(
      prevAliceTok4Balance.plus(swapResult3.out)
    );
    expect(currDexCoreTok4Balance).to.be.bignumber.equal(
      prevDexCoreTok4Balance.minus(swapResult3.out)
    );

    const currTok1InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ];
    const currTok1AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];

    await dexCore.updateStorage({
      interface_fee: [[token2, swapParams.referrer]],
      auction_fee: [token2],
    });

    const currTok2InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token2.toString()},${swapParams.referrer}`
      ];
    const currTok2AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token2.toString()];

    await dexCore.updateStorage({
      pairs: pairIds,
      interface_fee: [[token3, swapParams.referrer]],
      auction_fee: [token3],
    });

    const currTok3InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token3.toString()},${swapParams.referrer}`
      ];
    const currTok3AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token3.toString()];
    const currPair1FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_a_pool;
    const currPair1ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_b_pool;
    const currPair2FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_b_pool;
    const currPair2ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_a_pool;
    const currPair3FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_a_pool;
    const currPair3ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_b_pool;

    expect(currTok1InterfaceFee).to.be.bignumber.equal(
      prevTok1InterfaceFee.plus(swapResult1.interfaceFee)
    );
    expect(currTok2InterfaceFee).to.be.bignumber.equal(
      prevTok2InterfaceFee.plus(swapResult2.interfaceFee)
    );
    expect(currTok3InterfaceFee).to.be.bignumber.equal(
      prevTok3InterfaceFee.plus(swapResult3.interfaceFee)
    );
    expect(currTok1AuctionFee).to.be.bignumber.equal(
      prevTok1AuctionFee.plus(swapResult1.auctionFee)
    );
    expect(currTok2AuctionFee).to.be.bignumber.equal(
      prevTok2AuctionFee.plus(swapResult2.auctionFee)
    );
    expect(currTok3AuctionFee).to.be.bignumber.equal(
      prevTok3AuctionFee.plus(swapResult3.auctionFee)
    );
    expect(currPair1FromPool).to.be.bignumber.equal(swapResult1.newFromPool);
    expect(currPair1ToPool).to.be.bignumber.equal(swapResult1.newToPool);
    expect(currPair2FromPool).to.be.bignumber.equal(swapResult2.newFromPool);
    expect(currPair2ToPool).to.be.bignumber.equal(swapResult2.newToPool);
    expect(currPair3FromPool).to.be.bignumber.equal(swapResult3.newFromPool);
    expect(currPair3ToPool).to.be.bignumber.equal(swapResult3.newToPool);
  });

  it("should swap using TEZ -> FA1.2 -> FA2 -> TEZ route", async () => {
    const pairIds: BigNumber[] = [
      new BigNumber(0),
      new BigNumber(3),
      new BigNumber(1),
    ];
    const token1: Token = { tez: undefined };
    const token2: Token = { fa12: fa12Token1.contract.address };
    const token3: Token = {
      fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
    };
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [
        { direction: { b_to_a: undefined }, pair_id: pairIds[0] },
        { direction: { a_to_b: undefined }, pair_id: pairIds[1] },
        { direction: { a_to_b: undefined }, pair_id: pairIds[2] },
      ],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(100),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await dexCore.updateStorage({
      pairs: pairIds,
    });
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const prevDexCoreTok1Balance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevBucket1TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].bucket
    );
    const prevAliceTok2Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const prevDexCoreTok2Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok3Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const prevDexCoreTok3Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevBobTok4Balance: BigNumber = await utils.tezos.tz.getBalance(
      swapParams.receiver
    );
    const prevDexCoreTok4Balance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevBucket4TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].bucket
    );

    await dexCore.updateStorage({
      interface_tez_fee: [[pairIds[0], swapParams.referrer]],
      auction_tez_fee: [pairIds[0]],
    });

    const prevTok1InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairIds[0]},${swapParams.referrer}`
      ];
    const prevTok1AuctionFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairIds[0].toString()];

    await dexCore.updateStorage({
      interface_fee: [[token2, swapParams.referrer]],
      auction_fee: [token2],
    });

    const prevTok2InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token2.toString()},${swapParams.referrer}`
      ];
    const prevTok2AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token2.toString()];

    await dexCore.updateStorage({
      pairs: pairIds,
      interface_fee: [[token3, swapParams.referrer]],
      auction_fee: [token3],
    });

    const prevTok3InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token3.toString()},${swapParams.referrer}`
      ] || new BigNumber(0);
    const prevTok3AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token3.toString()] ||
      new BigNumber(0);
    const prevFromPool1: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_b_pool;
    const prevFromPool2: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_a_pool;
    const prevFromPool3: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_a_pool;
    const prevToPool1: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_a_pool;
    const prevToPool2: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_b_pool;
    const prevToPool3: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_b_pool;

    await dexCore.swap(swapParams, swapParams.amount_in.toNumber());
    await dexCore.updateStorage({
      pairs: pairIds,
    });
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const currDexCoreTok1Balance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currBucket1TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].bucket
    );
    const currAliceTok2Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const currDexCoreTok2Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok3Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const currDexCoreTok3Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currBobTok4Balance: BigNumber = await utils.tezos.tz.getBalance(
      swapParams.receiver
    );
    const currDexCoreTok4Balance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currBucket4TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].bucket
    );

    await dexCore.updateStorage({
      interface_tez_fee: [[pairIds[0], swapParams.referrer]],
      auction_tez_fee: [pairIds[0]],
    });

    const swapResult1: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool1,
      prevToPool1
    );
    const swapResult2: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapResult1.out,
      prevFromPool2,
      prevToPool2
    );
    const swapResult3: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapResult2.out,
      prevFromPool3,
      prevToPool3
    );

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance
    );
    expect(currBucket1TezBalance).to.be.bignumber.equal(
      prevBucket1TezBalance.plus(swapParams.amount_in)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(prevAliceTok2Balance);
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance
    );
    expect(currAliceTok3Balance).to.be.bignumber.equal(prevAliceTok3Balance);
    expect(currDexCoreTok3Balance).to.be.bignumber.equal(
      prevDexCoreTok3Balance
    );
    expect(currBobTok4Balance).to.be.bignumber.equal(
      prevBobTok4Balance.plus(swapResult3.out)
    );
    expect(currDexCoreTok4Balance).to.be.bignumber.equal(
      prevDexCoreTok4Balance
    );
    expect(currBucket4TezBalance).to.be.bignumber.equal(
      prevBucket4TezBalance.minus(swapResult3.out)
    );

    const currTok1InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairIds[0]},${swapParams.referrer}`
      ];
    const currTok1AuctionFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairIds[0].toString()];

    await dexCore.updateStorage({
      interface_fee: [[token2, swapParams.referrer]],
      auction_fee: [token2],
    });

    const currTok2InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token2.toString()},${swapParams.referrer}`
      ];
    const currTok2AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token2.toString()];

    await dexCore.updateStorage({
      pairs: pairIds,
      interface_fee: [[token3, swapParams.referrer]],
      auction_fee: [token3],
    });

    const currTok3InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token3.toString()},${swapParams.referrer}`
      ];
    const currTok3AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token3.toString()];
    const currPair1FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_b_pool;
    const currPair1ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_a_pool;
    const currPair2FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_a_pool;
    const currPair2ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_b_pool;
    const currPair3FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_a_pool;
    const currPair3ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_b_pool;

    expect(currTok1InterfaceFee).to.be.bignumber.equal(
      prevTok1InterfaceFee.plus(swapResult1.interfaceFee)
    );
    expect(currTok2InterfaceFee).to.be.bignumber.equal(
      prevTok2InterfaceFee.plus(swapResult2.interfaceFee)
    );
    expect(currTok3InterfaceFee).to.be.bignumber.equal(
      prevTok3InterfaceFee.plus(swapResult3.interfaceFee)
    );
    expect(currTok1AuctionFee).to.be.bignumber.equal(
      prevTok1AuctionFee.plus(swapResult1.auctionFee)
    );
    expect(currTok2AuctionFee).to.be.bignumber.equal(
      prevTok2AuctionFee.plus(swapResult2.auctionFee)
    );
    expect(currTok3AuctionFee).to.be.bignumber.equal(
      prevTok3AuctionFee.plus(swapResult3.auctionFee)
    );
    expect(currPair1FromPool).to.be.bignumber.equal(swapResult1.newFromPool);
    expect(currPair1ToPool).to.be.bignumber.equal(swapResult1.newToPool);
    expect(currPair2FromPool).to.be.bignumber.equal(swapResult2.newFromPool);
    expect(currPair2ToPool).to.be.bignumber.equal(swapResult2.newToPool);
    expect(currPair3FromPool).to.be.bignumber.equal(swapResult3.newFromPool);
    expect(currPair3ToPool).to.be.bignumber.equal(swapResult3.newToPool);
  });

  it("should swap using FA1.2 -> TEZ -> FA2 route", async () => {
    const pairIds: BigNumber[] = [new BigNumber(0), new BigNumber(1)];
    const token1: Token = { fa12: fa12Token1.contract.address };
    const token2: Token = { tez: undefined };
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [
        { direction: { a_to_b: undefined }, pair_id: pairIds[0] },
        { direction: { b_to_a: undefined }, pair_id: pairIds[1] },
      ],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(100),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await dexCore.updateStorage({
      pairs: pairIds,
    });
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevDexCoreTok2Balance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevBucket1TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].bucket
    );
    const prevBucket2TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].bucket
    );
    const prevAliceTok3Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const prevDexCoreTok3Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const prevTok1InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token1},${swapParams.referrer}`];
    const prevTok1AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];

    await dexCore.updateStorage({
      pairs: pairIds,
      interface_tez_fee: [[pairIds[1], swapParams.referrer]],
      auction_tez_fee: [pairIds[1]],
    });

    const prevTok2InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairIds[1]},${swapParams.referrer}`
      ];
    const prevTok2AuctionFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairIds[1].toString()];

    const prevFromPool1: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_a_pool;
    const prevFromPool2: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_b_pool;
    const prevToPool1: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_b_pool;
    const prevToPool2: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_a_pool;

    await fa12Token1.approve(dexCore.contract.address, swapParams.amount_in);
    await dexCore.swap(swapParams);
    await dexCore.updateStorage({
      pairs: pairIds,
    });
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currDexCoreTok2Balance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currBucket1TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].bucket
    );
    const currBucket2TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].bucket
    );
    const currAliceTok3Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const currDexCoreTok3Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const swapResult1: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool1,
      prevToPool1
    );
    const swapResult2: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapResult1.out,
      prevFromPool2,
      prevToPool2
    );

    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(swapParams.amount_in)
    );
    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(swapParams.amount_in)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance
    );
    expect(currBucket1TezBalance).to.be.bignumber.equal(
      prevBucket1TezBalance.minus(swapResult1.out)
    );
    expect(currBucket2TezBalance).to.be.bignumber.equal(
      prevBucket2TezBalance.plus(swapResult1.out)
    );
    expect(currAliceTok3Balance).to.be.bignumber.equal(
      prevAliceTok3Balance.plus(swapResult2.out)
    );
    expect(currDexCoreTok3Balance).to.be.bignumber.equal(
      prevDexCoreTok3Balance.minus(swapResult2.out)
    );

    const currTok1InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token2},${swapParams.referrer}`];
    const currTok1AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token2.toString()];

    await dexCore.updateStorage({
      pairs: pairIds,
      interface_tez_fee: [[pairIds[1], swapParams.referrer]],
      auction_tez_fee: [pairIds[1]],
    });

    const currTok2InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairIds[1]},${swapParams.referrer}`
      ];
    const currTok2AuctionFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairIds[1].toString()];

    const currPair1FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_a_pool;
    const currPair1ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_b_pool;
    const currPair2FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_b_pool;
    const currPair2ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_a_pool;

    expect(currTok1InterfaceFee).to.be.bignumber.equal(
      prevTok1InterfaceFee.plus(swapResult1.interfaceFee)
    );
    expect(currTok2InterfaceFee).to.be.bignumber.equal(
      prevTok2InterfaceFee.plus(swapResult2.interfaceFee)
    );
    expect(currTok1AuctionFee).to.be.bignumber.equal(
      prevTok1AuctionFee.plus(swapResult1.auctionFee)
    );
    expect(currTok2AuctionFee).to.be.bignumber.equal(
      prevTok2AuctionFee.plus(swapResult2.auctionFee)
    );
    expect(currPair1FromPool).to.be.bignumber.equal(swapResult1.newFromPool);
    expect(currPair1ToPool).to.be.bignumber.equal(swapResult1.newToPool);
    expect(currPair2FromPool).to.be.bignumber.equal(swapResult2.newFromPool);
    expect(currPair2ToPool).to.be.bignumber.equal(swapResult2.newToPool);
  });

  it("should swap using FA1.2 -> TEZ -> FA2 -> FA1.2 -> TEZ -> FA1.2 route", async () => {
    const pairIds: BigNumber[] = [
      new BigNumber(0),
      new BigNumber(1),
      new BigNumber(3),
      new BigNumber(0),
      new BigNumber(7),
    ];
    const token1: Token = { fa12: fa12Token1.contract.address };
    const token2: Token = {
      fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
    };
    const swapParams: Swap = {
      lambda: undefined,
      swaps: [
        { direction: { a_to_b: undefined }, pair_id: pairIds[0] },
        { direction: { b_to_a: undefined }, pair_id: pairIds[1] },
        { direction: { b_to_a: undefined }, pair_id: pairIds[2] },
        { direction: { a_to_b: undefined }, pair_id: pairIds[3] },
        { direction: { b_to_a: undefined }, pair_id: pairIds[4] },
      ],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(100),
      min_amount_out: new BigNumber(0),
      flash: false,
    };

    await dexCore.updateStorage({
      pairs: pairIds,
    });
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa12Token3.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevDexCoreTok2Balance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevBucket1TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].bucket
    );
    const prevBucket2TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].bucket
    );
    const prevBucket3TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[4].toFixed()].bucket
    );
    const prevAliceTok3Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const prevDexCoreTok3Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok4Balance: BigNumber = fa12Token3.getBalance(alice.pkh);
    const prevDexCoreTok4Balance: BigNumber = fa12Token3.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const prevTok1InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token1},${swapParams.referrer}`];
    const prevTok1AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];

    await dexCore.updateStorage({
      interface_tez_fee: [[pairIds[1], swapParams.referrer]],
      auction_tez_fee: [pairIds[1]],
    });

    const prevTok2InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairIds[1]},${swapParams.referrer}`
      ];
    const prevTok2AuctionFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairIds[1].toString()];

    await dexCore.updateStorage({
      interface_fee: [[token2, swapParams.referrer]],
      auction_fee: [token2],
    });

    const prevTok3InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token2},${swapParams.referrer}`];
    const prevTok3AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token2.toString()];

    await dexCore.updateStorage({
      pairs: pairIds,
      interface_tez_fee: [[pairIds[4], swapParams.referrer]],
      auction_tez_fee: [pairIds[4]],
    });

    const prevTok4InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairIds[4]},${swapParams.referrer}`
      ] || new BigNumber(0);
    const prevTok4AuctionFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairIds[4].toString()] ||
      new BigNumber(0);
    const prevFromPool1: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_a_pool;
    const prevToPool1: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_b_pool;
    const prevFromPool2: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_b_pool;
    const prevToPool2: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_a_pool;
    const prevFromPool3: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_b_pool;
    const prevToPool3: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_a_pool;
    const prevFromPool4: BigNumber =
      dexCore.storage.storage.pairs[pairIds[4].toFixed()].token_b_pool;
    const prevToPool4: BigNumber =
      dexCore.storage.storage.pairs[pairIds[4].toFixed()].token_a_pool;

    await fa12Token1.approve(dexCore.contract.address, swapParams.amount_in);
    await dexCore.swap(swapParams);
    await dexCore.updateStorage({
      pairs: pairIds,
    });
    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa12Token3.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await fa2Token1.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });

    const currAliceTok1Balance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currDexCoreTok2Balance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currBucket1TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].bucket
    );
    const currBucket2TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].bucket
    );
    const currBucket3TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairIds[4].toFixed()].bucket
    );
    const currAliceTok3Balance: BigNumber = await fa2Token1.getBalance(
      alice.pkh
    );
    const currDexCoreTok3Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok4Balance: BigNumber = fa12Token3.getBalance(alice.pkh);
    const currDexCoreTok4Balance: BigNumber = fa12Token3.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({
      interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const swapResult1: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapParams.amount_in,
      prevFromPool1,
      prevToPool1
    );
    const swapResult2: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapResult1.out,
      prevFromPool2,
      prevToPool2
    );
    const swapResult3: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapResult2.out,
      prevFromPool3,
      prevToPool3
    );
    const swapResult4: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapResult3.out,
      swapResult1.newFromPool,
      swapResult1.newToPool
    );
    const swapResult5: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      swapResult4.out,
      prevFromPool4,
      prevToPool4
    );

    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(swapParams.amount_in)
    );
    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(swapParams.amount_in)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance
    );
    expect(currBucket1TezBalance).to.be.bignumber.equal(
      prevBucket1TezBalance.minus(swapResult1.out).minus(swapResult4.out)
    );
    expect(currBucket2TezBalance).to.be.bignumber.equal(
      prevBucket2TezBalance.plus(swapResult1.out)
    );
    expect(currBucket3TezBalance).to.be.bignumber.equal(
      prevBucket3TezBalance.plus(swapResult4.out)
    );
    expect(currAliceTok3Balance).to.be.bignumber.equal(prevAliceTok3Balance);
    expect(currDexCoreTok3Balance).to.be.bignumber.equal(
      prevDexCoreTok3Balance
    );
    expect(currAliceTok4Balance).to.be.bignumber.equal(
      prevAliceTok4Balance.plus(swapResult5.out)
    );
    expect(currDexCoreTok4Balance).to.be.bignumber.equal(
      prevDexCoreTok4Balance.minus(swapResult5.out)
    );

    const currTok1InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token1},${swapParams.referrer}`];
    const currTok1AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];

    await dexCore.updateStorage({
      interface_tez_fee: [[pairIds[1], swapParams.referrer]],
      auction_tez_fee: [pairIds[1]],
    });

    const currTok2InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairIds[1]},${swapParams.referrer}`
      ];
    const currTok2AuctionFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairIds[1].toString()];

    await dexCore.updateStorage({
      interface_fee: [[token2, swapParams.referrer]],
      auction_fee: [token2],
    });

    const currTok3InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[`${token2},${swapParams.referrer}`];
    const currTok3AuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token2.toString()];

    await dexCore.updateStorage({
      pairs: pairIds,
      interface_tez_fee: [[pairIds[4], swapParams.referrer]],
      auction_tez_fee: [pairIds[4]],
    });

    const currTok4InterfaceFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairIds[4]},${swapParams.referrer}`
      ];
    const currTok4AuctionFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairIds[4].toString()];
    const currPair1FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_a_pool;
    const currPair1ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[0].toFixed()].token_b_pool;
    const currPair2FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_b_pool;
    const currPair2ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[1].toFixed()].token_a_pool;
    const currPair3FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_b_pool;
    const currPair3ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[2].toFixed()].token_a_pool;
    const currPair4FromPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[4].toFixed()].token_b_pool;
    const currPair4ToPool: BigNumber =
      dexCore.storage.storage.pairs[pairIds[4].toFixed()].token_a_pool;

    expect(currTok1InterfaceFee).to.be.bignumber.equal(
      prevTok1InterfaceFee
        .plus(swapResult1.interfaceFee)
        .plus(swapResult4.interfaceFee)
    );
    expect(currTok2InterfaceFee).to.be.bignumber.equal(
      prevTok2InterfaceFee.plus(swapResult2.interfaceFee)
    );
    expect(currTok3InterfaceFee).to.be.bignumber.equal(
      prevTok3InterfaceFee.plus(swapResult3.interfaceFee)
    );
    expect(currTok4InterfaceFee).to.be.bignumber.equal(
      prevTok4InterfaceFee.plus(swapResult5.interfaceFee)
    );
    expect(currTok1AuctionFee).to.be.bignumber.equal(
      prevTok1AuctionFee
        .plus(swapResult1.auctionFee)
        .plus(swapResult4.auctionFee)
    );
    expect(currTok2AuctionFee).to.be.bignumber.equal(
      prevTok2AuctionFee.plus(swapResult2.auctionFee)
    );
    expect(currTok3AuctionFee).to.be.bignumber.equal(
      prevTok3AuctionFee.plus(swapResult3.auctionFee)
    );
    expect(currTok4AuctionFee).to.be.bignumber.equal(
      prevTok4AuctionFee.plus(swapResult5.auctionFee)
    );
    expect(currPair1FromPool).to.be.bignumber.equal(swapResult4.newFromPool);
    expect(currPair1ToPool).to.be.bignumber.equal(swapResult4.newToPool);
    expect(currPair2FromPool).to.be.bignumber.equal(swapResult2.newFromPool);
    expect(currPair2ToPool).to.be.bignumber.equal(swapResult2.newToPool);
    expect(currPair3FromPool).to.be.bignumber.equal(swapResult3.newFromPool);
    expect(currPair3ToPool).to.be.bignumber.equal(swapResult3.newToPool);
    expect(currPair4FromPool).to.be.bignumber.equal(swapResult5.newFromPool);
    expect(currPair4ToPool).to.be.bignumber.equal(swapResult5.newToPool);
  });
});
