import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
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
import { PRECISION } from "test/helpers/Constants";
import {
  DivestLiquidity,
  TokensPerShare,
  LaunchExchange,
  CalculateSwap,
  Swap,
} from "test/types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (swap)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore2: DexCore;
  var auction: Auction;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa12Token2: FA12;
  var fa2Token1: FA2;
  var fa2Token2: FA2;
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
    dexCoreStorage.storage.cycle_duration = defaultCycleDuration;
    dexCoreStorage.storage.voting_period = defaultVotingPeriod;
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
    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);
    fa2Token2 = await FA2.originate(utils.tezos, fa2Storage);

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = dexCore.contract.address;
    auctionStorage.storage.quipu_token = fa2Token1.contract.address;

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
  });

  it("should fail if reentrancy", async () => {
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1),
      min_amount_out: new BigNumber(1),
    };

    await rejects(dexCore2.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if user is trying to refer himself", async () => {
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      receiver: alice.pkh,
      referrer: alice.pkh,
      amount_in: new BigNumber(1),
      min_amount_out: new BigNumber(1),
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_CAN_NOT_REFER_YOURSELF);

      return true;
    });
  });

  it("should fail if empty route", async () => {
    const swapParams: Swap = {
      swaps: [],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1),
      min_amount_out: new BigNumber(1),
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_EMPTY_ROUTE);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    const swapParams: Swap = {
      swaps: [
        { direction: { a_to_b: undefined }, pair_id: new BigNumber(666) },
      ],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1),
      min_amount_out: new BigNumber(1),
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if wrong TEZ amount was sent to swap", async () => {
    const swapParams: Swap = {
      swaps: [{ direction: { b_to_a: undefined }, pair_id: new BigNumber(0) }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1),
      min_amount_out: new BigNumber(0),
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_TEZ_AMOUNT);

      return true;
    });
  });

  it("should fail if a user expects too high min out", async () => {
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(5),
      min_amount_out: new BigNumber(5),
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_HIGH_MIN_OUT);

      return true;
    });
  });

  it("should fail if user passed zero amount in", async () => {
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(0),
      min_amount_out: new BigNumber(0),
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_ZERO_IN);

      return true;
    });
  });

  it("should fail if user put a wrong route", async () => {
    const swapParams: Swap = {
      swaps: [
        { direction: { a_to_b: undefined }, pair_id: new BigNumber(0) },
        { direction: { a_to_b: undefined }, pair_id: new BigNumber(0) },
      ],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(5),
      min_amount_out: new BigNumber(0),
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_ROUTE);

      return true;
    });
  });

  it("should fail if too high price impact", async () => {
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(5_000_000),
      min_amount_out: new BigNumber(0),
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_HIGH_OUT);

      return true;
    });
  });

  it("should swap FA1.2 token to TEZ", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const token: Token = { fa12: fa12Token1.contract.address };
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(5),
      min_amount_out: new BigNumber(4),
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

    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
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
    const currTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      tok_interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      swapParams,
      dexCore.storage.storage.fees,
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
    expect(currTezStoreTezBalance).to.be.bignumber.equal(
      prevTezStoreTezBalance.minus(swapResult.out)
    );

    const currTokInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token},${swapParams.referrer}`
      ];
    const currTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    expect(currTokInterfaceFee).to.be.bignumber.equal(swapResult.interfaceFee);
    expect(currTokAuctionFee).to.be.bignumber.equal(swapResult.auctionFee);
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap FA2 token to TEZ", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const token: Token = {
      fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
    };
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(10),
      min_amount_out: new BigNumber(9),
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

    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
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
    const currTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      tok_interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      swapParams,
      dexCore.storage.storage.fees,
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
    expect(currTezStoreTezBalance).to.be.bignumber.equal(
      prevTezStoreTezBalance.minus(swapResult.out)
    );

    const currTokInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token},${swapParams.referrer}`
      ];
    const currTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    expect(currTokInterfaceFee).to.be.bignumber.equal(swapResult.interfaceFee);
    expect(currTokAuctionFee).to.be.bignumber.equal(swapResult.auctionFee);
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap TEZ to FA1.2 token", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const token: Token = { tez: undefined };
    const swapParams: Swap = {
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(50),
      min_amount_out: new BigNumber(0),
    };

    await fa12Token1.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });

    const prevAliceTokBalance: BigNumber = fa12Token1.getBalance(alice.pkh);
    const prevDexCoreTokBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );

    await dexCore.updateStorage({ pairs: [pairId] });

    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
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
    const currTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      tez_interface_fee: [[pairId, swapParams.referrer]],
      auction_fee: [token],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      swapParams,
      dexCore.storage.storage.fees,
      prevFromPool,
      prevToPool
    );

    expect(currAliceTokBalance).to.be.bignumber.equal(
      prevAliceTokBalance.plus(swapResult.out)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.minus(swapResult.out)
    );
    expect(currTezStoreTezBalance).to.be.bignumber.equal(
      prevTezStoreTezBalance.plus(swapParams.amount_in)
    );

    const currTezInterfaceFee: BigNumber =
      dexCore.storage.storage.tez_interface_fee[
        `${pairId},${swapParams.referrer}`
      ];
    const currTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;

    expect(currTezInterfaceFee).to.be.bignumber.equal(swapResult.interfaceFee);
    expect(currTokAuctionFee).to.be.bignumber.equal(swapResult.auctionFee);
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap TEZ to FA2 token", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const token: Token = { tez: undefined };
    const swapParams: Swap = {
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(200),
      min_amount_out: new BigNumber(0),
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
      auction_fee: [token],
    });

    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );
    const prevTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
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
    const currTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store
    );

    await dexCore.updateStorage({
      pairs: [pairId],
      tez_interface_fee: [[pairId, swapParams.referrer]],
      auction_fee: [token],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      swapParams,
      dexCore.storage.storage.fees,
      prevFromPool,
      prevToPool
    );

    expect(currAliceTokBalance).to.be.bignumber.equal(
      prevAliceTokBalance.plus(swapResult.out)
    );
    expect(currDexCoreTokBalance).to.be.bignumber.equal(
      prevDexCoreTokBalance.minus(swapResult.out)
    );
    expect(currTezStoreTezBalance).to.be.bignumber.equal(
      prevTezStoreTezBalance.plus(swapParams.amount_in)
    );

    const currTezInterfaceFee: BigNumber =
      dexCore.storage.storage.tez_interface_fee[
        `${pairId},${swapParams.referrer}`
      ];
    const currTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;

    expect(currTezInterfaceFee).to.be.bignumber.equal(swapResult.interfaceFee);
    expect(currTokAuctionFee).to.be.bignumber.equal(
      prevTokAuctionFee.plus(swapResult.auctionFee)
    );
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
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(400),
      min_amount_out: new BigNumber(0),
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
      tok_interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const prevTokInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ] || new BigNumber(0);
    const prevTokAuctionFee: BigNumber =
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
    await dexCore.swap(swapParams, swapParams.amount_in.toNumber());
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
      tok_interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      swapParams,
      dexCore.storage.storage.fees,
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

    const currTokInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ];
    const currTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    expect(currTokInterfaceFee).to.be.bignumber.equal(
      prevTokInterfaceFee.plus(swapResult.interfaceFee)
    );
    expect(currTokAuctionFee).to.be.bignumber.equal(
      prevTokAuctionFee.plus(swapResult.auctionFee)
    );
    expect(currFromPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currToPool).to.be.bignumber.equal(swapResult.newToPool);
  });

  it("should swap FA1.2 token to FA2 token", async () => {
    const pairId: BigNumber = new BigNumber(3);
    const token: Token = { fa12: fa12Token1.contract.address };
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(333),
      min_amount_out: new BigNumber(0),
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
      tok_interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const prevTokInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ];
    const prevTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    await fa12Token1.approve(dexCore.contract.address, swapParams.amount_in);
    await dexCore.swap(swapParams, swapParams.amount_in.toNumber());
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
      tok_interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      swapParams,
      dexCore.storage.storage.fees,
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

    const currTokInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ];
    const currTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    expect(currTokInterfaceFee).to.be.bignumber.equal(
      prevTokInterfaceFee.plus(swapResult.interfaceFee)
    );
    expect(currTokAuctionFee).to.be.bignumber.equal(
      prevTokAuctionFee.plus(swapResult.auctionFee)
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
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(666),
      min_amount_out: new BigNumber(0),
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
      tok_interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const prevTokInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ];
    const prevTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;

    await dexCore.swap(swapParams, swapParams.amount_in.toNumber());
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
      tok_interface_fee: [[token, swapParams.referrer]],
      auction_fee: [token],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      swapParams,
      dexCore.storage.storage.fees,
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

    const currTokInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ];
    const currTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;

    expect(currTokInterfaceFee).to.be.bignumber.equal(
      prevTokInterfaceFee.plus(swapResult.interfaceFee)
    );
    expect(currTokAuctionFee).to.be.bignumber.equal(
      prevTokAuctionFee.plus(swapResult.auctionFee)
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
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(999),
      min_amount_out: new BigNumber(0),
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
      tok_interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const prevTokInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ] || new BigNumber(0);
    const prevTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()] ||
      new BigNumber(0);
    const prevFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    await dexCore.swap(swapParams, swapParams.amount_in.toNumber());
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
      tok_interface_fee: [[token1, swapParams.referrer]],
      auction_fee: [token1],
    });

    const swapResult: CalculateSwap = DexCore.calculateSwap(
      swapParams,
      dexCore.storage.storage.fees,
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

    const currTokInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token1.toString()},${swapParams.referrer}`
      ];
    const currTokAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token1.toString()];
    const currFromPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currToPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;

    expect(currTokInterfaceFee).to.be.bignumber.equal(
      prevTokInterfaceFee.plus(swapResult.interfaceFee)
    );
    expect(currTokAuctionFee).to.be.bignumber.equal(
      prevTokAuctionFee.plus(swapResult.auctionFee)
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
    };

    await dexCore.divestLiquidity(divestParams);

    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(100),
      min_amount_out: new BigNumber(0),
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_NO_LIQUIDITY);

      return true;
    });
  });
});
