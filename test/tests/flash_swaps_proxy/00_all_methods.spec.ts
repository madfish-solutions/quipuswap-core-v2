import { Common } from "../../helpers/Errors";
import { FlashSwapsProxy } from "../../helpers/FlashSwapsProxy";
import { FlashSwapAgent } from "test/helpers/FlashSwapAgent";
import { Utils } from "../../helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { flashSwapsProxyStorage } from "../../../storage/FlashSwapsProxy";
import { flashSwapAgentStorage } from "../../../storage/test/FlashSwapAgent";

import { SBAccount } from "test/types/Common";

import fs from "fs";

import { execSync } from "child_process";

import { getLigo } from "../../../scripts/helpers";

chai.use(require("chai-bignumber")(BigNumber));

describe("FlashSwapsProxy tests", async () => {
  var utils: Utils;
  var flashSwapsProxy: FlashSwapsProxy;
  var flashSwapAgent: FlashSwapAgent;

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

    flashSwapAgentStorage.dex_core = bob.pkh;

    flashSwapAgent = await FlashSwapAgent.originate(
      utils.tezos,
      flashSwapAgentStorage
    );

    fs.writeFile(
      "contracts/test/parameters.ligo",
      `const agent : address = ("${flashSwapAgent.contract.address}" : address);\n`,
      function (err) {
        if (err) console.log(err.message);
      }
    );
  });

  it("should fail if not dex core is trying to call", async () => {
    const ligo = getLigo(true);
    // const stdout = execSync(
    //   `${ligo} compile parameter $PWD/contracts/test/lambdas.ligo lambda2 --michelson-format json`,
    //   { maxBuffer: 1024 * 500 }
    // );

    // console.log(stdout.toString());

    // await rejects(flashSwapsProxy.call(alice.pkh), (err: Error) => {
    //   expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);
    //   return true;
    // });
  });
});
