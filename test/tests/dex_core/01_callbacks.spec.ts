import { Common } from "../../helpers/Errors";
import { DexCore } from "../../helpers/DexCore";
import { defaultCollectingPeriod, Utils } from "../../helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { dexCoreStorage } from "../../../storage/DexCore";

import { LaunchCallback } from "test/types/DexCore";
import { SBAccount } from "test/types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (callbacks)", async () => {
  var utils: Utils;
  var dexCore: DexCore;

  var alice: SBAccount = accounts.alice;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = defaultCollectingPeriod;
    dexCoreStorage.storage.baker_registry = alice.pkh;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();
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
});
