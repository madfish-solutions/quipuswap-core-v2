import { TransactionOperation } from "@taquito/taquito";

import { defaultCollectingPeriod, Utils } from "../../helpers/Utils";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { DexCore } from "../../helpers/DexCore";
import { FA12 } from "../../helpers/FA12";
import {
  FA2 as FA2Errors,
  Permits as PermitsErrors,
} from "../../helpers/Errors";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { confirmOperation } from "../../../scripts/confirmation";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";

import { SBAccount } from "test/types/Common";
import { Transfer } from "test/types/FA2";
import {
  DexCoreStorage,
  LaunchExchange,
  UserPermits,
  Permit,
} from "test/types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (permits)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var utils: Utils;

  var hash: string;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;
  var carol: SBAccount = accounts.carol;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = defaultCollectingPeriod;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;
    dexCoreStorage.storage.default_expiry = new BigNumber(10000);

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    fa12Token1 = await FA12.originate(utils.tezos, fa12Storage);

    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(1000),
      token_b_in: new BigNumber(1000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, params.token_a_in);
    await dexCore.launchExchange(params, params.token_b_in.toNumber());

    const transferOperation: TransactionOperation =
      await utils.tezos.contract.transfer({
        to: carol.pkh,
        amount: 50_000_000,
        mutez: true,
      });

    await confirmOperation(utils.tezos, transferOperation.hash);
  });

  it(`alice generates permit payload, bob submits it to the contract`, async () => {
    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(10),
          },
        ],
      },
    ];
    const [signerKey, signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await utils.init(alice.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );

    hash = permitHash;

    await dexCore.permit(signerKey, signature, permitHash);

    const storage: DexCoreStorage = await dexCore.contract.storage();
    const userPermits: UserPermits = await storage.storage.permits.get(
      alice.pkh
    );

    expect(userPermits.permits.has(hash)).to.be.true;
  });

  it(`carol calls transfer on alice's behalf`, async () => {
    dexCore = await DexCore.init(
      dexCore.contract.address,
      await utils.init(carol.sk)
    );

    let storage: DexCoreStorage = await dexCore.contract.storage();
    let userPermits: UserPermits = await storage.storage.permits.get(alice.pkh);

    expect(userPermits.permits.has(hash)).to.be.true;

    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(10),
          },
        ],
      },
    ];

    await dexCore.transfer(transferParams);

    storage = await dexCore.contract.storage();
    userPermits = await storage.storage.permits.get(alice.pkh);

    expect(userPermits.permits.has(hash)).to.be.false;
  });

  it(`carol can't use bob's transfer anymore`, async () => {
    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(10),
          },
        ],
      },
    ];

    await rejects(
      dexCore.contract.methods.transfer(transferParams).send(),
      (err: Error) => {
        expect(err.message).to.equal(FA2Errors.FA2_NOT_OPERATOR);

        return true;
      }
    );
  });

  it(`alice generates permit, bob submits it, alice sets expiry`, async () => {
    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(15),
          },
        ],
      },
    ];
    const [signerKey, signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await utils.init(alice.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );

    await dexCore.permit(signerKey, signature, permitHash);

    dexCore = await DexCore.init(
      dexCore.contract.address,
      await utils.init(alice.sk)
    );

    await dexCore.setExpiry({
      issuer: alice.pkh,
      expiry: new BigNumber(5),
      permit_hash: permitHash,
    });

    const storage: DexCoreStorage = await dexCore.contract.storage();
    const userPermits: UserPermits = await storage.storage.permits.get(
      alice.pkh
    );

    expect(userPermits.permits.has(permitHash)).to.be.true;

    const permit: Permit = await userPermits.permits.get(permitHash);

    expect(permit.expiry).to.be.bignumber.equal(new BigNumber(5));
  });

  it(`carol calls transfer on alice's behalf too late`, async () => {
    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(15),
          },
        ],
      },
    ];

    dexCore = await DexCore.init(
      dexCore.contract.address,
      await utils.init(carol.sk)
    );

    await utils.bakeBlocks(5);
    await rejects(
      dexCore.contract.methods.transfer(transferParams).send(),
      (err: Error) => {
        expect(err.message).to.equal(PermitsErrors.EXPIRED_PERMIT);

        return true;
      }
    );
  });
});
