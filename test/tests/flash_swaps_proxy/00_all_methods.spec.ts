import { FlashSwapsProxy } from "../../helpers/FlashSwapsProxy";
import { FlashSwapAgent } from "test/helpers/FlashSwapAgent";
import { DexCore } from "../../helpers/DexCore";
import { Utils } from "../../helpers/Utils";

import chai from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { confirmOperation } from "scripts/confirmation";

import { flashSwapAgentStorage } from "../../../storage/test/FlashSwapAgent";
import { flashSwapsProxyStorage } from "../../../storage/FlashSwapsProxy";

import { LaunchExchange } from "test/types/DexCore";
import { fa12Storage } from "storage/test/FA12";
import { SBAccount } from "test/types/Common";
import { FA12 } from "test/helpers/FA12";

import fs from "fs";

import { execSync } from "child_process";

import { getLigo } from "../../../scripts/helpers";

import { dexCoreStorage } from "storage/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("FlashSwapsProxy", async () => {
  var utils: Utils;
  var flashSwapsProxy: FlashSwapsProxy;
  var flashSwapAgent: FlashSwapAgent;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa12Token2: FA12;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    fa12Token1 = await FA12.originate(utils.tezos, fa12Storage);
    fa12Token2 = await FA12.originate(utils.tezos, fa12Storage);

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.baker_registry = alice.pkh;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    let params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { fa12: fa12Token2.contract.address },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    params = DexCore.changeTokensOrderInPair(params, false);

    await fa12Token1.approve(dexCore.contract.address, params.token_a_in);
    await fa12Token2.approve(dexCore.contract.address, params.token_b_in);
    await dexCore.launchExchange(params);

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
      `const agent : address = ("${flashSwapAgent.contract.address}" : address);\n`,
      function (err) {
        if (err) console.log(err.message);
      }
    );
  });

  it("should fail if not dex core is trying to call", async () => {
    // const ligo = getLigo(true);
    // const stdout = execSync(
    //   `${ligo} compile parameter $PWD/contracts/test/lambdas.ligo 'Use(Flash_swap(record [ lambda = lambda2; pair_id = 0n; receiver = ("${alice.pkh}" : address); referrer = ("${bob.pkh}" : address); amount_a_out = 1n; amount_b_out = 1n ] ))' -p hangzhou --michelson-format json`,
    //   { maxBuffer: 1024 * 500 }
    // );
    // const operation = await utils.tezos.contract.transfer({
    //   to: dexCore.contract.address,
    //   amount: 0,
    //   parameter: {
    //     entrypoint: "use",
    //     value: JSON.parse(stdout.toString()).args[0],
    //   },
    //   storageLimit: 2000,
    // });
    // await confirmOperation(utils.tezos, operation.hash);
  });
});
