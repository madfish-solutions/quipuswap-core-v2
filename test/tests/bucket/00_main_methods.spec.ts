import { BakerRegistry } from "../../helpers/BakerRegistry";
import { Common } from "../../helpers/Errors";
import { Bucket } from "../../helpers/Bucket";
import { Utils } from "../../helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { bucketStorage } from "../../../storage/test/Bucket";

import { BanBaker, PourOut, PourOver } from "../../types/Bucket";
import { SBAccount } from "../../types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("Bucket (fill, pour out, pour over, ban baker)", async () => {
  var bakerRegistry: BakerRegistry;
  var bucket: Bucket;
  var bucket2: Bucket;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;
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
    bucket2 = await Bucket.originate(utils.tezos, bucketStorage);
  });

  it("should fill - 1", async () => {
    const amt: number = 100;

    await utils.setProvider(bob.sk);
    await bucket.fill(amt);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(new BigNumber(amt));
  });

  it("should fill - 2", async () => {
    const amt: number = 666;
    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );

    await bucket.fill(amt);

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

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const pourOut: PourOut = {
      receiver: alice.pkh,
      amt: new BigNumber(100),
    };

    await utils.setProvider(bob.sk);
    await rejects(bucket.pourOut(pourOut, 1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should fail if bucket have not enough TEZ on contract's balance", async () => {
    const pourOut: PourOut = {
      receiver: alice.pkh,
      amt: new BigNumber(100_000),
    };

    await rejects(bucket.pourOut(pourOut), (err: Error) => {
      expect(err.message).to.equal(
        "(temporary) proto.011-PtHangz2.contract.balance_too_low"
      );

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

  it("should fail if not dex core is trying to pour over", async () => {
    const pourOver: PourOver = {
      bucket: alice.pkh,
      amt: new BigNumber(100),
    };

    await utils.setProvider(alice.sk);
    await rejects(bucket.pourOver(pourOver), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const pourOver: PourOver = {
      bucket: alice.pkh,
      amt: new BigNumber(100),
    };

    await utils.setProvider(bob.sk);
    await rejects(bucket.pourOver(pourOver, 1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should fail if `fill` entrypoint of a receiver not found", async () => {
    const pourOver: PourOver = {
      bucket: alice.pkh,
      amt: new BigNumber(100),
    };

    await rejects(bucket.pourOver(pourOver), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_BUCKET_FILL_ENTRYPOINT_404);

      return true;
    });
  });

  it("should fail if bucket have not enough TEZ on contract's balance", async () => {
    const pourOver: PourOver = {
      bucket: bucket2.contract.address,
      amt: new BigNumber(100_000),
    };

    await rejects(bucket.pourOver(pourOver), (err: Error) => {
      expect(err.message).to.equal(
        "(temporary) proto.011-PtHangz2.contract.balance_too_low"
      );

      return true;
    });
  });

  it("should pour over - 1", async () => {
    const pourOver: PourOver = {
      bucket: bucket2.contract.address,
      amt: new BigNumber(100),
    };

    await bucket.fill(1000);

    const prevBucket1TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevBucket2TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      pourOver.bucket
    );

    await bucket.pourOver(pourOver);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(prevBucket1TezBalance.minus(pourOver.amt));
    expect(
      await utils.tezos.tz.getBalance(pourOver.bucket)
    ).to.be.bignumber.equal(prevBucket2TezBalance.plus(pourOver.amt));
  });

  it("should pour over - 2", async () => {
    const pourOver: PourOver = {
      bucket: bucket2.contract.address,
      amt: new BigNumber(900),
    };

    const prevBucket1TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevBucket2TezBalance: BigNumber = await utils.tezos.tz.getBalance(
      pourOver.bucket
    );

    await bucket.pourOver(pourOver);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(prevBucket1TezBalance.minus(pourOver.amt));
    expect(
      await utils.tezos.tz.getBalance(pourOver.bucket)
    ).to.be.bignumber.equal(prevBucket2TezBalance.plus(pourOver.amt));
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

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const banBaker: BanBaker = {
      baker: alice.pkh,
      ban_period: new BigNumber(666),
    };

    await utils.setProvider(bob.sk);
    await rejects(bucket.banBaker(banBaker, 1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should ban baker", async () => {
    const banBaker: BanBaker = {
      baker: alice.pkh,
      ban_period: new BigNumber(666),
    };

    await bucket.banBaker(banBaker);
    await bucket.updateStorage({ bakers: [alice.pkh] });

    const tezos_now = await utils.getLastBlockTimestamp() + 1000

    expect(Date.parse(bucket.storage.bakers[alice.pkh].ban_end_time)).to.be.bignumber.lte(
      banBaker.ban_period.multipliedBy(1000).plus(tezos_now)
    );
  });

  it("should unban baker", async () => {
    const banBaker: BanBaker = {
      baker: alice.pkh,
      ban_period: new BigNumber(0),
    };

    await bucket.banBaker(banBaker);
    await bucket.updateStorage({ bakers: [alice.pkh] });

    const tezos_now = await utils.getLastBlockTimestamp()

    expect(Date.parse(bucket.storage.bakers[alice.pkh].ban_end_time)).to.be.bignumber.lte(
      tezos_now
    );
  });
});
