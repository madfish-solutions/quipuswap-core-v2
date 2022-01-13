import { MichelsonMap } from "@taquito/michelson-encoder";

import { BakerRegistry } from "../../helpers/BakerRegistry";
import { Utils, zeroAddress } from "../../helpers/Utils";
import { TezStore } from "../../helpers/TezStore";
import { DexCore } from "../../helpers/DexCore";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { tezStoreStorage } from "../../../storage/test/TezStore";
import { dexCoreStorage } from "../../../storage/DexCore";

import { BanBaker, DivestTez } from "../../types/TezStore";
import { SBAccount } from "../../types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("TezStore (views)", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;
  var tezStore: TezStore;
  var dexCore: DexCore;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;
  var carol: SBAccount = accounts.carol;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    tezStoreStorage.baker_registry = bakerRegistry.contract.address;
    tezStoreStorage.dex_core = bob.pkh;

    tezStore = await TezStore.originate(utils.tezos, tezStoreStorage);
  });

  it("should return false if baker is not banned", async () => {
    const isBannedAlice: Promise<any> = await tezStore.contract.contractViews
      .is_banned_baker(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(isBannedAlice).to.be.false;
  });

  it("should return true if baker is banned", async () => {
    const banBaker: BanBaker = {
      baker: alice.pkh,
      ban_period: new BigNumber(5),
    };

    await utils.setProvider(bob.sk);
    await tezStore.banBaker(banBaker);

    const isBannedAlice: Promise<any> = await tezStore.contract.contractViews
      .is_banned_baker(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(isBannedAlice).to.be.true;
  });

  it("should return false if baker's banning period is finished", async () => {
    await utils.bakeBlocks(4);

    const isBannedAlice: Promise<any> = await tezStore.contract.contractViews
      .is_banned_baker(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(isBannedAlice).to.be.false;
  });

  it("should return zero balance", async () => {
    tezStore = await TezStore.updateContractInstance(
      tezStore.contract.address,
      utils.tezos
    );

    const balance: Promise<any> = await tezStore.contract.contractViews
      .get_tez_balance()
      .executeView({ viewCaller: alice.pkh });

    expect(balance).to.be.bignumber.equal(0);
  });

  it("should return positive balance - 1", async () => {
    const user: string = bob.pkh;
    const mutezAmount: number = 500;

    await tezStore.investTez(user, mutezAmount);

    tezStore = await TezStore.updateContractInstance(
      tezStore.contract.address,
      utils.tezos
    );

    const balance: Promise<any> = await tezStore.contract.contractViews
      .get_tez_balance()
      .executeView({ viewCaller: alice.pkh });

    expect(balance).to.be.bignumber.equal(new BigNumber(mutezAmount));
  });

  it("should return positive balance - 2", async () => {
    const divestTez: DivestTez = {
      receiver: bob.pkh,
      user: bob.pkh,
      amt: new BigNumber(100),
    };

    await tezStore.divestTez(divestTez);

    tezStore = await TezStore.updateContractInstance(
      tezStore.contract.address,
      utils.tezos
    );

    const balance: Promise<any> = await tezStore.contract.contractViews
      .get_tez_balance()
      .executeView({ viewCaller: alice.pkh });

    expect(balance).to.be.bignumber.equal(new BigNumber(400));
  });

  it("should return zero_key_hash if contract does not have a delegate", async () => {
    const candidate: Promise<any> = await tezStore.contract.contractViews
      .get_user_candidate(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(candidate).to.be.equal(zeroAddress);
  });

  it("should return current delegated if user does not have a candidate", async () => {
    tezStoreStorage.current_delegated = bob.pkh;

    tezStore = await TezStore.originate(utils.tezos, tezStoreStorage);

    const candidate: Promise<any> = await tezStore.contract.contractViews
      .get_user_candidate(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(candidate).to.be.equal(tezStoreStorage.current_delegated);
  });

  it("should return user's candidate is user have a candidate", async () => {
    tezStoreStorage.users = MichelsonMap.fromLiteral({
      [alice.pkh]: {
        candidate: carol.pkh,
        tez_bal: new BigNumber(1),
        votes: new BigNumber(1),
      },
    });

    tezStore = await TezStore.originate(utils.tezos, tezStoreStorage);

    const candidate: Promise<any> = await tezStore.contract.contractViews
      .get_user_candidate(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(candidate).to.be.equal(carol.pkh);
  });
});
