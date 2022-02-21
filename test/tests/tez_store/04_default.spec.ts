import { BakerRegistry } from "../../helpers/BakerRegistry";
import { TezStore } from "../../helpers/TezStore";
import { DexCore } from "../../helpers/DexCore";
import { Utils } from "../../helpers/Utils";
import { FA2 } from "../../helpers/FA2";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa2Storage } from "../../../storage/test/FA2";

import { TezStoreStorage, UpdateRewards } from "test/types/TezStore";
import { LaunchExchange, Pair } from "test/types/DexCore";
import { SBAccount } from "test/types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("TezStore (default)", async () => {
  var bakerRegistry: BakerRegistry;
  var tezStore: TezStore;
  var dexCore: DexCore;
  var fa2Token1: FA2;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  var pairId: BigNumber = new BigNumber(0);

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = new BigNumber(4);
    dexCoreStorage.storage.cycle_duration = new BigNumber(10);
    dexCoreStorage.storage.voting_period = new BigNumber(10);
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    const launchParams: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
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
    await dexCore.updateStorage({
      pairs: [pairId],
    });

    tezStore = await TezStore.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store,
      dexCore.tezos
    );
  });

  it("should update global rewards - 1", async () => {
    const amount: number = 100;

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await tezStore.updateStorage();

    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const prevStorage: TezStoreStorage = tezStore.storage;

    await tezStore.default(amount);
    await tezStore.updateStorage();

    const expectedData: UpdateRewards = await tezStore.updateRewards(
      new BigNumber(amount),
      prevStorage,
      prevPair,
      utils
    );

    expect(tezStore.storage.reward_per_share).to.be.bignumber.equal(
      expectedData.rewardPerShare
    );
    expect(tezStore.storage.next_reward).to.be.bignumber.equal(
      expectedData.nextReward
    );
    expect(tezStore.storage.last_update_level).to.be.bignumber.equal(
      expectedData.lastUpdateLevel
    );
  });
});
