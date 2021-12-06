import { FlashSwapsProxy } from "../../helpers/FlashSwapsProxy";
import { Utils } from "../../helpers/Utils";

import chai from "chai";

import { BigNumber } from "bignumber.js";

import { alice, bob } from "../../../scripts/sandbox/accounts";

import { flashSwapsProxyStorage } from "../../../storage/FlashSwapsProxy";

chai.use(require("chai-bignumber")(BigNumber));

describe("FlashSwapsProxy tests", async () => {
  var utils: Utils;
  var flashSwapsProxy: FlashSwapsProxy;

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
