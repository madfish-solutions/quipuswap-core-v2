import { Utils, zeroAddress } from "../../helpers/Utils";
import { DexCore } from "../../helpers/DexCore";
import { Common } from "../../helpers/Errors";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";

import { BakerRegistry } from "../../helpers/BakerRegistry";
import { SBAccount } from "../../types/Common";
import { FA12 } from "../../helpers/FA12";
import {
  LaunchCallback,
  LaunchExchange,
  FlashSwapCallback,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (callbacks)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    fa12Token1 = await FA12.originate(utils.tezos, fa12Storage);
  });

  it("should fail if not dex core is trying to call it", async () => {
    const params: FlashSwapCallback = {
      flash_swap_rule: { loan_a_return_a: undefined },
      pair_id: new BigNumber(0),
      return_token: { fa12: zeroAddress },
      referrer: zeroAddress,
      sender: zeroAddress,
      swap_token_pool: new BigNumber(0),
      return_token_pool: new BigNumber(0),
      amount_out: new BigNumber(0),
      prev_tez_balance: new BigNumber(0),
    };

    await rejects(dexCore.flashSwapCallback(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should fail if not dex core is trying to call launch exchange callback", async () => {
    const params: LaunchCallback = {
      vote_params: {
        voter: alice.pkh,
        candidate: alice.pkh,
        execute_voting: true,
        votes: new BigNumber(0),
        current_balance: new BigNumber(0),
      },
      bucket: alice.pkh,
    };

    await rejects(dexCore.launchCallback(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should fail if not dex core is trying to call it", async () => {
    await rejects(dexCore.close(), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should close (reentrancy protection)", async () => {
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.entered).to.be.false;

    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token1.approve(dexCore.contract.address, params.token_a_in);
    await dexCore.launchExchange(params, params.token_b_in.toNumber());
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.entered).to.be.false;
  });
});
