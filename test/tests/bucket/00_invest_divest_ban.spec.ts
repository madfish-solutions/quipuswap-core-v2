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

import { BanBaker, DivestTez } from "../../types/Bucket";
import { SBAccount } from "../../types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("Bucket (invest TEZ, divest TEZ, ban baker)", async () => {
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

  it("should fail if not dex core is trying to invest tez", async () => {
    await rejects(bucket.investTez(alice.pkh, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should invest tez - 1", async () => {
    const user: string = alice.pkh;
    const amt: number = 100;

    await utils.setProvider(bob.sk);
    await bucket.investTez(user, amt);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(new BigNumber(amt));
  });

  it("should invest tez - 2", async () => {
    const user: string = carol.pkh;
    const amt: number = 666;
    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );

    await bucket.investTez(user, amt);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(prevBucketTezBalance.plus(amt));
  });

  it("should fail if not dex core is trying to divest tez", async () => {
    const divestTez: DivestTez = {
      receiver: alice.pkh,
      amt: new BigNumber(100),
    };

    await utils.setProvider(alice.sk);
    await rejects(bucket.divestTez(divestTez), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should fail if tez store have not enough TEZ on contract's balance", async () => {
    const divestTez: DivestTez = {
      receiver: alice.pkh,
      amt: new BigNumber(100_000),
    };

    await utils.setProvider(bob.sk);
    await rejects(bucket.divestTez(divestTez), (err: Error) => {
      expect(err.message).to.equal(BucketErrors.ERR_INSUFFICIENT_TEZ_BALANCE);

      return true;
    });
  });

  it("should divest tez - 1", async () => {
    const divestTez: DivestTez = {
      receiver: alice.pkh,
      amt: new BigNumber(100),
    };
    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      divestTez.receiver
    );

    await bucket.divestTez(divestTez);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(prevBucketTezBalance.minus(divestTez.amt));
    expect(
      await utils.tezos.tz.getBalance(divestTez.receiver)
    ).to.be.bignumber.equal(prevRecipientTezBalance.plus(divestTez.amt));
  });

  it("should divest tez - 2", async () => {
    const divestTez: DivestTez = {
      receiver: dev.pkh,
      amt: new BigNumber(666),
    };

    const prevBucketTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      bucket.contract.address
    );
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      divestTez.receiver
    );

    await bucket.divestTez(divestTez);

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(prevBucketTezBalance.minus(divestTez.amt));
    expect(
      await utils.tezos.tz.getBalance(divestTez.receiver)
    ).to.be.bignumber.equal(prevRecipientTezBalance.plus(divestTez.amt));
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
