import { Common, Bucket as BucketErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { Bucket } from "../../helpers/Bucket";
import { Utils } from "../../helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { bucketStorage } from "../../../storage/test/Bucket";

import { BanBaker, PourOut } from "../../types/Bucket";
import { SBAccount } from "../../types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("Bucket (fill, pour out, ban baker)", async () => {
  var bakerRegistry: BakerRegistry;
  var bucket: Bucket;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;
  var carol: SBAccount = accounts.carol;
  var dev: SBAccount = accounts.dev;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    bucketStorage.baker_registry = bakerRegistry.contract.address;
    bucketStorage.dex_core = bob.pkh;

    bucket = await Bucket.originate(utils.tezos, bucketStorage);
  });

  it("should fail if not dex core is trying to fill", async () => {
    await rejects(bucket.fill(alice.pkh, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should fill - 1", async () => {
    const user: string = alice.pkh;
    const amt: number = 100;

    await utils.setProvider(bob.sk);
    await bucket.fill(user, amt);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(new BigNumber(amt));
  });

  it("should fill - 2", async () => {
    const user: string = carol.pkh;
    const amt: number = 666;
    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );

    await bucket.fill(user, amt);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(prevBucketTezBalance.plus(amt));
  });

  it("should fail if not dex core is trying to pour out", async () => {
    const pourOut: PourOut = {
      receiver: alice.pkh,
      amt: new BigNumber(100),
    };

    await utils.setProvider(alice.sk);
    await rejects(bucket.pourOut(pourOut), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should fail if bucket have not enough TEZ on contract's balance", async () => {
    const pourOut: PourOut = {
      receiver: alice.pkh,
      amt: new BigNumber(100_000),
    };

    await utils.setProvider(bob.sk);
    await rejects(bucket.pourOut(pourOut), (err: Error) => {
      expect(err.message).to.equal(BucketErrors.ERR_INSUFFICIENT_TEZ_BALANCE);

      return true;
    });
  });

  it("should pour out - 1", async () => {
    const pourOut: PourOut = {
      receiver: alice.pkh,
      amt: new BigNumber(100),
    };
    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      pourOut.receiver
    );

    await bucket.pourOut(pourOut);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(prevBucketTezBalance.minus(pourOut.amt));
    expect(
      await utils.tezos.tz.getBalance(pourOut.receiver)
    ).to.be.bignumber.equal(prevRecipientTezBalance.plus(pourOut.amt));
  });

  it("should pour out - 2", async () => {
    const pourOut: PourOut = {
      receiver: dev.pkh,
      amt: new BigNumber(666),
    };

    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      pourOut.receiver
    );

    await bucket.pourOut(pourOut);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(prevBucketTezBalance.minus(pourOut.amt));
    expect(
      await utils.tezos.tz.getBalance(pourOut.receiver)
    ).to.be.bignumber.equal(prevRecipientTezBalance.plus(pourOut.amt));
  });

  it("should fail if not dex core is trying to ban baker", async () => {
    const banBaker: BanBaker = {
      baker: alice.pkh,
      ban_period: new BigNumber(666),
    };

    await utils.setProvider(alice.sk);
    await rejects(bucket.banBaker(banBaker), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should ban baker", async () => {
    const banBaker: BanBaker = {
      baker: alice.pkh,
      ban_period: new BigNumber(666),
    };

    await utils.setProvider(bob.sk);
    await bucket.banBaker(banBaker);
    await bucket.updateStorage({ bakers: [alice.pkh] });

    expect(bucket.storage.bakers[alice.pkh].ban_period).to.be.bignumber.equal(
      banBaker.ban_period
    );
    expect(
      Date.parse(bucket.storage.bakers[alice.pkh].ban_start_time)
    ).to.be.lte(await utils.getLastBlockTimestamp());
  });

  it("should unban baker", async () => {
    const banBaker: BanBaker = {
      baker: alice.pkh,
      ban_period: new BigNumber(0),
    };

    await bucket.banBaker(banBaker);
    await bucket.updateStorage({ bakers: [alice.pkh] });

    expect(bucket.storage.bakers[alice.pkh].ban_period).to.be.bignumber.equal(
      banBaker.ban_period
    );
    expect(
      Date.parse(bucket.storage.bakers[alice.pkh].ban_start_time)
    ).to.be.lte(await utils.getLastBlockTimestamp());
  });
});
