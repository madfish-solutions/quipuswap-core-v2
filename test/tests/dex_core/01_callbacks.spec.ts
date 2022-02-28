import { Common, DexCore as DexCoreErrors } from "../../helpers/Errors";
import { DexCore } from "../../helpers/DexCore";
import { Utils } from "../../helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";

import { LaunchCallback, LaunchExchange } from "test/types/DexCore";
import { BakerRegistry } from "test/helpers/BakerRegistry";
import { SBAccount } from "test/types/Common";
import { FA12 } from "test/helpers/FA12";

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

  it("should fail if not entered", async () => {
    await rejects(
      dexCore.fa12BalanceCallback1(new BigNumber(0)),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_NOT_ENTERED);

        return true;
      }
    );
  });

  it("should fail if pair not listed", async () => {
    dexCoreStorage.storage.tmp = {
      pair_id: new BigNumber(666),
      amount_a_out: new BigNumber(0),
      amount_b_out: new BigNumber(0),
      referrer: alice.pkh,
      token_a_balance_1: new BigNumber(0),
      token_b_balance_1: new BigNumber(0),
      token_a_balance_2: new BigNumber(0),
      token_b_balance_2: new BigNumber(0),
    };
    dexCoreStorage.storage.entered = true;

    const dex: DexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dex.setLambdas();
    await rejects(dex.fa12BalanceCallback1(new BigNumber(0)), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if not entered", async () => {
    await rejects(dexCore.fa2BalanceCallback1([]), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_NOT_ENTERED);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    dexCoreStorage.storage.tmp = {
      pair_id: new BigNumber(666),
      amount_a_out: new BigNumber(0),
      amount_b_out: new BigNumber(0),
      referrer: alice.pkh,
      token_a_balance_1: new BigNumber(0),
      token_b_balance_1: new BigNumber(0),
      token_a_balance_2: new BigNumber(0),
      token_b_balance_2: new BigNumber(0),
    };
    dexCoreStorage.storage.entered = true;

    const dex: DexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dex.setLambdas();
    await rejects(dex.fa2BalanceCallback1([]), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if not entered", async () => {
    await rejects(
      dexCore.fa12BalanceCallback2(new BigNumber(0)),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_NOT_ENTERED);

        return true;
      }
    );
  });

  it("should fail if pair not listed", async () => {
    dexCoreStorage.storage.tmp = {
      pair_id: new BigNumber(666),
      amount_a_out: new BigNumber(0),
      amount_b_out: new BigNumber(0),
      referrer: alice.pkh,
      token_a_balance_1: new BigNumber(0),
      token_b_balance_1: new BigNumber(0),
      token_a_balance_2: new BigNumber(0),
      token_b_balance_2: new BigNumber(0),
    };
    dexCoreStorage.storage.entered = true;

    const dex: DexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dex.setLambdas();
    await rejects(dex.fa12BalanceCallback2(new BigNumber(0)), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if not entered", async () => {
    await rejects(dexCore.fa2BalanceCallback2([]), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_NOT_ENTERED);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    dexCoreStorage.storage.tmp = {
      pair_id: new BigNumber(666),
      amount_a_out: new BigNumber(0),
      amount_b_out: new BigNumber(0),
      referrer: alice.pkh,
      token_a_balance_1: new BigNumber(0),
      token_b_balance_1: new BigNumber(0),
      token_a_balance_2: new BigNumber(0),
      token_b_balance_2: new BigNumber(0),
    };
    dexCoreStorage.storage.entered = true;

    const dex: DexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dex.setLambdas();
    await rejects(dex.fa2BalanceCallback2([]), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if not dex core is trying to call it", async () => {
    await rejects(dexCore.flashSwapCallback1(), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should fail if not dex core is trying to call it", async () => {
    await rejects(dexCore.flashSwapCallback2(), (err: Error) => {
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
        new_balance: new BigNumber(0),
      },
      tez_store: alice.pkh,
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
    };

    await fa12Token1.approve(dexCore.contract.address, params.token_a_in);
    await dexCore.launchExchange(params, params.token_b_in.toNumber());
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.entered).to.be.false;
  });
});
