import { Common, DexCore as DexCoreErrors } from "../../helpers/Errors";
import { FlashSwapsProxy } from "../../helpers/FlashSwapsProxy";
import { FlashSwapAgent } from "../../helpers/FlashSwapAgent";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { PRECISION } from "../../helpers/Constants";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
import { Bucket } from "../../helpers/Bucket";
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

import { flashSwapAgentStorage } from "../../../storage/test/FlashSwapAgent";
import { flashSwapsProxyStorage } from "../../../storage/FlashSwapsProxy";
import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { auctionStorage } from "../../../storage/Auction";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";
import { fa2Storage } from "../../../storage/test/FA2";

import { SBAccount, Token } from "../../types/Common";
import {
  DivestLiquidity,
  LaunchExchange,
  TokensPerShare,
  CalculateSwap,
  Swap,
} from "../../types/DexCore";

import fs from "fs";

chai.use(require("chai-bignumber")(BigNumber));

function updateParameters(
  flashSwapAgentAddress: string,
  value: number
): Promise<void> {
  return fs.promises.writeFile(
    "contracts/test/parameters.ligo",
    `const agent : address = ("${flashSwapAgentAddress}" : address);\nconst val : nat = ${value}n;\n`
  );
}

describe("DexCore (flash swap)", async () => {
  var flashSwapsProxy: FlashSwapsProxy;
  var flashSwapAgent: FlashSwapAgent;
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
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;
    dexCoreStorage.storage.fees = {
      interface_fee: new BigNumber(0.0025).multipliedBy(PRECISION),
      swap_fee: new BigNumber(0.0005).multipliedBy(PRECISION),
      auction_fee: new BigNumber(0.0025).multipliedBy(PRECISION),
      withdraw_fee_reward: new BigNumber(0.05).multipliedBy(PRECISION),
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
      candidate: alice.pkh,
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
      candidate: alice.pkh,
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
      candidate: alice.pkh,
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
        token_a: { fa12: fa12Token1.contract.address },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(launchParams);

    flashSwapsProxyStorage.dex_core = dexCore.contract.address;

    flashSwapsProxy = await FlashSwapsProxy.originate(
      utils.tezos,
      flashSwapsProxyStorage
    );

    await dexCore.setFlashSwapsProxy(flashSwapsProxy.contract.address);

    flashSwapAgentStorage.dex_core = dexCore.contract.address;

    flashSwapAgent = await FlashSwapAgent.originate(
      utils.tezos,
      flashSwapAgentStorage
    );

    await fa12Token1.transfer(
      alice.pkh,
      flashSwapAgent.contract.address,
      new BigNumber(100_000)
    );
    await fa12Token2.transfer(
      alice.pkh,
      flashSwapAgent.contract.address,
      new BigNumber(100_000)
    );
  });

  it("should fail if reentrancy", async () => {
    const params: Swap = {
      lambda: undefined,
      swaps: [],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000),
      receiver: zeroAddress,
      referrer: zeroAddress,
      amount_in: new BigNumber(0),
      min_amount_out: new BigNumber(0),
      flash: true,
    };

    await rejects(dexCore2.swap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if action is outdated", async () => {
    const params: Swap = {
      lambda: undefined,
      swaps: [],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000),
      receiver: alice.pkh,
      referrer: alice.pkh,
      amount_in: new BigNumber(0),
      min_amount_out: new BigNumber(0),
      flash: true,
    };

    await rejects(dexCore.swap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_ACTION_OUTDATED);

      return true;
    });
  });

  it("should fail if empty route", async () => {
    const params: Swap = {
      lambda: undefined,
      swaps: [],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(0),
      min_amount_out: new BigNumber(0),
      flash: true,
    };

    await rejects(dexCore.swap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_EMPTY_ROUTE);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    const params: Swap = {
      lambda: undefined,
      swaps: [
        { direction: { a_to_b: undefined }, pair_id: new BigNumber(666) },
      ],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(0),
      min_amount_out: new BigNumber(0),
      flash: true,
    };

    await rejects(dexCore.swap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if a user expects too high min out", async () => {
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(5),
      min_amount_out: new BigNumber(5),
      flash: true,
    };

    await rejects(dexCore.swap(params), (err: Error) => {
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
      flash: true,
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
      flash: true,
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_ROUTE);

      return true;
    });
  });

  it("should fail if from token isn't TEZ and positive TEZ tokens amount were passed", async () => {
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(5),
      min_amount_out: new BigNumber(0),
      flash: true,
    };

    await rejects(dexCore.swap(params, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should fail if pair does not have a liquidity", async () => {
    const pairId: BigNumber = new BigNumber(0);
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
      flash: true,
    };

    await rejects(dexCore.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_NO_LIQUIDITY);

      return true;
    });
  });

  it("should flash swap FA1.2 token and return opposite FA1.2 token", async () => {
    const pairId: BigNumber = new BigNumber(2);
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };
    const tokenA: FA12 = await FA12.init(
      Utils.getMinFA12Token(
        fa12Token1.contract.address,
        fa12Token2.contract.address
      ),
      utils.tezos
    );
    const tokenB: FA12 = await FA12.init(
      Utils.getMaxFA12Token(
        fa12Token1.contract.address,
        fa12Token2.contract.address
      ),
      utils.tezos
    );

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      ledger: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await tokenB.updateStorage({
      ledger: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevAliceTokABalance: BigNumber = tokenA.getBalance(alice.pkh);
    const prevDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokABalance: BigNumber = tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const prevAliceTokBBalance: BigNumber = tokenB.getBalance(alice.pkh);
    const prevDexCoreTokBBalance: BigNumber = tokenB.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokBBalance: BigNumber = tokenB.getBalance(
      flashSwapAgent.contract.address
    );
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await tokenA.approve(dexCore.contract.address, params.amount_in);
    await dexCore.swap(params);
    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      ledger: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await tokenB.updateStorage({
      ledger: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currAliceTokABalance: BigNumber = tokenA.getBalance(alice.pkh);
    const currDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokABalance: BigNumber = tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const currAliceTokBBalance: BigNumber = tokenB.getBalance(alice.pkh);
    const currDexCoreTokBBalance: BigNumber = tokenB.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokBBalance: BigNumber = tokenB.getBalance(
      flashSwapAgent.contract.address
    );
    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      params.amount_in,
      prevTokenAPool,
      prevTokenBPool
    );

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.plus(params.amount_in)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.minus(swapResult.out)
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(
      prevAliceTokABalance.minus(params.amount_in)
    );
    expect(currAliceTokBBalance).to.be.bignumber.equal(prevAliceTokBBalance);
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.plus(swapResult.out)
    );
    expect(currTokenAPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currTokenBPool).to.be.bignumber.equal(swapResult.newToPool);
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA1.2 token and return opposite FA2 token", async () => {
    const pairId: BigNumber = new BigNumber(4);
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );
    const tokenB: FA2 = await FA2.init(fa2Token1.contract.address, utils.tezos);

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      ledger: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await tokenB.updateStorage({
      account_info: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevAliceTokABalance: BigNumber = tokenA.getBalance(alice.pkh);
    const prevDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokABalance: BigNumber = tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const prevAliceTokBBalance: BigNumber = await tokenB.getBalance(alice.pkh);
    const prevDexCoreTokBBalance: BigNumber = await tokenB.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokBBalance: BigNumber = await tokenB.getBalance(
      flashSwapAgent.contract.address
    );
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await dexCore.swap(params);
    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      ledger: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await tokenB.updateStorage({
      account_info: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currAliceTokABalance: BigNumber = tokenA.getBalance(alice.pkh);
    const currDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokABalance: BigNumber = tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const currAliceTokBBalance: BigNumber = await tokenB.getBalance(alice.pkh);
    const currDexCoreTokBBalance: BigNumber = await tokenB.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokBBalance: BigNumber = await tokenB.getBalance(
      flashSwapAgent.contract.address
    );
    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      params.amount_in,
      prevTokenBPool,
      prevTokenAPool
    );

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.minus(swapResult.out)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.plus(params.amount_in)
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(prevAliceTokABalance);
    expect(currAliceTokBBalance).to.be.bignumber.equal(
      prevAliceTokBBalance.minus(params.amount_in)
    );
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance.plus(swapResult.out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance
    );
    expect(currTokenAPool).to.be.bignumber.equal(swapResult.newToPool);
    expect(currTokenBPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA1.2 token and return opposite TEZ token", async () => {
    const launchParams: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );

    const pairId: BigNumber = new BigNumber(0);
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      ledger: [dexCore.contract.address, flashSwapAgent.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      dexCore.tezos
    );
    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokABalance: BigNumber = tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const prevDexCoreTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevBucketTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevFlashSwapAgentTokBBalance: BigNumber =
      await utils.tezos.tz.getBalance(flashSwapAgent.contract.address);
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await dexCore.swap(params);
    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      ledger: [dexCore.contract.address, flashSwapAgent.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokABalance: BigNumber = tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const currDexCoreTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currBucketTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const currFlashSwapAgentTokBBalance: BigNumber =
      await utils.tezos.tz.getBalance(flashSwapAgent.contract.address);
    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      params.amount_in,
      prevTokenBPool,
      prevTokenAPool
    );

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.minus(swapResult.out)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.plus(params.amount_in)
    );
    expect(currBucketTokBBalance).to.be.bignumber.equal(
      prevBucketTokBBalance.plus(params.amount_in)
    );
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance.plus(swapResult.out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.minus(new BigNumber(2000))
    );
    expect(currTokenAPool).to.be.bignumber.equal(swapResult.newToPool);
    expect(currTokenBPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA2 token and return opposite FA1.2 token", async () => {
    const pairId: BigNumber = new BigNumber(4);
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );
    const tokenB: FA2 = await FA2.init(fa2Token1.contract.address, utils.tezos);

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      ledger: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await tokenB.updateStorage({
      account_info: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevAliceTokABalance: BigNumber = tokenA.getBalance(alice.pkh);
    const prevDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokABalance: BigNumber = tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const prevAliceTokBBalance: BigNumber = await tokenB.getBalance(alice.pkh);
    const prevDexCoreTokBBalance: BigNumber = await tokenB.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokBBalance: BigNumber = await tokenB.getBalance(
      flashSwapAgent.contract.address
    );
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await tokenA.approve(dexCore.contract.address, params.amount_in);
    await dexCore.swap(params);
    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      ledger: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await tokenB.updateStorage({
      account_info: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currAliceTokABalance: BigNumber = tokenA.getBalance(alice.pkh);
    const currDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokABalance: BigNumber = tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const currAliceTokBBalance: BigNumber = await tokenB.getBalance(alice.pkh);
    const currDexCoreTokBBalance: BigNumber = await tokenB.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokBBalance: BigNumber = await tokenB.getBalance(
      flashSwapAgent.contract.address
    );
    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      params.amount_in,
      prevTokenAPool,
      prevTokenBPool
    );

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.plus(params.amount_in)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.minus(swapResult.out)
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(
      prevAliceTokABalance.minus(params.amount_in)
    );
    expect(currAliceTokBBalance).to.be.bignumber.equal(prevAliceTokBBalance);
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.plus(swapResult.out)
    );
    expect(currTokenAPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currTokenBPool).to.be.bignumber.equal(swapResult.newToPool);
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA2 token and return opposite FA2 token", async () => {
    const pairId: BigNumber = new BigNumber(3);
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };
    const tokenA: FA2 = await FA2.init(
      Utils.getMinFA2Token(
        { token: fa2Token1.contract.address, id: new BigNumber(0) },
        { token: fa2Token2.contract.address, id: new BigNumber(0) }
      ).token,
      utils.tezos
    );
    const tokenB: FA2 = await FA2.init(
      Utils.getMaxFA2Token(
        { token: fa2Token1.contract.address, id: new BigNumber(0) },
        { token: fa2Token2.contract.address, id: new BigNumber(0) }
      ).token,
      utils.tezos
    );

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      account_info: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await tokenB.updateStorage({
      account_info: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevAliceTokABalance: BigNumber = await tokenA.getBalance(alice.pkh);
    const prevDexCoreTokABalance: BigNumber = await tokenA.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokABalance: BigNumber = await tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const prevAliceTokBBalance: BigNumber = await tokenB.getBalance(alice.pkh);
    const prevDexCoreTokBBalance: BigNumber = await tokenB.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokBBalance: BigNumber = await tokenB.getBalance(
      flashSwapAgent.contract.address
    );
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await dexCore.swap(params);
    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      account_info: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await tokenB.updateStorage({
      account_info: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currAliceTokABalance: BigNumber = await tokenA.getBalance(alice.pkh);
    const currDexCoreTokABalance: BigNumber = await tokenA.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokABalance: BigNumber = await tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const currAliceTokBBalance: BigNumber = await tokenB.getBalance(alice.pkh);
    const currDexCoreTokBBalance: BigNumber = await tokenB.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokBBalance: BigNumber = await tokenB.getBalance(
      flashSwapAgent.contract.address
    );
    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      params.amount_in,
      prevTokenBPool,
      prevTokenAPool
    );

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.minus(swapResult.out)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.plus(params.amount_in)
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(prevAliceTokABalance);
    expect(currAliceTokBBalance).to.be.bignumber.equal(
      prevAliceTokBBalance.minus(params.amount_in)
    );
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance.plus(swapResult.out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance
    );
    expect(currTokenAPool).to.be.bignumber.equal(swapResult.newToPool);
    expect(currTokenBPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA2 token and return opposite TEZ token", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };
    const tokenA: FA2 = await FA2.init(fa2Token1.contract.address, utils.tezos);

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      account_info: [dexCore.contract.address, flashSwapAgent.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      dexCore.tezos
    );
    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevDexCoreTokABalance: BigNumber = await tokenA.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokABalance: BigNumber = await tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const prevDexCoreTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevBucketTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevFlashSwapAgentTokBBalance: BigNumber =
      await utils.tezos.tz.getBalance(flashSwapAgent.contract.address);
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await dexCore.swap(params);
    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      account_info: [dexCore.contract.address, flashSwapAgent.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currDexCoreTokABalance: BigNumber = await tokenA.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokABalance: BigNumber = await tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const currDexCoreTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currBucketTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const currFlashSwapAgentTokBBalance: BigNumber =
      await utils.tezos.tz.getBalance(flashSwapAgent.contract.address);
    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      params.amount_in,
      prevTokenBPool,
      prevTokenAPool
    );

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.minus(swapResult.out)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.plus(params.amount_in)
    );
    expect(currBucketTokBBalance).to.be.bignumber.equal(
      prevBucketTokBBalance.plus(params.amount_in)
    );
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance.plus(swapResult.out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.minus(new BigNumber(2000))
    );
    expect(currTokenAPool).to.be.bignumber.equal(swapResult.newToPool);
    expect(currTokenBPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap TEZ token and return opposite FA1.2 token", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      dexCore.tezos
    );
    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevAliceTokABalance: BigNumber = tokenA.getBalance(alice.pkh);
    const prevDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const prevDexCoreTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevBucketTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevFlashSwapAgentTokBBalance: BigNumber =
      await utils.tezos.tz.getBalance(flashSwapAgent.contract.address);
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await tokenA.approve(dexCore.contract.address, params.amount_in);
    await dexCore.swap(params);
    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currAliceTokABalance: BigNumber = tokenA.getBalance(alice.pkh);
    const currDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const currDexCoreTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currBucketTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const currFlashSwapAgentTokBBalance: BigNumber =
      await utils.tezos.tz.getBalance(flashSwapAgent.contract.address);
    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      params.amount_in,
      prevTokenAPool,
      prevTokenBPool
    );

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.plus(params.amount_in)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.plus(new BigNumber(2000))
    );
    expect(currBucketTokBBalance).to.be.bignumber.equal(
      prevBucketTokBBalance.minus(swapResult.out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.minus(new BigNumber(2000))
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(
      prevAliceTokABalance.minus(params.amount_in)
    );
    expect(currTokenAPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currTokenBPool).to.be.bignumber.equal(swapResult.newToPool);
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap TEZ token and return opposite FA2 token", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };
    const tokenA: FA2 = await FA2.init(fa2Token1.contract.address, utils.tezos);

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      dexCore.tezos
    );
    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevAliceTokABalance: BigNumber = await tokenA.getBalance(alice.pkh);
    const prevDexCoreTokABalance: BigNumber = await tokenA.getBalance(
      dexCore.contract.address
    );
    const prevDexCoreTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevBucketTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevFlashSwapAgentTokBBalance: BigNumber =
      await utils.tezos.tz.getBalance(flashSwapAgent.contract.address);
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await dexCore.swap(params);
    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tokenA.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const currAliceTokABalance: BigNumber = await tokenA.getBalance(alice.pkh);
    const currDexCoreTokABalance: BigNumber = await tokenA.getBalance(
      dexCore.contract.address
    );
    const currDexCoreTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currBucketTokBBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const currFlashSwapAgentTokBBalance: BigNumber =
      await utils.tezos.tz.getBalance(flashSwapAgent.contract.address);
    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      params.amount_in,
      prevTokenAPool,
      prevTokenBPool
    );

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.plus(params.amount_in)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.plus(new BigNumber(2000))
    );
    expect(currBucketTokBBalance).to.be.bignumber.equal(
      prevBucketTokBBalance.minus(swapResult.out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.minus(new BigNumber(2000))
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(
      prevAliceTokABalance.minus(params.amount_in)
    );
    expect(currTokenAPool).to.be.bignumber.equal(swapResult.newFromPool);
    expect(currTokenBPool).to.be.bignumber.equal(swapResult.newToPool);
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should fail if wrong flash swap returns in TEZ token", async () => {
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { b_to_a: undefined }, pair_id: new BigNumber(0) }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(10000),
      min_amount_out: new BigNumber(0),
      flash: true,
    };
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await rejects(dexCore.swap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_FLASH_SWAP_RETURNS);

      return true;
    });
  });

  it("should properly update TOK fee during flash swap", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { a_to_b: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );
    const token: Token = { fa12: fa12Token1.contract.address };

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_fee: [[token, params.referrer]],
      auction_fee: [token],
    });

    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token.toString()},${params.referrer}`
      ];
    const prevAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];

    await tokenA.approve(dexCore.contract.address, params.amount_in);
    await dexCore.swap(params);
    await dexCore.updateStorage({
      interface_fee: [[token, params.referrer]],
      auction_fee: [token],
    });

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.interface_fee[
        `${token.toString()},${params.referrer}`
      ];
    const currAuctionFee: BigNumber =
      dexCore.storage.storage.auction_fee[token.toString()];
    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      params.amount_in,
      prevTokenAPool,
      prevTokenBPool
    );

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.plus(swapResult.interfaceFee)
    );
    expect(currAuctionFee).to.be.bignumber.equal(
      prevAuctionFee.plus(swapResult.auctionFee)
    );
  });

  it("should properly update TEZ fee during flash swap", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const params: Swap = {
      lambda: undefined,
      swaps: [{ direction: { b_to_a: undefined }, pair_id: pairId }],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };

    await dexCore.updateStorage({
      pairs: [pairId],
      interface_tez_fee: [[pairId, params.referrer]],
      auction_tez_fee: [pairId],
    });

    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[pairId.toFixed()].token_b_pool;
    const prevInterfaceTezFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairId.toString()},${params.referrer}`
      ];
    const prevAuctionTezFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairId.toString()];

    await dexCore.swap(params);
    await dexCore.updateStorage({
      interface_tez_fee: [[pairId, params.referrer]],
      auction_tez_fee: [pairId],
    });

    const currInterfaceTezFee: BigNumber =
      dexCore.storage.storage.interface_tez_fee[
        `${pairId.toString()},${params.referrer}`
      ];
    const currAuctionTezFee: BigNumber =
      dexCore.storage.storage.auction_tez_fee[pairId.toString()];
    const swapResult: CalculateSwap = DexCore.calculateSwap(
      dexCore.storage.storage.fees,
      params.amount_in,
      prevTokenAPool,
      prevTokenBPool
    );

    expect(currInterfaceTezFee).to.be.bignumber.equal(
      prevInterfaceTezFee.plus(swapResult.interfaceFee)
    );
    expect(currAuctionTezFee).to.be.bignumber.equal(
      prevAuctionTezFee.plus(swapResult.auctionFee)
    );
  });

  it("should flash swap using FA1.2 -> FA2 -> TEZ route", async () => {
    const pairIds: BigNumber[] = [new BigNumber(4), new BigNumber(1)];
    const params: Swap = {
      lambda: undefined,
      swaps: [
        { direction: { a_to_b: undefined }, pair_id: pairIds[0] },
        { direction: { a_to_b: undefined }, pair_id: pairIds[1] },
      ],
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1000),
      min_amount_out: new BigNumber(1),
      flash: true,
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await tokenA.approve(dexCore.contract.address, params.amount_in);
    await dexCore.swap(params);
  });
});
