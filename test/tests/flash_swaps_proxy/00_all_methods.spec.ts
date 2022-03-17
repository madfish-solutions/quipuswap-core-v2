import { FlashSwapsProxy } from "../../helpers/FlashSwapsProxy";
import { FlashSwapAgent } from "../../helpers/FlashSwapAgent";
import { DexCore } from "../../helpers/DexCore";
import { Utils } from "../../helpers/Utils";

import chai from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { flashSwapAgentStorage } from "../../../storage/test/FlashSwapAgent";
import { flashSwapsProxyStorage } from "../../../storage/FlashSwapsProxy";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";

import { FlashSwap, LaunchExchange } from "../../types/DexCore";
import { SBAccount } from "../../types/Common";
import { FA12 } from "../../helpers/FA12";

import fs from "fs";

chai.use(require("chai-bignumber")(BigNumber));

describe("FlashSwapsProxy", async () => {
  var flashSwapsProxy: FlashSwapsProxy;
  var flashSwapAgent: FlashSwapAgent;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa12Token2: FA12;
  var utils: Utils;

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
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
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

  it("should call default entrypoint by dex core", async () => {
    const params: FlashSwap = {
      flash_swap_rule: "Loan_a_return_a",
      pair_id: new BigNumber(0),
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_out: new BigNumber(10),
    };
    const tokenA: FA12 = await FA12.init(
      Utils.getMinFA12Token(
        fa12Token1.contract.address,
        fa12Token2.contract.address
      ),
      utils.tezos
    );

    await tokenA.approve(dexCore.contract.address, new BigNumber(100));
    await dexCore.flashSwap(params);
  });
});
