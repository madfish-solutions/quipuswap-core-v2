import { BakerRegistry } from "../../helpers/BakerRegistry";
import { Utils, zeroAddress } from "../../helpers/Utils";
import { Common } from "../../helpers/Errors";

import { rejects, ok, strictEqual } from "assert";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";

import { SBAccount } from "../../types/Common";

describe("BakerRegistry", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );
  });

  it("should register a new baker", async () => {
    await bakerRegistry.register(bob.pkh);
    await bakerRegistry.updateStorage([bob.pkh]);

    strictEqual(bakerRegistry.storage[bob.pkh], true);
  });

  it("should fail if address to register is not a baker", async () => {
    await rejects(bakerRegistry.register(zeroAddress), (err: Error) => {
      ok(
        err.message ===
          "(permanent) proto.013-PtJakart.contract.manager.unregistered_delegate"
      );

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await rejects(bakerRegistry.register(alice.pkh, 1), (err: Error) => {
      ok(err.message === Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should do nothing if baker is registered", async () => {
    await bakerRegistry.validate(bob.pkh);
    await bakerRegistry.updateStorage([bob.pkh]);

    strictEqual(bakerRegistry.storage[bob.pkh], true);
  });

  it("should register a new baker if baker is not registered", async () => {
    await bakerRegistry.validate(alice.pkh);
    await bakerRegistry.updateStorage([bob.pkh, alice.pkh]);

    strictEqual(bakerRegistry.storage[bob.pkh], true);
    strictEqual(bakerRegistry.storage[alice.pkh], true);
  });

  it("should fail if the baker is not registered and the address to register is not a baker", async () => {
    await rejects(bakerRegistry.validate(zeroAddress), (err: Error) => {
      ok(
        err.message ===
          "(permanent) proto.013-PtJakart.contract.manager.unregistered_delegate"
      );

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await rejects(bakerRegistry.validate(alice.pkh, 1), (err: Error) => {
      ok(err.message === Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });
});
