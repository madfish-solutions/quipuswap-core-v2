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

import { SBAccount } from "../../types/Common";
import {
  CalculateFlashSwap,
  LaunchExchange,
  FlashSwap,
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
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000),
      receiver: zeroAddress,
      referrer: zeroAddress,
      amount_out: new BigNumber(0),
    };

    await rejects(dexCore2.flashSwap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000),
      receiver: zeroAddress,
      referrer: zeroAddress,
      amount_out: new BigNumber(0),
    };

    await rejects(dexCore.flashSwap(params, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should fail if action is outdated", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000),
      receiver: alice.pkh,
      referrer: alice.pkh,
      amount_out: new BigNumber(1),
    };

    await rejects(dexCore.flashSwap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_ACTION_OUTDATED);

      return true;
    });
  });

  it("should fail if user is trying to refer himself", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: alice.pkh,
      amount_out: new BigNumber(1),
    };

    await rejects(dexCore.flashSwap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_CAN_NOT_REFER_YOURSELF);

      return true;
    });
  });

  it("should fail if dust out", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_out: new BigNumber(0),
    };

    await rejects(dexCore.flashSwap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_DUST_OUT);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(666),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_out: new BigNumber(1),
    };

    await rejects(dexCore.flashSwap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if insufficient out token liquidity", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_out: new BigNumber(5_000_001),
    };

    await rejects(dexCore.flashSwap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_INSUFFICIENT_LIQUIDITY);

      return true;
    });
  });

  it("should flash swap FA1.2 token and return the same token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );

    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      ledger: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenAPool,
      prevTokenAPool
    );
    const prevAliceTokABalance: BigNumber = tokenA.getBalance(alice.pkh);
    const prevDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokABalance: BigNumber = tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await tokenA.approve(dexCore.contract.address, flashSwapResults.returns);
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      ledger: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const currAliceTokABalance: BigNumber = tokenA.getBalance(alice.pkh);
    const currDexCoreTokABalance: BigNumber = tokenA.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokABalance: BigNumber = tokenA.getBalance(
      flashSwapAgent.contract.address
    );

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.plus(flashSwapResults.fullFee)
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(
      prevAliceTokABalance.minus(flashSwapResults.returns)
    );
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance.plus(params.amount_out)
    );
    expect(currTokenAPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(currTokenBPool).to.be.bignumber.equal(prevTokenBPool);
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA1.2 token and return opposite FA1.2 token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_b_return_a",
      pair_id: new BigNumber(2),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
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
      pairs: [params.pair_id],
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
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenBPool,
      prevTokenAPool
    );
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
    await tokenA.approve(dexCore.contract.address, flashSwapResults.returns);
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
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
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
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

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.plus(flashSwapResults.returns)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.minus(params.amount_out)
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(
      prevAliceTokABalance.minus(flashSwapResults.returns)
    );
    expect(currAliceTokBBalance).to.be.bignumber.equal(prevAliceTokBBalance);
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.plus(params.amount_out)
    );
    expect(currTokenAPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(currTokenBPool).to.be.bignumber.equal(
      prevTokenBPool.minus(params.amount_out)
    );
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA1.2 token and return opposite FA2 token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_b",
      pair_id: new BigNumber(4),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );
    const tokenB: FA2 = await FA2.init(fa2Token1.contract.address, utils.tezos);

    await dexCore.updateStorage({
      pairs: [params.pair_id],
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
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenAPool,
      prevTokenBPool
    );
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
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
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
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
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

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.minus(params.amount_out)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.plus(flashSwapResults.returns)
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(prevAliceTokABalance);
    expect(currAliceTokBBalance).to.be.bignumber.equal(
      prevAliceTokBBalance.minus(flashSwapResults.returns)
    );
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance.plus(params.amount_out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance
    );
    expect(currTokenAPool).to.be.bignumber.equal(
      prevTokenAPool.minus(params.amount_out)
    );
    expect(currTokenBPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA1.2 token and return opposite TEZ token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_b",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );

    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      ledger: [dexCore.contract.address, flashSwapAgent.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].bucket,
      dexCore.tezos
    );
    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenAPool,
      prevTokenBPool
    );
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
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      ledger: [dexCore.contract.address, flashSwapAgent.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
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

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.minus(params.amount_out)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance
    );
    expect(currBucketTokBBalance).to.be.bignumber.equal(
      prevBucketTokBBalance.plus(new BigNumber(2000))
    );
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance.plus(params.amount_out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.minus(new BigNumber(2000))
    );
    expect(currTokenAPool).to.be.bignumber.equal(
      prevTokenAPool.minus(params.amount_out)
    );
    expect(currTokenBPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA2 token and return the same token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(1),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
    };
    const tokenA: FA2 = await FA2.init(fa2Token1.contract.address, utils.tezos);

    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      account_info: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenAPool,
      prevTokenAPool
    );
    const prevAliceTokABalance: BigNumber = await tokenA.getBalance(alice.pkh);
    const prevDexCoreTokABalance: BigNumber = await tokenA.getBalance(
      dexCore.contract.address
    );
    const prevFlashSwapAgentTokABalance: BigNumber = await tokenA.getBalance(
      flashSwapAgent.contract.address
    );
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      account_info: [
        alice.pkh,
        dexCore.contract.address,
        flashSwapAgent.contract.address,
      ],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const currAliceTokABalance: BigNumber = await tokenA.getBalance(alice.pkh);
    const currDexCoreTokABalance: BigNumber = await tokenA.getBalance(
      dexCore.contract.address
    );
    const currFlashSwapAgentTokABalance: BigNumber = await tokenA.getBalance(
      flashSwapAgent.contract.address
    );

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.plus(flashSwapResults.fullFee)
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(
      prevAliceTokABalance.minus(flashSwapResults.returns)
    );
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance.plus(params.amount_out)
    );
    expect(currTokenAPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(currTokenBPool).to.be.bignumber.equal(prevTokenBPool);
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA2 token and return opposite FA1.2 token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_b_return_a",
      pair_id: new BigNumber(4),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );
    const tokenB: FA2 = await FA2.init(fa2Token1.contract.address, utils.tezos);

    await dexCore.updateStorage({
      pairs: [params.pair_id],
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
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenBPool,
      prevTokenAPool
    );
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
    await tokenA.approve(dexCore.contract.address, flashSwapResults.returns);
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
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
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
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

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.plus(flashSwapResults.returns)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.minus(params.amount_out)
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(
      prevAliceTokABalance.minus(flashSwapResults.returns)
    );
    expect(currAliceTokBBalance).to.be.bignumber.equal(prevAliceTokBBalance);
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.plus(params.amount_out)
    );
    expect(currTokenAPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(currTokenBPool).to.be.bignumber.equal(
      prevTokenBPool.minus(params.amount_out)
    );
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA2 token and return opposite FA2 token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_b",
      pair_id: new BigNumber(3),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
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
      pairs: [params.pair_id],
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
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenAPool,
      prevTokenBPool
    );
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
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
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
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
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

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.minus(params.amount_out)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.plus(flashSwapResults.returns)
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(prevAliceTokABalance);
    expect(currAliceTokBBalance).to.be.bignumber.equal(
      prevAliceTokBBalance.minus(flashSwapResults.returns)
    );
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance.plus(params.amount_out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance
    );
    expect(currTokenAPool).to.be.bignumber.equal(
      prevTokenAPool.minus(params.amount_out)
    );
    expect(currTokenBPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap FA2 token and return opposite TEZ token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_b",
      pair_id: new BigNumber(1),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: flashSwapAgent.contract.address,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
    };
    const tokenA: FA2 = await FA2.init(fa2Token1.contract.address, utils.tezos);

    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      account_info: [dexCore.contract.address, flashSwapAgent.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].bucket,
      dexCore.tezos
    );
    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenAPool,
      prevTokenBPool
    );
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
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      account_info: [dexCore.contract.address, flashSwapAgent.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
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

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.minus(params.amount_out)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance
    );
    expect(currBucketTokBBalance).to.be.bignumber.equal(
      prevBucketTokBBalance.plus(new BigNumber(2000))
    );
    expect(currFlashSwapAgentTokABalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokABalance.plus(params.amount_out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.minus(new BigNumber(2000))
    );
    expect(currTokenAPool).to.be.bignumber.equal(
      prevTokenAPool.minus(params.amount_out)
    );
    expect(currTokenBPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap TEZ token and return the same token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_b_return_b",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
    };

    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await flashSwapAgent.updateStorage();

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].bucket,
      dexCore.tezos
    );
    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenBPool,
      prevTokenBPool
    );
    const prevDexCoreTokBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const prevBucketTokBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevBobTokBalance: BigNumber = await utils.tezos.tz.getBalance(
      bob.pkh
    );
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const currDexCoreTokBalance: BigNumber = await utils.tezos.tz.getBalance(
      dexCore.contract.address
    );
    const currBucketTokBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const currBobTokBalance: BigNumber = await utils.tezos.tz.getBalance(
      bob.pkh
    );

    expect(currDexCoreTokBalance).to.be.bignumber.equal(prevDexCoreTokBalance);
    expect(currBucketTokBalance).to.be.bignumber.equal(
      prevBucketTokBalance.plus(new BigNumber(1000))
    );
    expect(currBobTokBalance).to.be.bignumber.equal(
      prevBobTokBalance.plus(params.amount_out)
    );
    expect(currTokenAPool).to.be.bignumber.equal(prevTokenAPool);
    expect(currTokenBPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap TEZ token and return opposite FA1.2 token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_b_return_a",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
    };
    const tokenA: FA12 = await FA12.init(
      fa12Token1.contract.address,
      utils.tezos
    );

    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].bucket,
      dexCore.tezos
    );
    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenBPool,
      prevTokenAPool
    );
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
    await tokenA.approve(dexCore.contract.address, flashSwapResults.returns);
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      ledger: [alice.pkh, dexCore.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
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

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.plus(flashSwapResults.returns)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.plus(new BigNumber(2000))
    );
    expect(currBucketTokBBalance).to.be.bignumber.equal(
      prevBucketTokBBalance.minus(params.amount_out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.minus(new BigNumber(2000))
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(
      prevAliceTokABalance.minus(flashSwapResults.returns)
    );
    expect(currTokenAPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(currTokenBPool).to.be.bignumber.equal(
      prevTokenBPool.minus(params.amount_out)
    );
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should flash swap TEZ token and return opposite FA2 token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_b_return_a",
      pair_id: new BigNumber(1),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: bob.pkh,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
    };
    const tokenA: FA2 = await FA2.init(fa2Token1.contract.address, utils.tezos);

    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].bucket,
      dexCore.tezos
    );
    const prevTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const prevTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
    const flashSwapResults: CalculateFlashSwap = DexCore.calculateFlashSwap(
      params.flash_swap_rule,
      dexCore.storage.storage.fees,
      params.amount_out,
      prevTokenBPool,
      prevTokenAPool
    );
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
    await dexCore.flashSwap(params);
    await dexCore.updateStorage({
      pairs: [params.pair_id],
    });
    await tokenA.updateStorage({
      account_info: [alice.pkh, dexCore.contract.address],
    });
    await flashSwapAgent.updateStorage();

    const currTokenAPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_a_pool;
    const currTokenBPool: BigNumber =
      dexCore.storage.storage.pairs[params.pair_id.toFixed()].token_b_pool;
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

    expect(currDexCoreTokABalance).to.be.bignumber.equal(
      prevDexCoreTokABalance.plus(flashSwapResults.returns)
    );
    expect(currDexCoreTokBBalance).to.be.bignumber.equal(
      prevDexCoreTokBBalance.plus(new BigNumber(2000))
    );
    expect(currBucketTokBBalance).to.be.bignumber.equal(
      prevBucketTokBBalance.minus(params.amount_out)
    );
    expect(currFlashSwapAgentTokBBalance).to.be.bignumber.equal(
      prevFlashSwapAgentTokBBalance.minus(new BigNumber(2000))
    );
    expect(currAliceTokABalance).to.be.bignumber.equal(
      prevAliceTokABalance.minus(flashSwapResults.returns)
    );
    expect(currTokenAPool).to.be.bignumber.equal(
      flashSwapResults.newReturnTokPool
    );
    expect(currTokenBPool).to.be.bignumber.equal(
      prevTokenBPool.minus(params.amount_out)
    );
    expect(flashSwapAgent.storage.val).to.be.bignumber.equal(
      new BigNumber(value)
    );
    expect(currTokenAPool.multipliedBy(currTokenBPool)).to.be.bignumber.gt(
      prevTokenAPool.multipliedBy(prevTokenBPool)
    );
  });

  it("should fail if wrong flash swap returns in TEZ token", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_b",
      pair_id: new BigNumber(0),
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_out: new BigNumber(10000),
    };
    const value: number = Math.round(Math.random() * 100 + 1);

    await updateParameters(flashSwapAgent.contract.address, value);
    await rejects(dexCore.flashSwap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_FLASH_SWAP_RETURNS);

      return true;
    });
  });
});
