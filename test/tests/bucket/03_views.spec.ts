import { MichelsonMap } from "@taquito/michelson-encoder";

import { BakerRegistry } from "../../helpers/BakerRegistry";
import { Utils, zeroAddress } from "../../helpers/Utils";
import { DexCore } from "../../helpers/DexCore";
import { Bucket } from "../../helpers/Bucket";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { bucketStorage } from "../../../storage/test/Bucket";
import { dexCoreStorage } from "../../../storage/DexCore";

import { BanBaker, PourOut } from "../../types/Bucket";
import { SBAccount } from "../../types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("Bucket (views)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;
  var bucket: Bucket;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;
  var carol: SBAccount = accounts.carol;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage,
    );

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    bucketStorage.baker_registry = bakerRegistry.contract.address;
    bucketStorage.dex_core = bob.pkh;

    bucket = await Bucket.originate(utils.tezos, bucketStorage);
  });

  it("should return false if baker is not banned", async () => {
    const isBannedAlice: Promise<any> = await bucket.contract.contractViews
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
    await bucket.banBaker(banBaker);

    const isBannedAlice: Promise<any> = await bucket.contract.contractViews
      .is_banned_baker(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(isBannedAlice).to.be.true;
  });

  it("should return false if baker's banning period is finished", async () => {
    await utils.bakeBlocks(4);

    const isBannedAlice: Promise<any> = await bucket.contract.contractViews
      .is_banned_baker(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(isBannedAlice).to.be.false;
  });

  it("should return zero balance", async () => {
    bucket = await Bucket.updateContractInstance(
      bucket.contract.address,
      utils.tezos,
    );

    const balance: Promise<any> = await bucket.contract.contractViews
      .get_tez_balance()
      .executeView({ viewCaller: alice.pkh });

    expect(balance).to.be.bignumber.equal(0);
  });

  it("should return positive balance - 1", async () => {
    const user: string = bob.pkh;
    const mutezAmount: number = 500;

    await bucket.fill(mutezAmount);

    bucket = await Bucket.updateContractInstance(
      bucket.contract.address,
      utils.tezos,
    );

    const balance: Promise<any> = await bucket.contract.contractViews
      .get_tez_balance()
      .executeView({ viewCaller: alice.pkh });

    expect(balance).to.be.bignumber.equal(new BigNumber(mutezAmount));
  });

  it("should return positive balance - 2", async () => {
    const pourOut: PourOut = {
      receiver: bob.pkh,
      amt: new BigNumber(100),
    };

    await bucket.pourOut(pourOut);

    bucket = await Bucket.updateContractInstance(
      bucket.contract.address,
      utils.tezos,
    );

    const balance: Promise<any> = await bucket.contract.contractViews
      .get_tez_balance()
      .executeView({ viewCaller: alice.pkh });

    expect(balance).to.be.bignumber.equal(new BigNumber(400));
  });

  it("should return zero_key_hash if contract does not have a delegate", async () => {
    const candidate: Promise<any> = await bucket.contract.contractViews
      .get_user_candidate(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(candidate).to.be.equal(zeroAddress);
  });

  it("should return current delegated if user does not have a candidate", async () => {
    bucketStorage.current_delegated = bob.pkh;

    bucket = await Bucket.originate(utils.tezos, bucketStorage);

    const candidate: Promise<any> = await bucket.contract.contractViews
      .get_user_candidate(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(candidate).to.be.equal(bucketStorage.current_delegated);
  });

  it("should return user's candidate is user have a candidate", async () => {
    bucketStorage.users = MichelsonMap.fromLiteral({
      [alice.pkh]: {
        candidate: carol.pkh,
        votes: new BigNumber(1),
      },
    });

    bucket = await Bucket.originate(utils.tezos, bucketStorage);

    const candidate: Promise<any> = await bucket.contract.contractViews
      .get_user_candidate(alice.pkh)
      .executeView({ viewCaller: alice.pkh });

    expect(candidate).to.be.equal(carol.pkh);
  });
});
