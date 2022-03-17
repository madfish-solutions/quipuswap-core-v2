import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { FlashSwapsProxy } from "../../helpers/FlashSwapsProxy";
import { FlashSwapAgent } from "../../helpers/FlashSwapAgent";
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

import { flashSwapAgentStorage } from "../../../storage/test/FlashSwapAgent";
import { flashSwapsProxyStorage } from "../../../storage/FlashSwapsProxy";
import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { auctionStorage } from "../../../storage/Auction";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";
import { fa2Storage } from "../../../storage/test/FA2";

import { FlashSwap, LaunchExchange } from "../../types/DexCore";
import { SBAccount } from "../../types/Common";

import fs from "fs";

chai.use(require("chai-bignumber")(BigNumber));

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
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
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

    fs.writeFile(
      "contracts/test/parameters.ligo",
      `const agent : address = ("${flashSwapAgent.contract.address}" : address);\nconst token : token_t = Fa12(("${fa12Token1.contract.address}" : address));\n`,
      function (err) {
        if (err) console.log(err.message);
      }
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
      receiver: alice.pkh,
      referrer: alice.pkh,
      amount_out: new BigNumber(1),
    };

    await rejects(dexCore2.flashSwap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if user is trying to refer himself", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(0),
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
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_out: new BigNumber(5_000_001),
    };

    await rejects(dexCore.flashSwap(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_INSUFFICIENT_LIQUIDITY);

      return true;
    });
  });

  xit("should flash swap FA1.2 token and return the same token with fee", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(0),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_out: new BigNumber(1000),
    };

    await dexCore.flashSwap(params);
  });
});
