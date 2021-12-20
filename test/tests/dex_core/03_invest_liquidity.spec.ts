import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
import { defaultCollectingPeriod, Utils } from "../../helpers/Utils";
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
  InvestLiquidity,
  LaunchExchange,
  RequiredTokens,
} from "test/types/DexCore";
import { SBAccount } from "test/types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (invest liquidity)", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;
  var auction: Auction;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa12Token2: FA12;
  var fa2Token1: FA2;

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

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = dexCore.contract.address;
    auctionStorage.storage.quipu_token = fa2Token1.contract.address;

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();
  });

  it("should fail if pair not listed", async () => {
    const params: InvestLiquidity = {
      pair_id: new BigNumber(0),
      token_a_in: new BigNumber(0),
      token_b_in: new BigNumber(0),
      shares: new BigNumber(0),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.investLiquidity(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if investor expects zero shares amount in result of investment", async () => {
    const launchParams: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(50),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };
    const investParams: InvestLiquidity = {
      pair_id: new BigNumber(0),
      token_a_in: new BigNumber(0),
      token_b_in: new BigNumber(0),
      shares: new BigNumber(0),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(launchParams);
    await rejects(dexCore.investLiquidity(investParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_NO_SHARES_EXPECTED);

      return true;
    });
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
    const params: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required.minus(1),
      token_b_in: requiredTokens.tokens_a_required,
      shares: shares,
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(dexCore.investLiquidity(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_LOW_TOKEN_A_IN);

      return true;
    });
  });

  it("should fail if token B is TEZ and low token B in", async () => {
    const pairId: BigNumber = new BigNumber(0);

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const shares: BigNumber = new BigNumber(100);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const params: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required.minus(1),
      shares: shares,
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await rejects(
      dexCore.investLiquidity(params, params.token_b_in.toNumber()),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_LOW_TOKEN_B_IN);

        return true;
      }
    );
  });

  it("should fail if low token B in", async () => {
    const pairId: BigNumber = new BigNumber(1);

    let launchParams: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { fa12: fa12Token2.contract.address },
      },
      token_a_in: new BigNumber(50),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    launchParams = DexCore.changeTokensOrderInPair(launchParams, false);

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await fa12Token2.approve(dexCore.contract.address, launchParams.token_b_in);
    await dexCore.launchExchange(launchParams);
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

    await rejects(dexCore.investLiquidity(investParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_LOW_TOKEN_B_IN);

      return true;
    });
  });
});
