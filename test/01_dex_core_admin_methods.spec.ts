import { Utils, zeroAddress } from "./helpers/Utils";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { DexCore } from "./helpers/DexCore";
import { Common } from "./helpers/Errors";

import { rejects, ok, strictEqual } from "assert";

import { alice, bob } from "../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { dexCoreStorage } from "../storage/DexCore";

describe("DexCore tests (admin's methods)", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    dexCoreStorage.storage.admin = alice.pkh;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();
  });

  it("should fail if not admin is trying to setup new pending admin", async () => {
    await utils.setProvider(bob.sk);
    await rejects(dexCore.setAdmin(bob.pkh), (err: Error) => {
      ok(Number(err.message) === Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should setup new pending admin by admin", async () => {
    await utils.setProvider(alice.sk);
    await dexCore.setAdmin(bob.pkh);
    await dexCore.updateStorage();

    strictEqual(dexCore.storage.storage.admin, alice.pkh);
    strictEqual(dexCore.storage.storage.pending_admin, bob.pkh);
  });

  it("should fail if not pending admin is trying to confirm new admin", async () => {
    await rejects(dexCore.confirmAdmin(), (err: Error) => {
      ok(err.message === "Not-pending-admin");

      return true;
    });
  });

  it("should confirm new admin by pending admin", async () => {
    await utils.setProvider(bob.sk);
    await dexCore.confirmAdmin();
    await dexCore.updateStorage();

    strictEqual(dexCore.storage.storage.admin, bob.pkh);
    strictEqual(dexCore.storage.storage.pending_admin, zeroAddress);
  });
});
