import { Common, TezStore as TezStoreErrors } from "./helpers/Errors";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { TezStore } from "./helpers/TezStore";
import { Utils } from "./helpers/Utils";

import { rejects } from "assert";

import { Contract, OriginationOperation, VIEW_LAMBDA } from "@taquito/taquito";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import { alice, bob, carol, dev } from "../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { tezStoreStorage } from "../storage/test/TezStore";

import { BanBaker, DivestTez, InvestTez } from "./types/TezStore";

chai.use(require("chai-bignumber")(BigNumber));

describe("TezStore tests", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;
  var tezStore: TezStore;
  var lambdaContract: Contract;

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

    const operation: OriginationOperation =
      await utils.tezos.contract.originate({
        code: VIEW_LAMBDA.code,
        storage: VIEW_LAMBDA.storage,
      });

    lambdaContract = await operation.contract();
  });

  it("should fail if not dex core is trying to invest tez", async () => {
    const investTez: InvestTez = {
      user: alice.pkh,
      total_supply: new BigNumber(1),
    };

    await rejects(tezStore.investTez(investTez, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should invest tez for alice", async () => {
    const voter: string = alice.pkh;
    const amt: number = 100;
    const investTez: InvestTez = {
      user: voter,
      total_supply: new BigNumber(amt),
    };

    await utils.setProvider(bob.sk);
    await tezStore.investTez(investTez, amt);
    await tezStore.updateStorage({ voters: [voter] });

    expect(tezStore.storage.voters[voter].tez_bal).to.be.bignumber.equal(amt);
    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(new BigNumber(amt));
  });

  it("should invest tez for carol - 1", async () => {
    const voter: string = carol.pkh;
    const amt: number = 666;
    const investTez: InvestTez = {
      user: voter,
      total_supply: new BigNumber(amt),
    };
    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );

    await tezStore.investTez(investTez, amt);
    await tezStore.updateStorage({ voters: [voter] });

    expect(tezStore.storage.voters[voter].tez_bal).to.be.bignumber.equal(amt);
    expect(
      await utils.tezos.tz.getBalance(tezStore.contract.address)
    ).to.be.bignumber.equal(prevTezStoreTezBalance.plus(amt));
  });

  it("should invest tez for carol - 2", async () => {
    const voter: string = carol.pkh;
    const amt: number = 13;
    const investTez: InvestTez = {
      user: voter,
      total_supply: new BigNumber(amt),
    };
    const prevAmt: BigNumber = tezStore.storage.voters[voter].tez_bal;
    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );

    await tezStore.investTez(investTez, amt);
    await tezStore.updateStorage({ voters: [voter] });

    expect(tezStore.storage.voters[voter].tez_bal).to.be.bignumber.equal(
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
      total_supply: new BigNumber(100),
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
      total_supply: new BigNumber(100_000),
    };

    await utils.setProvider(bob.sk);
    await rejects(tezStore.divestTez(divestTez), (err: Error) => {
      expect(err.message).to.equal(TezStoreErrors.ERR_INSUFFICIENT_TEZ_BALANCE);

      return true;
    });
  });

  it("should fail if voter have not enough TEZ on his contract's balance", async () => {
    const user: string = alice.pkh;

    await tezStore.updateStorage({ voters: [user] });

    const divestTez: DivestTez = {
      receiver: alice.pkh,
      user: user,
      amt: tezStore.storage.voters[user].tez_bal.plus(1),
      total_supply: new BigNumber(
        tezStore.storage.voters[user].tez_bal.plus(1)
      ),
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
      amt: tezStore.storage.voters[user].tez_bal,
      total_supply: new BigNumber(tezStore.storage.voters[user].tez_bal),
    };
    const prevAmt: BigNumber = tezStore.storage.voters[user].tez_bal;
    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      divestTez.receiver
    );

    await tezStore.divestTez(divestTez);
    await tezStore.updateStorage({ voters: [user] });

    expect(tezStore.storage.voters[user].tez_bal).to.be.bignumber.equal(
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
      total_supply: new BigNumber(666),
    };

    await tezStore.updateStorage({ voters: [user] });

    const prevAmt: BigNumber = tezStore.storage.voters[user].tez_bal;
    const prevTezStoreTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      tezStore.contract.address
    );
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      divestTez.receiver
    );

    await tezStore.divestTez(divestTez);
    await tezStore.updateStorage({ voters: [user] });

    expect(tezStore.storage.voters[user].tez_bal).to.be.bignumber.equal(
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
      amt: tezStore.storage.voters[user].tez_bal,
      total_supply: new BigNumber(tezStore.storage.voters[user].tez_bal),
    };
    const prevRecipientTezBalance: BigNumber = await utils.tezos.tz.getBalance(
      divestTez.receiver
    );

    await tezStore.divestTez(divestTez);
    await tezStore.updateStorage({ voters: [user] });

    expect(tezStore.storage.voters[user].tez_bal).to.be.bignumber.equal(0);
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
