import { Common, DexCore as DexCoreErrors } from "./helpers/Errors";
import { BakerRegistry } from "./helpers/BakerRegistry";
import { Utils, zeroAddress } from "./helpers/Utils";
import { DexCore } from "./helpers/DexCore";
import { FA12 } from "./helpers/FA12";
import { FA2 } from "./helpers/FA2";

import { Contract, OriginationOperation, VIEW_LAMBDA } from "@taquito/taquito";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import { alice, bob, dev } from "../scripts/sandbox/accounts";

import { confirmOperation } from "../scripts/confirmation";

import { bakerRegistryStorage } from "../storage/BakerRegistry";
import { dexCoreStorage } from "../storage/DexCore";
import { fa12Storage } from "../storage/test/FA12";
import { fa2Storage } from "../storage/test/FA2";

import {
  UpdateTokenMetadata,
  LaunchExchange,
  AddManager,
  Fees,
  Ban,
} from "./types/DexCore";
import { TezStore } from "./helpers/TezStore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore tests (admin's methods)", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;
  var firstToken: FA12;
  var secondToken: FA2;
  var lambdaContract: Contract;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    const transferOperation = await utils.tezos.contract.transfer({
      to: dev.pkh,
      amount: 50_000_000,
      mutez: true,
    });

    await confirmOperation(utils.tezos, transferOperation.hash);

    firstToken = await FA12.originate(utils.tezos, fa12Storage);
    secondToken = await FA2.originate(utils.tezos, fa2Storage);

    const operation: OriginationOperation =
      await utils.tezos.contract.originate({
        code: VIEW_LAMBDA.code,
        storage: VIEW_LAMBDA.storage,
      });

    lambdaContract = await operation.contract();
  });

  it("should fail if not admin is trying to setup new pending admin", async () => {
    await utils.setProvider(bob.sk);
    await rejects(dexCore.setAdmin(bob.pkh), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should setup new pending admin by admin", async () => {
    await utils.setProvider(alice.sk);
    await dexCore.setAdmin(bob.pkh);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.admin).to.equal(alice.pkh);
    expect(dexCore.storage.storage.pending_admin).to.equal(bob.pkh);
  });

  it("should fail if not pending admin is trying to confirm new admin", async () => {
    await rejects(dexCore.confirmAdmin(), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_PENDING_ADMIN);

      return true;
    });
  });

  it("should confirm new admin by pending admin", async () => {
    await utils.setProvider(bob.sk);
    await dexCore.confirmAdmin();
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.admin).to.equal(bob.pkh);
    expect(dexCore.storage.storage.pending_admin).to.equal(zeroAddress);
  });

  it("should fail if not admin is trying to add new manager", async () => {
    await utils.setProvider(alice.sk);
    await rejects(dexCore.addManagers([]), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should add one manager", async () => {
    const addManagerParams: AddManager[] = [{ manager: bob.pkh, add: true }];

    await utils.setProvider(bob.sk);
    await dexCore.addManagers(addManagerParams);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.managers.length).to.equal(
      addManagerParams.length
    );
    expect(dexCore.storage.storage.managers).to.contain(
      addManagerParams[0].manager
    );
  });

  it("should remove one manager", async () => {
    const addManagerParams: AddManager[] = [{ manager: bob.pkh, add: false }];

    await dexCore.addManagers(addManagerParams);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.managers.length).to.equal(0);
  });

  it("should add a group of managers", async () => {
    const addManagerParams: AddManager[] = [
      { manager: bob.pkh, add: true },
      { manager: alice.pkh, add: true },
      { manager: dev.pkh, add: true },
    ];

    await dexCore.addManagers(addManagerParams);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.managers.length).to.equal(
      addManagerParams.length
    );

    for (let i: number = 0; i < addManagerParams.length; ++i) {
      expect(dexCore.storage.storage.managers).to.contain(
        addManagerParams[i].manager
      );
    }
  });

  it("should remove a group of managers", async () => {
    const addManagerParams: AddManager[] = [
      { manager: bob.pkh, add: false },
      { manager: alice.pkh, add: false },
    ];

    await dexCore.addManagers(addManagerParams);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.managers.length).to.equal(1);
    expect(dexCore.storage.storage.managers).to.contain(dev.pkh);
  });

  it("shoud add/remove some groups of managers", async () => {
    const addManagerParams: AddManager[] = [
      { manager: bob.pkh, add: true },
      { manager: alice.pkh, add: true },
      { manager: dev.pkh, add: false },
    ];

    await dexCore.addManagers(addManagerParams);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.managers.length).to.equal(2);
    expect(dexCore.storage.storage.managers).to.contain(alice.pkh);
    expect(dexCore.storage.storage.managers).to.contain(bob.pkh);
    expect(dexCore.storage.storage.managers).to.not.contain(dev.pkh);
  });

  it("should fail if not admin is trying to set fees", async () => {
    const fees: Fees = {
      interface_fee: new BigNumber(100),
      swap_fee: new BigNumber(666),
    };

    await utils.setProvider(alice.sk);
    await rejects(dexCore.setFees(fees), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should update fees", async () => {
    const fees: Fees = {
      interface_fee: new BigNumber(100),
      swap_fee: new BigNumber(666),
    };

    await utils.setProvider(bob.sk);
    await dexCore.setFees(fees);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.fees.interface_fee).to.be.bignumber.equal(
      fees.interface_fee
    );
    expect(dexCore.storage.storage.fees.swap_fee).to.be.bignumber.equal(
      fees.swap_fee
    );
  });

  it("should fail if not admin is trying to set cycle duration", async () => {
    await utils.setProvider(alice.sk);
    await rejects(
      dexCore.setCycleDuration(new BigNumber(666)),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

        return true;
      }
    );
  });

  it("should update cycle duration", async () => {
    const cycleDuration: BigNumber = new BigNumber(666);

    await utils.setProvider(bob.sk);
    await dexCore.setCycleDuration(cycleDuration);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.cycle_duration).to.be.bignumber.equal(
      cycleDuration
    );
  });

  it("should fail if not manager is trying to update token metadata", async () => {
    const updateTokenMetadata: UpdateTokenMetadata = {
      token_id: new BigNumber(666),
      token_info: [
        { key: "NAME", value: Buffer.from("Quipu LP Token").toString("hex") },
      ],
    };

    await utils.setProvider(dev.sk);
    await rejects(
      dexCore.updateTokenMetadata(updateTokenMetadata),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NOT_MANAGER);

        return true;
      }
    );
  });

  it("should fail if pair not listed", async () => {
    const updateTokenMetadata: UpdateTokenMetadata = {
      token_id: new BigNumber(666),
      token_info: [
        { key: "NAME", value: Buffer.from("Quipu LP Token").toString("hex") },
      ],
    };

    await utils.setProvider(bob.sk);
    await rejects(
      dexCore.updateTokenMetadata(updateTokenMetadata),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

        return true;
      }
    );
  });

  it("should update existing fields in token metadata", async () => {
    const launchExchange: LaunchExchange = {
      pair: {
        token_a: { fa12: firstToken.contract.address },
        token_b: {
          fa2: { token: secondToken.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares_recipient: bob.pkh,
      candidate: bob.pkh,
    };
    const updateTokenMetadata: UpdateTokenMetadata = {
      token_id: new BigNumber(0),
      token_info: [
        {
          key: "name",
          value: Buffer.from("Quipuswap Token").toString("hex"),
        },
        { key: "symbol", value: Buffer.from("QLPT").toString("hex") },
        { key: "decimals", value: Buffer.from("18").toString("hex") },
      ],
    };

    await firstToken.approve(
      dexCore.contract.address,
      launchExchange.token_a_in
    );
    await secondToken.updateOperators([
      {
        add_operator: {
          owner: bob.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await dexCore.launchExchange(launchExchange);
    await dexCore.updateTokenMetadata(updateTokenMetadata);
    await dexCore.updateStorage({
      token_metadata: [updateTokenMetadata.token_id],
    });

    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("name"),
        "hex"
      ).toString()
    ).to.equal("Quipuswap Token");
    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("symbol"),
        "hex"
      ).toString()
    ).to.equal("QLPT");
    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("decimals"),
        "hex"
      ).toString()
    ).to.equal("18");
  });

  it("should set new fields in token metadata", async () => {
    const updateTokenMetadata: UpdateTokenMetadata = {
      token_id: new BigNumber(0),
      token_info: [
        {
          key: "creator",
          value: Buffer.from("Serhii Makov").toString("hex"),
        },
        { key: "version", value: Buffer.from("0.1.0").toString("hex") },
      ],
    };

    await dexCore.updateTokenMetadata(updateTokenMetadata);
    await dexCore.updateStorage({
      token_metadata: [updateTokenMetadata.token_id],
    });

    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("creator"),
        "hex"
      ).toString()
    ).to.equal("Serhii Makov");
    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("version"),
        "hex"
      ).toString()
    ).to.equal("0.1.0");
  });

  it("should update existing and set new fields in token metadata", async () => {
    const updateTokenMetadata: UpdateTokenMetadata = {
      token_id: new BigNumber(0),
      token_info: [
        {
          key: "name",
          value: Buffer.from("Quipuswap LP Token").toString("hex"),
        },
        { key: "symbol", value: Buffer.from("QPT").toString("hex") },
        { key: "decimals", value: Buffer.from("6").toString("hex") },
        {
          key: "blockchain",
          value: Buffer.from("Tezos").toString("hex"),
        },
      ],
    };

    await dexCore.updateTokenMetadata(updateTokenMetadata);
    await dexCore.updateStorage({
      token_metadata: [updateTokenMetadata.token_id],
    });

    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("name"),
        "hex"
      ).toString()
    ).to.equal("Quipuswap LP Token");
    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("symbol"),
        "hex"
      ).toString()
    ).to.equal("QPT");
    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("decimals"),
        "hex"
      ).toString()
    ).to.equal("6");
    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("creator"),
        "hex"
      ).toString()
    ).to.equal("Serhii Makov");
    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("version"),
        "hex"
      ).toString()
    ).to.equal("0.1.0");
    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("blockchain"),
        "hex"
      ).toString()
    ).to.equal("Tezos");
    expect(
      Buffer.from(
        await dexCore.storage.storage.token_metadata[
          updateTokenMetadata.token_id.toNumber()
        ].token_info.get("shouldPreferSymbol"),
        "hex"
      ).toString()
    ).to.equal("true");
  });

  it("should fail if not admin is trying to ban baker", async () => {
    const ban: Ban = {
      pair_id: new BigNumber(0),
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(666) },
    };

    await utils.setProvider(alice.sk);
    await rejects(dexCore.ban(ban), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    const ban: Ban = {
      pair_id: new BigNumber(666),
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(666) },
    };

    await utils.setProvider(bob.sk);
    await rejects(dexCore.ban(ban), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if tez store not found (not TEZ/TOK pair)", async () => {
    const ban: Ban = {
      pair_id: new BigNumber(0),
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(666) },
    };

    await rejects(dexCore.ban(ban), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_TEZ_STORE_404);

      return true;
    });
  });

  it("should ban baker", async () => {
    const launchExchange: LaunchExchange = {
      pair: {
        token_a: { fa12: firstToken.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares_recipient: bob.pkh,
      candidate: bob.pkh,
    };
    const ban: Ban = {
      pair_id: new BigNumber(1),
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(666) },
    };

    await firstToken.approve(
      dexCore.contract.address,
      launchExchange.token_a_in
    );
    await dexCore.launchExchange(launchExchange, 1);
    await dexCore.updateStorage({ pairs: [ban.pair_id] });

    const tezStore: TezStore = await TezStore.init(
      dexCore.storage.storage.pairs[ban.pair_id.toNumber()].tez_store,
      utils.tezos
    );

    await dexCore.ban(ban);
    await tezStore.updateStorage({ bakers: [ban.ban_params.baker] });

    expect(
      tezStore.storage.bakers[ban.ban_params.baker].ban_period
    ).to.be.bignumber.equal(ban.ban_params.ban_period);
    expect(
      String(
        Date.parse(tezStore.storage.bakers[ban.ban_params.baker].ban_start_time)
      )
    ).to.equal(await utils.getLastBlockTimestamp());
  });

  it("should unban baker", async () => {
    const ban: Ban = {
      pair_id: new BigNumber(1),
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(0) },
    };
    const tezStore: TezStore = await TezStore.init(
      dexCore.storage.storage.pairs[ban.pair_id.toNumber()].tez_store,
      utils.tezos
    );

    await dexCore.ban(ban);
    await tezStore.updateStorage({ bakers: [ban.ban_params.baker] });

    expect(
      tezStore.storage.bakers[ban.ban_params.baker].ban_period
    ).to.be.bignumber.equal(ban.ban_params.ban_period);
    expect(
      String(
        Date.parse(tezStore.storage.bakers[ban.ban_params.baker].ban_start_time)
      )
    ).to.equal(await utils.getLastBlockTimestamp());
  });
});
