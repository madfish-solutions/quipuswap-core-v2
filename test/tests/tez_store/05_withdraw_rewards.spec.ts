import { BakerRegistry } from "../../helpers/BakerRegistry";
import { TezStore } from "../../helpers/TezStore";
import { DexCore } from "../../helpers/DexCore";
import { Utils } from "../../helpers/Utils";
import { FA2 } from "../../helpers/FA2";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa2Storage } from "../../../storage/test/FA2";

import { WithdrawRewards } from "test/types/TezStore";
import { LaunchExchange, WithdrawProfit } from "test/types/DexCore";
import { SBAccount } from "test/types/Common";
import { Common } from "test/helpers/Errors";

chai.use(require("chai-bignumber")(BigNumber));

describe("TezStore (withdraw rewards)", async () => {
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
    dexCoreStorage.storage.cycle_duration = new BigNumber(1);
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

  it("should fail if not dex core is trying to withdraw rewards", async () => {
    const params: WithdrawRewards = {
      receiver: alice.pkh,
      user: alice.pkh,
      current_balance: new BigNumber(0),
      new_balance: new BigNumber(0),
    };

    await rejects(tezStore.withdrawRewards(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  // it("should withdraw user's rewards - 1", async () => {
  //   const params: WithdrawProfit = {
  //     receiver: bob.pkh,
  //     pair_id: new BigNumber(0),
  //   };

  //   await tezStore.default(100);
  //   await utils.bakeBlocks(5);
  //   await tezStore.default(300);
  //   await tezStore.updateStorage({
  //     users_rewards: [alice.pkh],
  //   });

  //   console.log(tezStore.storage.users_rewards[alice.pkh].reward.toFixed());
  //   console.log(
  //     tezStore.storage.users_rewards[alice.pkh].reward_paid.toFixed()
  //   );
  //   console.log((await utils.tezos.tz.getBalance(bob.pkh)).toFixed());

  //   await dexCore.withdrawProfit(params);
  //   await tezStore.updateStorage({
  //     users_rewards: [alice.pkh],
  //   });

  //   console.log(tezStore.storage.users_rewards[alice.pkh].reward.toFixed());
  //   console.log(
  //     tezStore.storage.users_rewards[alice.pkh].reward_paid.toFixed()
  //   );
  //   console.log((await utils.tezos.tz.getBalance(bob.pkh)).toFixed());
  // });
});
