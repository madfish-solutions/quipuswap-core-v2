import { BakerRegistry } from "../../helpers/BakerRegistry";
import { TezStore } from "../../helpers/TezStore";
import { Common } from "../../helpers/Errors";
import { Utils } from "../../helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { tezStoreStorage } from "../../../storage/test/TezStore";

import { SBAccount } from "test/types/Common";
import { Vote } from "test/types/TezStore";

chai.use(require("chai-bignumber")(BigNumber));

describe("TezStore (vote)", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;
  var tezStore: TezStore;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    tezStoreStorage.baker_registry = bakerRegistry.contract.address;
    tezStoreStorage.dex_core = bob.pkh;

    tezStore = await TezStore.originate(utils.tezos, tezStoreStorage);
  });

  it("should fail if not dex core is trying to vote", async () => {
    const params: Vote = {
      voter: alice.pkh,
      candidate: bob.pkh,
      execute_voting: true,
      votes: new BigNumber(0),
      current_balance: new BigNumber(0),
      new_balance: new BigNumber(0),
    };

    await rejects(tezStore.vote(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });
});
