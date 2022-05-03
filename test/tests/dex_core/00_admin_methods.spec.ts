import { Common, DexCore as DexCoreErrors } from "../../helpers/Errors";
import { FlashSwapsProxy } from "../../helpers/FlashSwapsProxy";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { Utils, zeroAddress } from "../../helpers/Utils";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
import { Bucket } from "../../helpers/Bucket";
import { FA12 } from "../../helpers/FA12";
import { FA2 } from "../../helpers/FA2";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { confirmOperation } from "../../../scripts/confirmation";

import { flashSwapsProxyStorage } from "../../../storage/FlashSwapsProxy";
import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { auctionStorage } from "../../../storage/Auction";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";
import { fa2Storage } from "../../../storage/test/FA2";

import { SBAccount } from "../../types/Common";
import {
  UpdateTokenMetadata,
  LaunchExchange,
  AddManager,
  Fees,
  Ban,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (admin methods)", async () => {
  var flashSwapsProxy: FlashSwapsProxy;
  var bakerRegistry: BakerRegistry;
  var auction: Auction;
  var dexCore: DexCore;
  var firstToken: FA12;
  var secondToken: FA2;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;
  var dev: SBAccount = accounts.dev;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;
    dexCoreStorage.storage.collecting_period = new BigNumber(0);

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    flashSwapsProxyStorage.dex_core = dexCore.contract.address;

    flashSwapsProxy = await FlashSwapsProxy.originate(
      utils.tezos,
      flashSwapsProxyStorage
    );

    const transferOperation = await utils.tezos.contract.transfer({
      to: dev.pkh,
      amount: 50_000_000,
      mutez: true,
    });

    await confirmOperation(utils.tezos, transferOperation.hash);

    firstToken = await FA12.originate(utils.tezos, fa12Storage);
    secondToken = await FA2.originate(utils.tezos, fa2Storage);

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = dexCore.contract.address;
    auctionStorage.storage.quipu_token.token = alice.pkh;

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();
  });

  it("should fail if pending admin is `None`", async () => {
    await rejects(dexCore.confirmAdmin(), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_PENDING_ADMIN_IS_NONE);

      return true;
    });
  });

  it("should fail if not admin is trying to setup new pending admin", async () => {
    await utils.setProvider(bob.sk);
    await rejects(dexCore.setAdmin(bob.pkh), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await utils.setProvider(alice.sk);
    await rejects(dexCore.setAdmin(bob.pkh, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should setup new pending admin by admin", async () => {
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

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await utils.setProvider(bob.sk);
    await rejects(dexCore.confirmAdmin(1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should confirm new admin by pending admin", async () => {
    await utils.setProvider(bob.sk);
    await dexCore.confirmAdmin();
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.admin).to.equal(bob.pkh);
    expect(dexCore.storage.storage.pending_admin).to.equal(null);
  });

  it("should fail if not admin is trying to setup new flash swaps proxy", async () => {
    await utils.setProvider(alice.sk);
    await rejects(
      dexCore.setFlashSwapsProxy(flashSwapsProxy.contract.address),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

        return true;
      }
    );
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await utils.setProvider(bob.sk);
    await rejects(
      dexCore.setFlashSwapsProxy(flashSwapsProxy.contract.address, 1),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

        return true;
      }
    );
  });

  it("should setup new flash swaps proxy", async () => {
    expect(dexCore.storage.storage.flash_swaps_proxy).to.equal(zeroAddress);

    await dexCore.setFlashSwapsProxy(flashSwapsProxy.contract.address);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.flash_swaps_proxy).to.equal(
      flashSwapsProxy.contract.address
    );
  });

  it("should fail if not admin is trying to setup new auction", async () => {
    await utils.setProvider(alice.sk);
    await rejects(
      dexCore.setAuction(auction.contract.address),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

        return true;
      }
    );
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await utils.setProvider(bob.sk);
    await rejects(
      dexCore.setAuction(auction.contract.address, 1),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

        return true;
      }
    );
  });

  it("should setup new auction", async () => {
    expect(dexCore.storage.storage.auction).to.equal(zeroAddress);

    await dexCore.setAuction(auction.contract.address);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.auction).to.equal(auction.contract.address);
  });

  it("should fail if not admin is trying to add new manager", async () => {
    await utils.setProvider(alice.sk);
    await rejects(dexCore.addManagers([]), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await utils.setProvider(bob.sk);
    await rejects(dexCore.addManagers([], 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should add one manager", async () => {
    const addManagerParams: AddManager[] = [{ manager: bob.pkh, add: true }];

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
    expect(dexCore.storage.storage.managers).to.contain(
      addManagerParams[0].manager
    );
    expect(dexCore.storage.storage.managers).to.contain(
      addManagerParams[1].manager
    );
    expect(dexCore.storage.storage.managers).to.not.contain(
      addManagerParams[2].manager
    );
  });

  it("should fail if not admin is trying to set fees", async () => {
    const fees: Fees = {
      interface_fee: new BigNumber(100),
      swap_fee: new BigNumber(666),
      auction_fee: new BigNumber(13),
      withdraw_fee_reward: new BigNumber(21),
    };

    await utils.setProvider(alice.sk);
    await rejects(dexCore.setFees(fees), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const fees: Fees = {
      interface_fee: new BigNumber(100),
      swap_fee: new BigNumber(666),
      auction_fee: new BigNumber(13),
      withdraw_fee_reward: new BigNumber(21),
    };

    await utils.setProvider(bob.sk);
    await rejects(dexCore.setFees(fees, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should update fees", async () => {
    const fees: Fees = {
      interface_fee: new BigNumber(100),
      swap_fee: new BigNumber(666),
      auction_fee: new BigNumber(13),
      withdraw_fee_reward: new BigNumber(21),
    };

    await dexCore.setFees(fees);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.fees.interface_fee).to.be.bignumber.equal(
      fees.interface_fee
    );
    expect(dexCore.storage.storage.fees.swap_fee).to.be.bignumber.equal(
      fees.swap_fee
    );
    expect(dexCore.storage.storage.fees.auction_fee).to.be.bignumber.equal(
      fees.auction_fee
    );
    expect(
      dexCore.storage.storage.fees.withdraw_fee_reward
    ).to.be.bignumber.equal(fees.withdraw_fee_reward);
  });

  it("should fail if not admin is trying to setup new collecting period", async () => {
    const collectingPeriod: BigNumber = new BigNumber(666);

    await utils.setProvider(alice.sk);
    await rejects(
      dexCore.setCollectingPeriod(collectingPeriod),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

        return true;
      }
    );
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const collectingPeriod: BigNumber = new BigNumber(666);

    await utils.setProvider(bob.sk);
    await rejects(
      dexCore.setCollectingPeriod(collectingPeriod, 1),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

        return true;
      }
    );
  });

  it("should setup new collecting period", async () => {
    expect(dexCore.storage.storage.collecting_period).to.be.bignumber.equal(0);

    const collectingPeriod: BigNumber = new BigNumber(666);

    await dexCore.setCollectingPeriod(collectingPeriod);
    await dexCore.updateStorage();

    expect(dexCore.storage.storage.collecting_period).to.be.bignumber.equal(
      collectingPeriod
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

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const updateTokenMetadata: UpdateTokenMetadata = {
      token_id: new BigNumber(666),
      token_info: [
        { key: "NAME", value: Buffer.from("Quipu LP Token").toString("hex") },
      ],
    };

    await utils.setProvider(bob.sk);
    await rejects(
      dexCore.updateTokenMetadata(updateTokenMetadata, 1),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

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
      shares_receiver: bob.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
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

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const ban: Ban = {
      pair_id: new BigNumber(0),
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(666) },
    };

    await utils.setProvider(bob.sk);
    await rejects(dexCore.ban(ban, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    const ban: Ban = {
      pair_id: new BigNumber(666),
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(666) },
    };

    await rejects(dexCore.ban(ban), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if bucket not found (not TEZ/TOK pair)", async () => {
    const ban: Ban = {
      pair_id: new BigNumber(0),
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(666) },
    };

    await rejects(dexCore.ban(ban), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_BUCKET_404);

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
      shares_receiver: bob.pkh,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
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

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[ban.pair_id.toNumber()].bucket,
      utils.tezos
    );

    await dexCore.ban(ban);
    await bucket.updateStorage({ bakers: [ban.ban_params.baker] });

    const tezosNow = await utils.getLastBlockTimestamp()

    expect(Date.parse(bucket.storage.bakers[ban.ban_params.baker].ban_end_time)).to.be.bignumber.lte(
      ban.ban_params.ban_period.multipliedBy(1000).plus(tezosNow)
    );
  });

  it("should unban baker", async () => {
    const ban: Ban = {
      pair_id: new BigNumber(1),
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(0) },
    };
    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[ban.pair_id.toNumber()].bucket,
      utils.tezos
    );

    await dexCore.ban(ban);
    await bucket.updateStorage({ bakers: [ban.ban_params.baker] });

    const tezosNow = await utils.getLastBlockTimestamp()
    expect(Date.parse(bucket.storage.bakers[ban.ban_params.baker].ban_end_time)).to.be.bignumber.lte(
      tezosNow
    );
  });
});
