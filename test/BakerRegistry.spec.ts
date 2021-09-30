import { Utils, zeroAddress } from "./helpers/Utils";
import { BakerRegistry } from "./helpers/BakerRegistry";

import { rejects, ok, strictEqual } from "assert";

import { alice, bob } from "../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../storage/BakerRegistry";

describe("BakerRegistry tests", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;

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
          "(permanent) proto.010-PtGRANAD.contract.manager.unregistered_delegate"
      );

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
          "(permanent) proto.010-PtGRANAD.contract.manager.unregistered_delegate"
      );

      return true;
    });
  });
});
