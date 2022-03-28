import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
import { Bucket } from "../../helpers/Bucket";
import { FA12 } from "../../helpers/FA12";
import { FA2 } from "../../helpers/FA2";
import {
  defaultCollectingPeriod,
  defaultCycleDuration,
  defaultVotingPeriod,
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

import { SBAccount } from "../../types/Common";
import { User } from "../../types/Bucket";
import {
  InvestLiquidity,
  DivestLiquidity,
  LaunchExchange,
  RequiredTokens,
  TokensPerShare,
  Pair,
  Swap,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (invest liquidity)", async () => {
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
    dexCoreStorage.storage.cycle_duration = defaultCycleDuration;
    dexCoreStorage.storage.voting_period = defaultVotingPeriod;
    dexCoreStorage.storage.collecting_period = defaultCollectingPeriod;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

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
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
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
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
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
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };
    launchParams = DexCore.changeTokensOrderInPair(launchParams, false);

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await fa12Token2.approve(dexCore.contract.address, launchParams.token_b_in);
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
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
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
        token_a: { fa12: fa12Token1.contract.address },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
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

  it("should fail if pair not listed", async () => {
    const investParams: InvestLiquidity = {
      pair_id: new BigNumber(666),
      token_a_in: new BigNumber(0),
      token_b_in: new BigNumber(0),
      shares: new BigNumber(0),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.investLiquidity(investParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if investor expects zero shares amount in result of investment", async () => {
    const investParams: InvestLiquidity = {
      pair_id: new BigNumber(0),
      token_a_in: new BigNumber(0),
      token_b_in: new BigNumber(0),
      shares: new BigNumber(0),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.investLiquidity(investParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_NO_SHARES_EXPECTED);

      return true;
    });
  });

  it("should fail if TEZ token mismatch", async () => {
    const pairId: BigNumber = new BigNumber(0);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const shares: BigNumber = new BigNumber(100);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(
      dexCore.investLiquidity(
        investParams,
        investParams.token_b_in.toNumber() - 1
      ),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_TEZ_AMOUNT_MISMATCH);

        return true;
      }
    );
  });

  it("should fail if low token A in", async () => {
    const pairId: BigNumber = new BigNumber(0);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const shares: BigNumber = new BigNumber(100);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required.minus(1),
      token_b_in: requiredTokens.tokens_a_required,
      shares: shares,
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(
      dexCore.investLiquidity(investParams, investParams.token_b_in.toNumber()),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_LOW_TOKEN_A_IN);

        return true;
      }
    );
  });

  it("should fail if low token B in", async () => {
    const pairId: BigNumber = new BigNumber(1);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const shares: BigNumber = new BigNumber(100);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required.minus(1),
      shares: shares,
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(
      dexCore.investLiquidity(investParams, investParams.token_b_in.toNumber()),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_LOW_TOKEN_B_IN);

        return true;
      }
    );
  });

  it("should invest FA1.2/TEZ liquidity", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[sharesReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const prevAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[`${sharesReceiver},${pairId.toFixed()}`];
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(100);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, investParams.token_a_in);
    await dexCore.investLiquidity(
      investParams,
      investParams.token_b_in.toNumber()
    );
    await dexCore.updateStorage({
      ledger: [[sharesReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const currAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[`${sharesReceiver},${pairId.toFixed()}`];
    const currPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    expect(currAliceSharesBalance).to.be.bignumber.equal(
      prevAliceSharesBalance.plus(shares)
    );
    expect(currPair.total_supply).to.be.bignumber.equal(
      prevPair.total_supply.plus(shares)
    );
    expect(currPair.token_a_pool).to.be.bignumber.equal(
      prevPair.token_a_pool.plus(requiredTokens.tokens_a_required)
    );
    expect(currPair.token_b_pool).to.be.bignumber.equal(
      prevPair.token_b_pool.plus(requiredTokens.tokens_b_required)
    );
  });

  it("should invest FA2/TEZ liquidity", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[sharesReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const prevAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[`${sharesReceiver},${pairId.toFixed()}`];
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(20);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
    };

    await dexCore.investLiquidity(
      investParams,
      investParams.token_b_in.toNumber()
    );
    await dexCore.updateStorage({
      ledger: [[sharesReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const currAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[`${sharesReceiver},${pairId.toFixed()}`];
    const currPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    expect(currAliceSharesBalance).to.be.bignumber.equal(
      prevAliceSharesBalance.plus(shares)
    );
    expect(currPair.total_supply).to.be.bignumber.equal(
      prevPair.total_supply.plus(shares)
    );
    expect(currPair.token_a_pool).to.be.bignumber.equal(
      prevPair.token_a_pool.plus(requiredTokens.tokens_a_required)
    );
    expect(currPair.token_b_pool).to.be.bignumber.equal(
      prevPair.token_b_pool.plus(requiredTokens.tokens_b_required)
    );
  });

  it("should invest FA1.2/FA1.2 liquidity", async () => {
    const pairId: BigNumber = new BigNumber(2);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[sharesReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const prevAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[`${sharesReceiver},${pairId.toFixed()}`];
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(20);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, investParams.token_a_in);
    await fa12Token2.approve(dexCore.contract.address, investParams.token_b_in);
    await dexCore.investLiquidity(investParams);
    await dexCore.updateStorage({
      ledger: [[sharesReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const currAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[`${sharesReceiver},${pairId.toFixed()}`];
    const currPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    expect(currAliceSharesBalance).to.be.bignumber.equal(
      prevAliceSharesBalance.plus(shares)
    );
    expect(currPair.total_supply).to.be.bignumber.equal(
      prevPair.total_supply.plus(shares)
    );
    expect(currPair.token_a_pool).to.be.bignumber.equal(
      prevPair.token_a_pool.plus(requiredTokens.tokens_a_required)
    );
    expect(currPair.token_b_pool).to.be.bignumber.equal(
      prevPair.token_b_pool.plus(requiredTokens.tokens_b_required)
    );
  });

  it("should invest FA2/FA2 liquidity", async () => {
    const pairId: BigNumber = new BigNumber(3);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[sharesReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const prevAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[`${sharesReceiver},${pairId.toFixed()}`];
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(20);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
    };

    await dexCore.investLiquidity(investParams);
    await dexCore.updateStorage({
      ledger: [[sharesReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const currAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[`${sharesReceiver},${pairId.toFixed()}`];
    const currPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    expect(currAliceSharesBalance).to.be.bignumber.equal(
      prevAliceSharesBalance.plus(shares)
    );
    expect(currPair.total_supply).to.be.bignumber.equal(
      prevPair.total_supply.plus(shares)
    );
    expect(currPair.token_a_pool).to.be.bignumber.equal(
      prevPair.token_a_pool.plus(requiredTokens.tokens_a_required)
    );
    expect(currPair.token_b_pool).to.be.bignumber.equal(
      prevPair.token_b_pool.plus(requiredTokens.tokens_b_required)
    );
  });

  it("should invest FA1.2/FA2 liquidity", async () => {
    const pairId: BigNumber = new BigNumber(4);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[sharesReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const prevAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[`${sharesReceiver},${pairId.toFixed()}`];
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(20);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, investParams.token_a_in);
    await dexCore.investLiquidity(investParams);
    await dexCore.updateStorage({
      ledger: [[sharesReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const currAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[`${sharesReceiver},${pairId.toFixed()}`];
    const currPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    expect(currAliceSharesBalance).to.be.bignumber.equal(
      prevAliceSharesBalance.plus(shares)
    );
    expect(currPair.total_supply).to.be.bignumber.equal(
      prevPair.total_supply.plus(shares)
    );
    expect(currPair.token_a_pool).to.be.bignumber.equal(
      prevPair.token_a_pool.plus(requiredTokens.tokens_a_required)
    );
    expect(currPair.token_b_pool).to.be.bignumber.equal(
      prevPair.token_b_pool.plus(requiredTokens.tokens_b_required)
    );
  });

  it("should transfer FA1.2 tokens and invest TEZ tokens to TEZ store contract in time of FA1.2/TEZ liquidity investment", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, sharesReceiver],
    });

    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(sharesReceiver);
    const shares: BigNumber = new BigNumber(100);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, investParams.token_a_in);
    await dexCore.investLiquidity(
      investParams,
      investParams.token_b_in.toNumber()
    );
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, sharesReceiver],
    });

    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(sharesReceiver);

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(investParams.token_a_in)
    );
    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(investParams.token_a_in)
    );
  });

  it("should transfer FA2 tokens and invest TEZ tokens to TEZ store contract in time of FA2/TEZ liquidity investment", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, sharesReceiver],
    });

    const prevDexCoreTok1Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok1Balance: BigNumber = await fa2Token1.getBalance(
      sharesReceiver
    );
    const shares: BigNumber = new BigNumber(200);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
    };

    await dexCore.investLiquidity(
      investParams,
      investParams.token_b_in.toNumber()
    );
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, sharesReceiver],
    });

    const currDexCoreTok1Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok1Balance: BigNumber = await fa2Token1.getBalance(
      sharesReceiver
    );

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(investParams.token_a_in)
    );
    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(investParams.token_a_in)
    );
  });

  it("should transfer FA1.2 tokens in time of FA1.2/FA1.2 liquidity investment", async () => {
    const pairId: BigNumber = new BigNumber(2);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, sharesReceiver],
    });
    await fa12Token2.updateStorage({
      ledger: [dexCore.contract.address, sharesReceiver],
    });

    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(sharesReceiver);
    const prevDexCoreTok2Balance: BigNumber = fa12Token2.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber =
      fa12Token2.getBalance(sharesReceiver);
    const shares: BigNumber = new BigNumber(13);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, investParams.token_a_in);
    await fa12Token2.approve(dexCore.contract.address, investParams.token_b_in);
    await dexCore.investLiquidity(investParams);
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, sharesReceiver],
    });
    await fa12Token2.updateStorage({
      ledger: [dexCore.contract.address, sharesReceiver],
    });

    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(sharesReceiver);
    const currDexCoreTok2Balance: BigNumber = fa12Token2.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber =
      fa12Token2.getBalance(sharesReceiver);

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(investParams.token_a_in)
    );
    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(investParams.token_a_in)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.plus(investParams.token_b_in)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.minus(investParams.token_b_in)
    );
  });

  it("should transfer FA2 tokens in time of FA2/FA2 liquidity investment", async () => {
    const pairId: BigNumber = new BigNumber(3);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, sharesReceiver],
    });
    await fa2Token2.updateStorage({
      account_info: [dexCore.contract.address, sharesReceiver],
    });

    const prevDexCoreTok1Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok1Balance: BigNumber = await fa2Token1.getBalance(
      sharesReceiver
    );
    const prevDexCoreTok2Balance: BigNumber = await fa2Token2.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber = await fa2Token2.getBalance(
      sharesReceiver
    );
    const shares: BigNumber = new BigNumber(500);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
    };

    await dexCore.investLiquidity(investParams);
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, sharesReceiver],
    });
    await fa2Token2.updateStorage({
      account_info: [dexCore.contract.address, sharesReceiver],
    });

    const currDexCoreTok1Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok1Balance: BigNumber = await fa2Token1.getBalance(
      sharesReceiver
    );
    const currDexCoreTok2Balance: BigNumber = await fa2Token2.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber = await fa2Token2.getBalance(
      sharesReceiver
    );

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(investParams.token_a_in)
    );
    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(investParams.token_a_in)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.plus(investParams.token_b_in)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.minus(investParams.token_b_in)
    );
  });

  it("should transfer FA1.2 tokens and FA2 tokens in time of FA1.2/FA2 liquidity investment", async () => {
    const pairId: BigNumber = new BigNumber(4);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, sharesReceiver],
    });
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, sharesReceiver],
    });

    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(sharesReceiver);
    const prevDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      sharesReceiver
    );

    const shares: BigNumber = new BigNumber(666);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, investParams.token_a_in);
    await dexCore.investLiquidity(investParams);
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, sharesReceiver],
    });
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, sharesReceiver],
    });

    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(sharesReceiver);
    const currDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      sharesReceiver
    );

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(investParams.token_a_in)
    );
    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(investParams.token_a_in)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.plus(investParams.token_b_in)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.minus(investParams.token_b_in)
    );
  });

  it("should fail if pair does not have liquidity", async () => {
    const pairId: BigNumber = new BigNumber(2);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    let shares: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const divestedTokens: TokensPerShare = DexCore.getTokensPerShare(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_amt,
      min_token_b_out: divestedTokens.token_b_amt,
      shares: shares,
      liquidity_receiver: liquidityReceiver,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);

    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares: new BigNumber(1),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.investLiquidity(investParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_NO_LIQUIDITY);

      return true;
    });
  });

  it("should vote for the baker on TEZ store contract in time of FA1.2/TEZ liquidity investment", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(1000);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: bob.pkh,
    };
    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      dexCore.tezos
    );

    await bucket.updateStorage({
      users: [sharesReceiver],
      bakers: [alice.pkh],
    });

    const initialVoterAliceInfo: User = bucket.storage.users[alice.pkh];
    const initialBakerAliceInfo: User = bucket.storage.bakers[alice.pkh];

    await fa12Token1.approve(dexCore.contract.address, investParams.token_a_in);
    await dexCore.investLiquidity(
      investParams,
      requiredTokens.tokens_b_required.toNumber()
    );
    await bucket.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    expect(bucket.storage.users[sharesReceiver].candidate).to.be.equal(
      investParams.candidate
    );
    expect(bucket.storage.users[sharesReceiver].votes).to.be.bignumber.equal(
      initialVoterAliceInfo.votes.plus(shares)
    );
    expect(
      bucket.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerAliceInfo.votes.plus(shares));
    expect(bucket.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(bucket.storage.current_delegated).to.be.equal(bob.pkh);
    expect(bucket.storage.next_candidate).to.be.equal(alice.pkh);
    expect(await utils.tezos.rpc.getDelegate(bucket.contract.address)).to.equal(
      null
    );
  });

  it("should vote for the baker on TEZ store contract in time of FA2/TEZ liquidity investment", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const sharesReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(1000);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: bob.pkh,
    };
    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      dexCore.tezos
    );

    await bucket.updateStorage({
      users: [sharesReceiver],
      bakers: [alice.pkh],
    });

    const initialVoterAliceInfo: User = bucket.storage.users[alice.pkh];
    const initialBakerAliceInfo: User = bucket.storage.bakers[alice.pkh];

    await dexCore.investLiquidity(
      investParams,
      requiredTokens.tokens_b_required.toNumber()
    );
    await bucket.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    expect(bucket.storage.users[sharesReceiver].candidate).to.be.equal(
      investParams.candidate
    );
    expect(bucket.storage.users[sharesReceiver].votes).to.be.bignumber.equal(
      initialVoterAliceInfo.votes.plus(shares)
    );
    expect(
      bucket.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerAliceInfo.votes.plus(shares));
    expect(bucket.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(bucket.storage.current_delegated).to.be.equal(bob.pkh);
    expect(bucket.storage.next_candidate).to.be.equal(alice.pkh);
    expect(await utils.tezos.rpc.getDelegate(bucket.contract.address)).to.equal(
      null
    );
  });

  it("should return the TEZ change to the sender if too many TEZ was send", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const shares: BigNumber = new BigNumber(100);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      dexCore.tezos
    );
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };
    const prevDexCoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );

    await fa12Token1.approve(dexCore.contract.address, investParams.token_a_in);
    await dexCore.investLiquidity(
      investParams,
      investParams.token_a_in.toNumber()
    );

    const currDexCoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );

    expect(currDexCoreTezBalance).to.be.bignumber.equal(prevDexCoreTezBalance);
    expect(currBucketTezBalance).to.be.bignumber.equal(
      prevBucketTezBalance.plus(investParams.token_a_in)
    );
  });
});
