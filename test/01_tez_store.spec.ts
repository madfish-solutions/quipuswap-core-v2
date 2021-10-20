import { TezStore as TezStoreErrors } from "./helpers/Errors";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { TezStore } from "./helpers/TezStore";
import { Utils } from "./helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import { alice, bob } from "../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { tezStoreStorage } from "../storage/test/TezStore";

import { BanBaker } from "./types/TezStore";

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

  it("should fail if not dex core is trying to ban baker", async () => {
    const banBaker: BanBaker = {
      baker: alice.pkh,
      ban_period: new BigNumber(666),
    };

    await rejects(tezStore.banBaker(banBaker), (err: Error) => {
      expect(err.message).to.equal(TezStoreErrors.ERR_NOT_DEX_CORE);

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
      String(Date.parse(tezStore.storage.bakers[alice.pkh].ban_start_time))
    ).to.equal(await utils.getLastBlockTimestamp());
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
      String(Date.parse(tezStore.storage.bakers[alice.pkh].ban_start_time))
    ).to.equal(await utils.getLastBlockTimestamp());
  });
});
