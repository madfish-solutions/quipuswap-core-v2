import { TransactionOperation } from "@taquito/taquito";

import { BakerRegistry } from "../../helpers/BakerRegistry";
import { DexCore } from "../../helpers/DexCore";
import { FA12 } from "../../helpers/FA12";
import {
  Permits as PermitsErrors,
  FA2 as FA2Errors,
} from "../../helpers/Errors";
import {
  defaulPermitExpiryLimit,
  defaultCollectingPeriod,
  Utils,
} from "../../helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { confirmOperation } from "../../../scripts/confirmation";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";

import { LaunchExchange, SetExpiry } from "../../types/DexCore";
import { SBAccount } from "../../types/Common";
import { Transfer } from "../../types/FA2";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (permits)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var utils: Utils;

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
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token1.approve(dexCore.contract.address, params.token_a_in);
    await dexCore.launchExchange(params, params.token_b_in.toNumber());
    await dexCore.transfer([
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(500),
          },
        ],
      },
    ]);

    const transferOperation: TransactionOperation =
      await utils.tezos.contract.transfer({
        to: carol.pkh,
        amount: 50_000_000,
        mutez: true,
      });

    await confirmOperation(utils.tezos, transferOperation.hash);
  });

  it(`should generate permit payload and submit it to the contract by alice - 1`, async () => {
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
        await Utils.createTezos(alice.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );

    await dexCore.permit(signerKey, signature, permitHash);
    await dexCore.updateStorage({
      permits: [alice.pkh],
    });

    expect(dexCore.storage.storage.permits_counter).to.be.bignumber.equal(
      new BigNumber(1)
    );
    expect(dexCore.storage.storage.permits[alice.pkh].permits.has(permitHash))
      .to.be.true;
    expect(dexCore.storage.storage.permits[alice.pkh].expiry).to.be.equal(null);
    expect(
      Date.parse(
        (
          await dexCore.storage.storage.permits[alice.pkh].permits.get(
            permitHash
          )
        ).created_at
      )
    ).to.be.lte(await utils.getLastBlockTimestamp());
    expect(
      (await dexCore.storage.storage.permits[alice.pkh].permits.get(permitHash))
        .expiry
    ).to.be.equal(null);
  });

  it(`should generate permit payload and submit it to the contract by alice - 2`, async () => {
    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(10),
          },
          {
            to_: carol.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(50),
          },
        ],
      },
    ];
    const [signerKey, signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(alice.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );

    await dexCore.permit(signerKey, signature, permitHash);
    await dexCore.updateStorage({
      permits: [alice.pkh],
    });

    expect(dexCore.storage.storage.permits_counter).to.be.bignumber.equal(
      new BigNumber(2)
    );
    expect(dexCore.storage.storage.permits[alice.pkh].permits.has(permitHash))
      .to.be.true;
    expect(dexCore.storage.storage.permits[alice.pkh].expiry).to.be.equal(null);
    expect(
      Date.parse(
        (
          await dexCore.storage.storage.permits[alice.pkh].permits.get(
            permitHash
          )
        ).created_at
      )
    ).to.be.lte(await utils.getLastBlockTimestamp());
    expect(
      (await dexCore.storage.storage.permits[alice.pkh].permits.get(permitHash))
        .expiry
    ).to.be.equal(null);
  });

  it(`should generate permit payload and submit it to the contract by bob`, async () => {
    const transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(50),
          },
        ],
      },
    ];
    const [signerKey, signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(bob.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );

    await utils.setProvider(bob.sk);
    await dexCore.permit(signerKey, signature, permitHash);
    await dexCore.updateStorage({
      permits: [bob.pkh],
    });

    expect(dexCore.storage.storage.permits_counter).to.be.bignumber.equal(
      new BigNumber(3)
    );
    expect(dexCore.storage.storage.permits[bob.pkh].permits.has(permitHash)).to
      .be.true;
    expect(dexCore.storage.storage.permits[bob.pkh].expiry).to.be.equal(null);
    expect(
      Date.parse(
        (await dexCore.storage.storage.permits[bob.pkh].permits.get(permitHash))
          .created_at
      )
    ).to.be.lte(await utils.getLastBlockTimestamp());
    expect(
      (await dexCore.storage.storage.permits[bob.pkh].permits.get(permitHash))
        .expiry
    ).to.be.equal(null);
  });

  it("should fail if bob is trying to submit duplicate permit", async () => {
    const transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(50),
          },
        ],
      },
    ];
    const [signerKey, signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(bob.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );

    await rejects(
      dexCore.permit(signerKey, signature, permitHash),
      (err: Error) => {
        expect(err.message).to.equal(PermitsErrors.DUP_PERMIT);

        return true;
      }
    );
  });

  it(`should generate permit payload by alice and submit it to the contract by bob`, async () => {
    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(100),
          },
        ],
      },
    ];
    const [signerKey, signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(alice.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );

    await utils.setProvider(bob.sk);
    await dexCore.permit(signerKey, signature, permitHash);
    await dexCore.updateStorage({
      permits: [alice.pkh],
    });

    expect(dexCore.storage.storage.permits_counter).to.be.bignumber.equal(
      new BigNumber(4)
    );
    expect(dexCore.storage.storage.permits[alice.pkh].permits.has(permitHash))
      .to.be.true;
    expect(dexCore.storage.storage.permits[alice.pkh].expiry).to.be.equal(null);
    expect(
      Date.parse(
        (
          await dexCore.storage.storage.permits[alice.pkh].permits.get(
            permitHash
          )
        ).created_at
      )
    ).to.be.lte(await utils.getLastBlockTimestamp());
    expect(
      (await dexCore.storage.storage.permits[alice.pkh].permits.get(permitHash))
        .expiry
    ).to.be.equal(null);
  });

  it("should fail if permit was missigned", async () => {
    const transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(20),
          },
        ],
      },
    ];
    const [_signerKey, signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(bob.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );

    await rejects(
      dexCore.permit(alice.pk, signature, permitHash),
      (err: any) => {
        expect(err.errors[1].with.args[0]["string"]).to.equal("MISSIGNED");

        return true;
      }
    );
  });

  it("should fail if not issuer is trying to set expiry - 1", async () => {
    const expiry: SetExpiry = {
      issuer: carol.pkh,
      expiry: new BigNumber(1),
      permit_hash: undefined,
    };

    await rejects(dexCore.setExpiry(expiry), (err: Error) => {
      expect(err.message).to.equal(PermitsErrors.NOT_PERMIT_ISSUER);

      return true;
    });
  });

  it("should fail if not issuer is trying to set expiry - 2", async () => {
    const expiry: SetExpiry = {
      issuer: alice.pkh,
      expiry: new BigNumber(1),
      permit_hash: undefined,
    };

    await rejects(dexCore.setExpiry(expiry), (err: Error) => {
      expect(err.message).to.equal(PermitsErrors.NOT_PERMIT_ISSUER);

      return true;
    });
  });

  it("should fail if not issuer is trying to set expiry - 3", async () => {
    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(100),
          },
        ],
      },
    ];
    const [_signerKey, _signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(alice.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );
    const expiry: SetExpiry = {
      issuer: alice.pkh,
      expiry: new BigNumber(1),
      permit_hash: permitHash,
    };

    await rejects(dexCore.setExpiry(expiry), (err: Error) => {
      expect(err.message).to.equal(PermitsErrors.NOT_PERMIT_ISSUER);

      return true;
    });
  });

  it("should set default expiry for a user with permits", async () => {
    const expiry: SetExpiry = {
      issuer: bob.pkh,
      expiry: new BigNumber(2),
      permit_hash: undefined,
    };

    await dexCore.setExpiry(expiry);
    await dexCore.updateStorage({ permits: [expiry.issuer] });

    expect(
      dexCore.storage.storage.permits[expiry.issuer].expiry
    ).to.be.bignumber.equal(expiry.expiry);
  });

  it("should set default expiry for a user without permits", async () => {
    const expiry: SetExpiry = {
      issuer: carol.pkh,
      expiry: new BigNumber(10),
      permit_hash: undefined,
    };

    await utils.setProvider(carol.sk);
    await dexCore.setExpiry(expiry);
    await dexCore.updateStorage({ permits: [expiry.issuer] });

    expect(
      dexCore.storage.storage.permits[expiry.issuer].expiry
    ).to.be.bignumber.equal(expiry.expiry);
  });

  it("should fail if user is trying to set default expiry that is bigger than max expiry", async () => {
    const expiry: SetExpiry = {
      issuer: bob.pkh,
      expiry: defaulPermitExpiryLimit.plus(1),
      permit_hash: undefined,
    };

    await utils.setProvider(bob.sk);
    await rejects(dexCore.setExpiry(expiry), (err: Error) => {
      expect(err.message).to.equal(PermitsErrors.EXPIRY_TOO_BIG);

      return true;
    });
  });

  it("should fail if user is trying to set expiry that is bigger than max expiry for a specified permit", async () => {
    const transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(50),
          },
        ],
      },
    ];
    const [_signerKey, _signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(bob.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );
    const expiry: SetExpiry = {
      issuer: bob.pkh,
      expiry: defaulPermitExpiryLimit.plus(1),
      permit_hash: permitHash,
    };

    await rejects(dexCore.setExpiry(expiry), (err: Error) => {
      expect(err.message).to.equal(PermitsErrors.EXPIRY_TOO_BIG);

      return true;
    });
  });

  it("should not set an expiry for a specified permit if permit is already expired", async () => {
    const transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(50),
          },
        ],
      },
    ];
    const [_signerKey, _signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(bob.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );
    const expiry: SetExpiry = {
      issuer: bob.pkh,
      expiry: defaulPermitExpiryLimit,
      permit_hash: permitHash,
    };

    await dexCore.setExpiry(expiry);
    await dexCore.updateStorage({ permits: [expiry.issuer] });

    expect(
      (
        await dexCore.storage.storage.permits[expiry.issuer].permits.get(
          permitHash
        )
      ).expiry
    ).to.be.equal(null);
  });

  it("should set an expiry for a specified permit", async () => {
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
    const [_signerKey, _signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(alice.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );
    const expiry: SetExpiry = {
      issuer: alice.pkh,
      expiry: defaulPermitExpiryLimit,
      permit_hash: permitHash,
    };

    await utils.setProvider(alice.sk);
    await dexCore.setExpiry(expiry);
    await dexCore.updateStorage({ permits: [expiry.issuer] });

    expect(
      (
        await dexCore.storage.storage.permits[expiry.issuer].permits.get(
          permitHash
        )
      ).expiry
    ).to.be.bignumber.equal(expiry.expiry);
  });

  it("should set a 0 expiry for a specified permit", async () => {
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
    const [_signerKey, _signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(alice.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );
    const expiry: SetExpiry = {
      issuer: alice.pkh,
      expiry: new BigNumber(0),
      permit_hash: permitHash,
    };

    await dexCore.setExpiry(expiry);
    await dexCore.updateStorage({ permits: [expiry.issuer] });

    expect(
      await dexCore.storage.storage.permits[expiry.issuer].permits.get(
        permitHash
      )
    ).to.be.equal(undefined);
  });

  it("should fail if permit was expired", async () => {
    const transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(50),
          },
        ],
      },
    ];

    await rejects(dexCore.transfer(transferParams), (err: Error) => {
      expect(err.message).to.equal(PermitsErrors.EXPIRED_PERMIT);

      return true;
    });
  });

  it(`should delete expired permits in time of submitting a new permit`, async () => {
    let transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: alice.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(300),
          },
        ],
      },
    ];
    let [signerKey, signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(bob.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );

    await utils.setProvider(bob.sk);
    await dexCore.permit(signerKey, signature, permitHash);
    await dexCore.updateStorage({
      permits: [bob.pkh],
    });

    expect(dexCore.storage.storage.permits_counter).to.be.bignumber.equal(
      new BigNumber(5)
    );
    expect(dexCore.storage.storage.permits[bob.pkh].permits.has(permitHash)).to
      .be.true;
    expect(
      dexCore.storage.storage.permits[bob.pkh].expiry
    ).to.be.bignumber.equal(new BigNumber(2));
    expect(
      Date.parse(
        (await dexCore.storage.storage.permits[bob.pkh].permits.get(permitHash))
          .created_at
      )
    ).to.be.lte(await utils.getLastBlockTimestamp());
    expect(
      (await dexCore.storage.storage.permits[bob.pkh].permits.get(permitHash))
        .expiry
    ).to.be.equal(null);

    transferParams = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(50),
          },
        ],
      },
    ];
    [signerKey, signature, permitHash] = await dexCore.createPermitPayload(
      await Utils.createTezos(bob.sk),
      dexCore.contract,
      "transfer",
      transferParams
    );

    expect(dexCore.storage.storage.permits[bob.pkh].permits.has(permitHash)).to
      .be.false;
  });

  it(`should call permit by carol on bob's behalf`, async () => {
    const tokenId: BigNumber = new BigNumber(0);
    const amount: BigNumber = new BigNumber(300);
    const transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: alice.pkh,
            token_id: tokenId,
            amount: amount,
          },
        ],
      },
    ];
    const [_signerKey, _signature, permitHash]: [string, string, string] =
      await dexCore.createPermitPayload(
        await Utils.createTezos(bob.sk),
        dexCore.contract,
        "transfer",
        transferParams
      );

    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId],
        [bob.pkh, tokenId],
      ],
      permits: [bob.pkh],
    });

    const prevAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId);
    const prevBobBalance: BigNumber = dexCore.getBalance(bob.pkh, tokenId);

    expect(dexCore.storage.storage.permits[bob.pkh].permits.has(permitHash)).to
      .be.true;

    await utils.setProvider(carol.sk);
    await dexCore.transfer(transferParams);
    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId],
        [bob.pkh, tokenId],
      ],
      permits: [bob.pkh],
    });

    const currAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId);
    const currBobBalance: BigNumber = dexCore.getBalance(bob.pkh, tokenId);

    expect(dexCore.storage.storage.permits[bob.pkh].permits.has(permitHash)).to
      .be.false;
    expect(currAliceBalance).to.be.bignumber.equal(
      prevAliceBalance.plus(amount)
    );
    expect(currBobBalance).to.be.bignumber.equal(prevBobBalance.minus(amount));
  });

  it("should fail if anyone is trying to use already used permit", async () => {
    const transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: alice.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(300),
          },
        ],
      },
    ];

    await rejects(dexCore.transfer(transferParams), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_NOT_OPERATOR);

      return true;
    });
  });
});
