import { FlashSwapsProxy } from "../../helpers/FlashSwapsProxy";
import { Utils } from "../../helpers/Utils";

import chai from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { flashSwapsProxyStorage } from "../../../storage/FlashSwapsProxy";

import { SBAccount } from "test/types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("FlashSwapsProxy tests", async () => {
  var utils: Utils;
  var flashSwapsProxy: FlashSwapsProxy;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    flashSwapsProxyStorage.dex_core = bob.pkh;

    flashSwapsProxy = await FlashSwapsProxy.originate(
      utils.tezos,
      flashSwapsProxyStorage
    );
  });
});
