import { Common, TezStore as TezStoreErrors } from "./helpers/Errors";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { TezStore } from "./helpers/TezStore";
import { Utils } from "./helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import { alice, bob, carol, dev } from "../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { tezStoreStorage } from "../storage/test/TezStore";

import { BanBaker, DivestTez } from "./types/TezStore";

chai.use(require("chai-bignumber")(BigNumber));

describe("TezStore tests", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;
  var tezStore: TezStore;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    tezStoreStorage.baker_registry = bakerRegistry.contract.address;
    tezStoreStorage.dex_core = bob.pkh;

    tezStore = await TezStore.originate(utils.tezos, tezStoreStorage);
  });

  it("should fail if not dex core is trying to invest tez", async () => {
    await rejects(tezStore.investTez(alice.pkh, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should invest tez for alice", async () => {
    const user: string = alice.pkh;
    const amt: number = 100;

    await utils.setProvider(bob.sk);
    await tezStore.investTez(user, amt);
    await tezStore.updateStorage({ users: [user] });

    expect(tezStore.storage.users[user].tez_bal).to.be.bignumber.equal(amt);
    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(new BigNumber(amt));
  });

  it("should invest tez for carol - 1", async () => {
    const user: string = carol.pkh;
    const amt: number = 666;
    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );

    await tezStore.investTez(user, amt);
    await tezStore.updateStorage({ users: [user] });

    expect(tezStore.storage.users[user].tez_bal).to.be.bignumber.equal(amt);
    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(prevTezStoreTezBalance.plus(amt));
  });

  it("should invest tez for carol - 2", async () => {
    const user: string = carol.pkh;
    const amt: number = 13;
    const prevAmt: BigNumber = tezStore.storage.users[user].tez_bal;
    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );

    await tezStore.investTez(user, amt);
    await tezStore.updateStorage({ users: [user] });

    expect(tezStore.storage.users[user].tez_bal).to.be.bignumber.equal(
      prevAmt.plus(amt)
    );
    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(prevTezStoreTezBalance.plus(amt));
  });

  it("should fail if not dex core is trying to divest tez", async () => {
    const divestTez: DivestTez = {
      receiver: alice.pkh,
      user: alice.pkh,
      amt: new BigNumber(100),
    };

    await utils.setProvider(alice.sk);
    await rejects(tezStore.divestTez(divestTez), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should fail if tez store have not enough TEZ on contract's balance", async () => {
    const divestTez: DivestTez = {
      receiver: alice.pkh,
      user: alice.pkh,
      amt: new BigNumber(100_000),
    };

    await utils.setProvider(bob.sk);
    await rejects(tezStore.divestTez(divestTez), (err: Error) => {
      expect(err.message).to.equal(TezStoreErrors.ERR_INSUFFICIENT_TEZ_BALANCE);

      return true;
    });
  });

  it("should fail if user have not enough TEZ on his contract's balance", async () => {
    const user: string = alice.pkh;

    await tezStore.updateStorage({ users: [user] });

    const divestTez: DivestTez = {
      receiver: alice.pkh,
      user: user,
      amt: tezStore.storage.users[user].tez_bal.plus(1),
    };

    await rejects(tezStore.divestTez(divestTez), (err: Error) => {
      expect(err.message).to.equal(TezStoreErrors.ERR_INSUFFICIENT_TEZ_BALANCE);

      return true;
    });
  });

  it("should divest tez for alice", async () => {
    const user: string = alice.pkh;
    const divestTez: DivestTez = {
      receiver: alice.pkh,
      user: user,
      amt: tezStore.storage.users[user].tez_bal,
    };
    const prevAmt: BigNumber = tezStore.storage.users[user].tez_bal;
    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      divestTez.receiver
    );

    await tezStore.divestTez(divestTez);
    await tezStore.updateStorage({ users: [user] });

    expect(tezStore.storage.users[user].tez_bal).to.be.bignumber.equal(
      prevAmt.minus(divestTez.amt)
    );
    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(prevTezStoreTezBalance.minus(divestTez.amt));
    expect(
      await utils.tezos.tz.getBalance(divestTez.receiver)
    ).to.be.bignumber.equal(prevRecipientTezBalance.plus(divestTez.amt));
  });

  it("should divest tez for carol - 1", async () => {
    const user: string = carol.pkh;
    const divestTez: DivestTez = {
      receiver: dev.pkh,
      user: user,
      amt: new BigNumber(666),
    };

    await tezStore.updateStorage({ users: [user] });

    const prevAmt: BigNumber = tezStore.storage.users[user].tez_bal;
    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      divestTez.receiver
    );

    await tezStore.divestTez(divestTez);
    await tezStore.updateStorage({ users: [user] });

    expect(tezStore.storage.users[user].tez_bal).to.be.bignumber.equal(
      prevAmt.minus(divestTez.amt)
    );
    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(prevTezStoreTezBalance.minus(divestTez.amt));
    expect(
      await utils.tezos.tz.getBalance(divestTez.receiver)
    ).to.be.bignumber.equal(prevRecipientTezBalance.plus(divestTez.amt));
  });

  it("should divest tez for carol - 2", async () => {
    const user: string = carol.pkh;
    const divestTez: DivestTez = {
      receiver: carol.pkh,
      user: user,
      amt: tezStore.storage.users[user].tez_bal,
    };
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      divestTez.receiver
    );

    await tezStore.divestTez(divestTez);
    await tezStore.updateStorage({ users: [user] });

    expect(tezStore.storage.users[user].tez_bal).to.be.bignumber.equal(0);
    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(0);
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
    await rejects(tezStore.banBaker(banBaker), (err: Error) => {
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
    await tezStore.banBaker(banBaker);
    await tezStore.updateStorage({ bakers: [alice.pkh] });

    expect(tezStore.storage.bakers[alice.pkh].ban_period).to.be.bignumber.equal(
      banBaker.ban_period
    );
    expect(
      Date.parse(tezStore.storage.bakers[alice.pkh].ban_start_time)
    ).to.be.lte(await utils.getLastBlockTimestamp());
  });

  it("should unban baker", async () => {
    const banBaker: BanBaker = {
      baker: alice.pkh,
      ban_period: new BigNumber(0),
    };

    await tezStore.banBaker(banBaker);
    await tezStore.updateStorage({ bakers: [alice.pkh] });

    expect(tezStore.storage.bakers[alice.pkh].ban_period).to.be.bignumber.equal(
      banBaker.ban_period
    );
    expect(
      Date.parse(tezStore.storage.bakers[alice.pkh].ban_start_time)
    ).to.be.lte(await utils.getLastBlockTimestamp());
  });

  // it("should return false if baker is not banned", async () => {
  //   const isBannedAlice: Promise<any> = await tezStore.contract.views
  //     .is_banned_baker(alice.pkh)
  //     .read(lambdaContract.address);

  //   expect(isBannedAlice).to.be.false;
  // });

  // it("should return true if baker is banned", async () => {
  //   const banBaker: BanBaker = {
  //     baker: alice.pkh,
  //     ban_period: new BigNumber(5),
  //   };

  //   await tezStore.banBaker(banBaker);

  //   const isBannedAlice: Promise<any> = await tezStore.contract.views
  //     .is_banned_baker(alice.pkh)
  //     .read(lambdaContract.address);

  //   expect(isBannedAlice).to.be.true;
  // });

  // it("should return false if baker's banning period is finished", async () => {
  //   await utils.bakeBlocks(4);

  //   const isBannedAlice: Promise<any> = await tezStore.contract.views
  //     .is_banned_baker(alice.pkh)
  //     .read(lambdaContract.address);

  //   expect(isBannedAlice).to.be.false;
  // });
});
