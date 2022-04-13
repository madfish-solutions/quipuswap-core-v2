import { defaultCollectingPeriod, Utils } from "../../helpers/Utils";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { PRECISION } from "../../helpers/Constants";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
import { FA2 } from "../../helpers/FA2";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { auctionStorage } from "../../../storage/Auction";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa2Storage } from "../../../storage/test/FA2";

import { SBAccount } from "../../types/Common";
import {
  CumulativePrices,
  InvestLiquidity,
  DivestLiquidity,
  LaunchExchange,
  RequiredTokens,
  TokensPerShare,
  Pair,
  Swap,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (oracle part)", async () => {
  var bakerRegistry: BakerRegistry;
  var auction: Auction;
  var dexCore: DexCore;
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
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;
    dexCoreStorage.storage.fees = {
      interface_fee: new BigNumber(0.0005).multipliedBy(PRECISION),
      swap_fee: new BigNumber(0.0005).multipliedBy(PRECISION),
      auction_fee: new BigNumber(0.0005).multipliedBy(PRECISION),
      withdraw_fee_reward: new BigNumber(0.0005).multipliedBy(PRECISION),
    };

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);
    fa2Token2 = await FA2.originate(utils.tezos, fa2Storage);

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = dexCore.contract.address;
    auctionStorage.storage.quipu_token.token = fa2Token1.contract.address;

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();
  });

  it("should not calculate cumulative prices and should update last block timestamp in time of any exchange launch", async () => {
    const expectedPairId: BigNumber = new BigNumber(0);
    let launchParams: LaunchExchange = {
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

    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: launchParams.pair.token_a["fa2"].id,
        },
      },
    ]);
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
    await dexCore.updateStorage({
      pairs: [expectedPairId.toFixed()],
    });

    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_a_price_cml
    ).to.be.bignumber.equal(new BigNumber(0));
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_b_price_cml
    ).to.be.bignumber.equal(new BigNumber(0));
    expect(
      Date.parse(
        dexCore.storage.storage.pairs[expectedPairId.toFixed()]
          .last_block_timestamp
      )
    ).to.be.lte(await utils.getLastBlockTimestamp());
  });

  it("should calculate cumulative prices and update last block timestamp in time of liquidity investment", async () => {
    const pairId: BigNumber = new BigNumber(0);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const shares: BigNumber = new BigNumber(123);
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await dexCore.investLiquidity(investParams);
    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const cumulativePrices: CumulativePrices =
      await DexCore.calculateCumulativePrices(prevPair, utils);

    expect(
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_price_cml
    ).to.be.bignumber.equal(cumulativePrices.tokenACumulativePrice);
    expect(
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_price_cml
    ).to.be.bignumber.equal(cumulativePrices.tokenBCumulativePrice);
    expect(
      Date.parse(
        dexCore.storage.storage.pairs[pairId.toFixed()].last_block_timestamp
      )
    ).to.be.lte(await utils.getLastBlockTimestamp());
  });

  it("should calculate cumulative prices and update last block timestamp in time of swap - 1", async () => {
    const pairId: BigNumber = new BigNumber(0);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(0),
    };
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    await dexCore.swap(swapParams);
    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const cumulativePrices: CumulativePrices =
      await DexCore.calculateCumulativePrices(prevPair, utils);

    expect(
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_price_cml
    ).to.be.bignumber.equal(cumulativePrices.tokenACumulativePrice);
    expect(
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_price_cml
    ).to.be.bignumber.equal(cumulativePrices.tokenBCumulativePrice);
    expect(
      Date.parse(
        dexCore.storage.storage.pairs[pairId.toFixed()].last_block_timestamp
      )
    ).to.be.lte(await utils.getLastBlockTimestamp());
  });

  it("should calculate cumulative prices and update last block timestamp in time of liquidity divestment", async () => {
    const pairId: BigNumber = new BigNumber(0);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const shares: BigNumber = new BigNumber(123);
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
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
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await dexCore.divestLiquidity(divestParams);
    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const cumulativePrices: CumulativePrices =
      await DexCore.calculateCumulativePrices(prevPair, utils);

    expect(
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_price_cml
    ).to.be.bignumber.equal(cumulativePrices.tokenACumulativePrice);
    expect(
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_price_cml
    ).to.be.bignumber.equal(cumulativePrices.tokenBCumulativePrice);
    expect(
      Date.parse(
        dexCore.storage.storage.pairs[pairId.toFixed()].last_block_timestamp
      )
    ).to.be.lte(await utils.getLastBlockTimestamp());
  });

  it("should calculate cumulative prices and update last block timestamp in time of swap - 2", async () => {
    const pairId: BigNumber = new BigNumber(0);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const swapParams: Swap = {
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(555),
      min_amount_out: new BigNumber(0),
    };
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    await dexCore.swap(swapParams);
    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const cumulativePrices: CumulativePrices =
      await DexCore.calculateCumulativePrices(prevPair, utils);

    expect(
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_price_cml
    ).to.be.bignumber.equal(cumulativePrices.tokenACumulativePrice);
    expect(
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_price_cml
    ).to.be.bignumber.equal(cumulativePrices.tokenBCumulativePrice);
    expect(
      Date.parse(
        dexCore.storage.storage.pairs[pairId.toFixed()].last_block_timestamp
      )
    ).to.be.lte(await utils.getLastBlockTimestamp());
  });
});
