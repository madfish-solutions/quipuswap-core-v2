import { defaultCollectingPeriod, Utils } from "../../helpers/Utils";
import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { TezStore } from "../../helpers/TezStore";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
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

import {
  DivestLiquidity,
  DivestedTokens,
  LaunchExchange,
  Pair,
} from "test/types/DexCore";
import { SBAccount } from "test/types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (divest liquidity)", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;
  var auction: Auction;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa12Token2: FA12;
  var fa2Token1: FA2;
  var fa2Token2: FA2;

  var alice: SBAccount = accounts.alice;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = defaultCollectingPeriod;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

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

  it("should fail if pair not listed", async () => {
    const divestParams: DivestLiquidity = {
      pair_id: new BigNumber(666),
      min_token_a_out: new BigNumber(0),
      min_token_b_out: new BigNumber(0),
      shares: new BigNumber(0),
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.divestLiquidity(divestParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if a divestor have an insufficient liquidity balance", async () => {
    const divestParams: DivestLiquidity = {
      pair_id: new BigNumber(0),
      min_token_a_out: new BigNumber(0),
      min_token_b_out: new BigNumber(0),
      shares: new BigNumber(100_001),
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.divestLiquidity(divestParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_INSUFFICIENT_LIQUIDITY);

      return true;
    });
  });

  it("should fail if a divestor expects zero A token amount in result of divestment", async () => {
    const divestParams: DivestLiquidity = {
      pair_id: new BigNumber(0),
      min_token_a_out: new BigNumber(0),
      min_token_b_out: new BigNumber(100),
      shares: new BigNumber(100_000),
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.divestLiquidity(divestParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_DUST_OUT);

      return true;
    });
  });

  it("should fail if a divestor expects zero B token amount in result of divestment", async () => {
    const divestParams: DivestLiquidity = {
      pair_id: new BigNumber(0),
      min_token_a_out: new BigNumber(100),
      min_token_b_out: new BigNumber(0),
      shares: new BigNumber(100_000),
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.divestLiquidity(divestParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_DUST_OUT);

      return true;
    });
  });

  it("should fail if divested A tokens will be less than min A tokens out", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const shares: BigNumber = new BigNumber(100_000);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested.plus(1),
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.divestLiquidity(divestParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_HIGH_MIN_OUT);

      return true;
    });
  });

  it("should fail if divested B tokens will be less than min B tokens out", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const shares: BigNumber = new BigNumber(100_000);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested.plus(1),
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.divestLiquidity(divestParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_HIGH_MIN_OUT);

      return true;
    });
  });

  it("should divest FA1.2/TEZ liquidity", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const shares: BigNumber = new BigNumber(100);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const prevAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const currAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const currPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    expect(currAliceSharesBalance).to.be.bignumber.equal(
      prevAliceSharesBalance.minus(shares)
    );
    expect(currPair.total_supply).to.be.bignumber.equal(
      prevPair.total_supply.minus(shares)
    );
    expect(currPair.token_a_pool).to.be.bignumber.equal(
      prevPair.token_a_pool.minus(divestedTokens.token_a_divested)
    );
    expect(currPair.token_b_pool).to.be.bignumber.equal(
      prevPair.token_b_pool.minus(divestedTokens.token_b_divested)
    );
  });

  it("should divest FA2/TEZ liquidity", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const shares: BigNumber = new BigNumber(100);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const prevAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const currAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const currPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    expect(currAliceSharesBalance).to.be.bignumber.equal(
      prevAliceSharesBalance.minus(shares)
    );
    expect(currPair.total_supply).to.be.bignumber.equal(
      prevPair.total_supply.minus(shares)
    );
    expect(currPair.token_a_pool).to.be.bignumber.equal(
      prevPair.token_a_pool.minus(divestedTokens.token_a_divested)
    );
    expect(currPair.token_b_pool).to.be.bignumber.equal(
      prevPair.token_b_pool.minus(divestedTokens.token_b_divested)
    );
  });

  it("should divest FA1.2/FA1.2 liquidity", async () => {
    const pairId: BigNumber = new BigNumber(2);
    const shares: BigNumber = new BigNumber(100);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const prevAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const currAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const currPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    expect(currAliceSharesBalance).to.be.bignumber.equal(
      prevAliceSharesBalance.minus(shares)
    );
    expect(currPair.total_supply).to.be.bignumber.equal(
      prevPair.total_supply.minus(shares)
    );
    expect(currPair.token_a_pool).to.be.bignumber.equal(
      prevPair.token_a_pool.minus(divestedTokens.token_a_divested)
    );
    expect(currPair.token_b_pool).to.be.bignumber.equal(
      prevPair.token_b_pool.minus(divestedTokens.token_b_divested)
    );
  });

  it("should divest FA2/FA2 liquidity", async () => {
    const pairId: BigNumber = new BigNumber(3);
    const shares: BigNumber = new BigNumber(100);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const prevAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const currAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const currPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    expect(currAliceSharesBalance).to.be.bignumber.equal(
      prevAliceSharesBalance.minus(shares)
    );
    expect(currPair.total_supply).to.be.bignumber.equal(
      prevPair.total_supply.minus(shares)
    );
    expect(currPair.token_a_pool).to.be.bignumber.equal(
      prevPair.token_a_pool.minus(divestedTokens.token_a_divested)
    );
    expect(currPair.token_b_pool).to.be.bignumber.equal(
      prevPair.token_b_pool.minus(divestedTokens.token_b_divested)
    );
  });

  it("should divest FA1.2/FA2 liquidity", async () => {
    const pairId: BigNumber = new BigNumber(4);
    const shares: BigNumber = new BigNumber(100);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const prevAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const currAliceSharesBalance: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const currPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];

    expect(currAliceSharesBalance).to.be.bignumber.equal(
      prevAliceSharesBalance.minus(shares)
    );
    expect(currPair.total_supply).to.be.bignumber.equal(
      prevPair.total_supply.minus(shares)
    );
    expect(currPair.token_a_pool).to.be.bignumber.equal(
      prevPair.token_a_pool.minus(divestedTokens.token_a_divested)
    );
    expect(currPair.token_b_pool).to.be.bignumber.equal(
      prevPair.token_b_pool.minus(divestedTokens.token_b_divested)
    );
  });

  it("should transfer FA1.2 tokens and divest TEZ tokens from TEZ store contract in time of FA1.2/TEZ liquidity divestment", async () => {
    const pairId: BigNumber = new BigNumber(0);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const tezStore: TezStore = await TezStore.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store,
      utils.tezos
    );

    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, liquidityReceiver],
    });
    await tezStore.updateStorage({
      users: [liquidityReceiver],
    });

    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(liquidityReceiver);
    const prevAliceTezBalance: BigNumber =
      tezStore.storage.users[liquidityReceiver].tez_bal;
    const shares: BigNumber = new BigNumber(100);
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, liquidityReceiver],
    });
    await tezStore.updateStorage({
      users: [liquidityReceiver],
    });

    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(liquidityReceiver);
    const currAliceTezBalance: BigNumber =
      tezStore.storage.users[liquidityReceiver].tez_bal;

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.minus(divestParams.min_token_a_out)
    );
    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.plus(divestParams.min_token_a_out)
    );
    expect(currAliceTezBalance).to.be.bignumber.equal(
      prevAliceTezBalance.minus(divestParams.min_token_b_out)
    );
  });

  it("should transfer FA2 tokens and divest TEZ tokens from TEZ store contract in time of FA2/TEZ liquidity divestment", async () => {
    const pairId: BigNumber = new BigNumber(1);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const tezStore: TezStore = await TezStore.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store,
      utils.tezos
    );

    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, liquidityReceiver],
    });
    await tezStore.updateStorage({
      users: [liquidityReceiver],
    });

    const prevDexCoreTok1Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok1Balance: BigNumber = await fa2Token1.getBalance(
      liquidityReceiver
    );
    const prevAliceTezBalance: BigNumber =
      tezStore.storage.users[liquidityReceiver].tez_bal;
    const shares: BigNumber = new BigNumber(100);
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, liquidityReceiver],
    });
    await tezStore.updateStorage({
      users: [liquidityReceiver],
    });

    const currDexCoreTok1Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok1Balance: BigNumber = await fa2Token1.getBalance(
      liquidityReceiver
    );
    const currAliceTezBalance: BigNumber =
      tezStore.storage.users[liquidityReceiver].tez_bal;

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.minus(divestParams.min_token_a_out)
    );
    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.plus(divestParams.min_token_a_out)
    );
    expect(currAliceTezBalance).to.be.bignumber.equal(
      prevAliceTezBalance.minus(divestParams.min_token_b_out)
    );
  });

  it("should transfer FA1.2 tokens in time of FA1.2/FA1.2 liquidity divestment", async () => {
    const pairId: BigNumber = new BigNumber(2);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, liquidityReceiver],
    });
    await fa12Token2.updateStorage({
      ledger: [dexCore.contract.address, liquidityReceiver],
    });

    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(liquidityReceiver);
    const prevDexCoreTok2Balance: BigNumber = fa12Token2.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber =
      fa12Token2.getBalance(liquidityReceiver);
    const shares: BigNumber = new BigNumber(100);
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, liquidityReceiver],
    });
    await fa12Token2.updateStorage({
      ledger: [dexCore.contract.address, liquidityReceiver],
    });

    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(liquidityReceiver);
    const currDexCoreTok2Balance: BigNumber = fa12Token2.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber =
      fa12Token2.getBalance(liquidityReceiver);

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.minus(divestParams.min_token_a_out)
    );
    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.plus(divestParams.min_token_a_out)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.minus(divestParams.min_token_b_out)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.plus(divestParams.min_token_b_out)
    );
  });

  it("should transfer FA2 tokens in time of FA2/FA2 liquidity divestment", async () => {
    const pairId: BigNumber = new BigNumber(3);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, liquidityReceiver],
    });
    await fa2Token2.updateStorage({
      account_info: [dexCore.contract.address, liquidityReceiver],
    });

    const prevDexCoreTok1Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok1Balance: BigNumber = await fa2Token1.getBalance(
      liquidityReceiver
    );
    const prevDexCoreTok2Balance: BigNumber = await fa2Token2.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber = await fa2Token2.getBalance(
      liquidityReceiver
    );
    const shares: BigNumber = new BigNumber(100);
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, liquidityReceiver],
    });
    await fa2Token2.updateStorage({
      account_info: [dexCore.contract.address, liquidityReceiver],
    });

    const currDexCoreTok1Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok1Balance: BigNumber = await fa2Token1.getBalance(
      liquidityReceiver
    );
    const currDexCoreTok2Balance: BigNumber = await fa2Token2.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber = await fa2Token2.getBalance(
      liquidityReceiver
    );

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.minus(divestParams.min_token_a_out)
    );
    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.plus(divestParams.min_token_a_out)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.minus(divestParams.min_token_b_out)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.plus(divestParams.min_token_b_out)
    );
  });

  it("should transfer FA1.2 tokens and FA2 tokens in time of FA1.2/FA2 liquidity divestment", async () => {
    const pairId: BigNumber = new BigNumber(4);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, liquidityReceiver],
    });
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, liquidityReceiver],
    });

    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(liquidityReceiver);
    const prevDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const prevAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      liquidityReceiver
    );
    const shares: BigNumber = new BigNumber(100);
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address, liquidityReceiver],
    });
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address, liquidityReceiver],
    });

    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok1Balance: BigNumber =
      fa12Token1.getBalance(liquidityReceiver);
    const currDexCoreTok2Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address
    );
    const currAliceTok2Balance: BigNumber = await fa2Token1.getBalance(
      liquidityReceiver
    );

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.minus(divestParams.min_token_a_out)
    );
    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.plus(divestParams.min_token_a_out)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.minus(divestParams.min_token_b_out)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.plus(divestParams.min_token_b_out)
    );
  });

  it("should fail if pair does not have liquidity", async () => {
    const pairId: BigNumber = new BigNumber(2);
    const liquidityReceiver: string = alice.pkh;

    await dexCore.updateStorage({
      ledger: [[liquidityReceiver, pairId.toFixed()]],
      pairs: [pairId.toFixed()],
    });

    const shares: BigNumber =
      dexCore.storage.storage.ledger[
        `${liquidityReceiver},${pairId.toFixed()}`
      ];
    const divestedTokens: DivestedTokens = DexCore.getDivestedTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_divested,
      min_token_b_out: divestedTokens.token_b_divested,
      shares: shares,
      liquidity_receiver: liquidityReceiver,
      candidate: alice.pkh,
    };

    await dexCore.divestLiquidity(divestParams);
    await rejects(dexCore.divestLiquidity(divestParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_NO_LIQUIDITY);

      return true;
    });
  });
});