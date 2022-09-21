import { BakerRegistry } from "../../helpers/BakerRegistry";
import { zeroAddress, Utils } from "../../helpers/Utils";
import { DexCore } from "../../helpers/DexCore";
import { Bucket } from "../../helpers/Bucket";
import { FA2 } from "../../helpers/FA2";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa2Storage } from "../../../storage/test/FA2";

import { Baker, User } from "../../types/Bucket";
import { SBAccount } from "../../types/Common";
import {
  InvestLiquidity,
  LaunchExchange,
  RequiredTokens,
  Pair,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("Bucket (vote - 2)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;
  var fa2Token1: FA2;
  var fa2Token2: FA2;
  var bucket: Bucket;
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

    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);
    fa2Token2 = await FA2.originate(utils.tezos, fa2Storage);

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = new BigNumber(100);
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    const sharesReceiver: string = alice.pkh;
    let launchParams: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(50),
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );

    launchParams = {
      pair: {
        token_a: {
          fa2: { token: fa2Token2.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(50),
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa2Token2.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );
  });

});
