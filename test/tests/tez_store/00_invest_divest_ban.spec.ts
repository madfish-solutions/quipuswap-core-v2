import { Common, TezStore as TezStoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { TezStore } from "../../helpers/TezStore";
import { Utils } from "../../helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { tezStoreStorage } from "../../../storage/test/TezStore";

import { BanBaker, DivestTez } from "../../types/TezStore";
import { SBAccount } from "../../types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("TezStore (invest TEZ, divest TEZ, ban baker)", async () => {
  var bakerRegistry: BakerRegistry;
  var tezStore: TezStore;
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

  it("should invest tez - 1", async () => {
    const user: string = alice.pkh;
    const amt: number = 100;

    await utils.setProvider(bob.sk);
    await tezStore.investTez(user, amt);

    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(new BigNumber(amt));
  });

  it("should invest tez - 2", async () => {
    const user: string = carol.pkh;
    const amt: number = 666;
    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );

    await tezStore.investTez(user, amt);

    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(prevTezStoreTezBalance.plus(amt));
  });

  it("should fail if not dex core is trying to divest tez", async () => {
    const divestTez: DivestTez = {
      receiver: alice.pkh,
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
      amt: new BigNumber(100_000),
    };

    await utils.setProvider(bob.sk);
    await rejects(tezStore.divestTez(divestTez), (err: Error) => {
      expect(err.message).to.equal(TezStoreErrors.ERR_INSUFFICIENT_TEZ_BALANCE);

      return true;
    });
  });

  it("should divest tez - 1", async () => {
    const divestTez: DivestTez = {
      receiver: alice.pkh,
      amt: new BigNumber(100),
    };
    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      divestTez.receiver
    );

    await tezStore.divestTez(divestTez);

    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(prevTezStoreTezBalance.minus(divestTez.amt));
    expect(
      await utils.tezos.tz.getBalance(divestTez.receiver)
    ).to.be.bignumber.equal(prevRecipientTezBalance.plus(divestTez.amt));
  });

  it("should divest tez - 2", async () => {
    const divestTez: DivestTez = {
      receiver: dev.pkh,
      amt: new BigNumber(666),
    };

    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      divestTez.receiver
    );

    await tezStore.divestTez(divestTez);

    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(prevTezStoreTezBalance.minus(divestTez.amt));
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
});
