import { Utils, zeroAddress } from "../../helpers/Utils";
import { Auction } from "../../helpers/Auction";
import { Common } from "../../helpers/Errors";
import { FA2 } from "../../helpers/FA2";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { auctionStorage } from "../../../storage/Auction";
import { fa2Storage } from "../../../storage/test/FA2";

import { Fees, UpdateWhitelist } from "../../types/Auction";
import { SBAccount } from "../../types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("Auction (admin methods)", async () => {
  var utils: Utils;
  var auction: Auction;
  var quipuToken: FA2;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    quipuToken = await FA2.originate(utils.tezos, fa2Storage);

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = alice.pkh;
    auctionStorage.storage.quipu_token.token = quipuToken.contract.address;

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();
  });

  it("should fail if pending admin is `None`", async () => {
    await rejects(auction.confirmAdmin(), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_PENDING_ADMIN_IS_NONE);

      return true;
    });
  });

  it("should fail if not admin is trying to setup a new pending admin", async () => {
    await utils.setProvider(bob.sk);
    await rejects(auction.setAdmin(bob.pkh), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await utils.setProvider(alice.sk);
    await rejects(auction.setAdmin(bob.pkh, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should setup a new pending admin by an admin", async () => {
    await auction.setAdmin(bob.pkh);
    await auction.updateStorage();

    expect(auction.storage.storage.admin).to.equal(alice.pkh);
    expect(auction.storage.storage.pending_admin).to.equal(bob.pkh);
  });

  it("should fail if not pending admin is trying to confirm a new admin", async () => {
    await rejects(auction.confirmAdmin(), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_PENDING_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await utils.setProvider(bob.sk);
    await rejects(auction.confirmAdmin(1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should confirm a new admin by pending admin", async () => {
    await auction.confirmAdmin();
    await auction.updateStorage();

    expect(auction.storage.storage.admin).to.equal(bob.pkh);
    expect(auction.storage.storage.pending_admin).to.equal(null);
  });

  it("should fail if not admin is trying to setup a new baker", async () => {
    await utils.setProvider(alice.sk);
    await rejects(auction.setBaker(alice.pkh), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await utils.setProvider(bob.sk);
    await rejects(auction.setBaker(alice.pkh, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should setup a new baker and delegate for him", async () => {
    expect(
      await utils.tezos.rpc.getDelegate(auction.contract.address)
    ).to.equal(null);

    await auction.setBaker(alice.pkh);
    await auction.updateStorage();

    expect(auction.storage.storage.baker).to.equal(alice.pkh);
    expect(
      await utils.tezos.rpc.getDelegate(auction.contract.address)
    ).to.equal(alice.pkh);
  });

  it("should do nothing if a new baker is the same as the old one", async () => {
    await auction.setBaker(alice.pkh);
    await auction.updateStorage();

    expect(auction.storage.storage.baker).to.equal(alice.pkh);
    expect(
      await utils.tezos.rpc.getDelegate(auction.contract.address)
    ).to.equal(alice.pkh);
  });

  it("should remove a delegate if `None` was passed by an admin", async () => {
    await auction.setBaker(null);
    await auction.updateStorage();

    expect(auction.storage.storage.baker).to.equal(null);
    expect(
      await utils.tezos.rpc.getDelegate(auction.contract.address)
    ).to.equal(null);
  });

  it("should fail if not admin is trying to setup a new fees", async () => {
    const fees: Fees = {
      dev_fee_f: new BigNumber(666),
      bid_fee_f: new BigNumber(666),
    };

    await utils.setProvider(alice.sk);
    await rejects(auction.setFees(fees), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const fees: Fees = {
      dev_fee_f: new BigNumber(666),
      bid_fee_f: new BigNumber(666),
    };

    await utils.setProvider(bob.sk);
    await rejects(auction.setFees(fees, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should setup a new fees by an admin", async () => {
    const fees: Fees = {
      dev_fee_f: new BigNumber(666),
      bid_fee_f: new BigNumber(13),
    };

    await auction.setFees(fees);
    await auction.updateStorage();

    expect(auction.storage.storage.fees.dev_fee_f).to.be.bignumber.equal(
      fees.dev_fee_f
    );
    expect(auction.storage.storage.fees.bid_fee_f).to.be.bignumber.equal(
      fees.bid_fee_f
    );
  });

  it("should fail if not admin is trying to setup a new auction duration", async () => {
    const auctionDuration: BigNumber = new BigNumber(666);

    await utils.setProvider(alice.sk);
    await rejects(auction.setAuctionDuration(auctionDuration), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const auctionDuration: BigNumber = new BigNumber(666);

    await utils.setProvider(bob.sk);
    await rejects(
      auction.setAuctionDuration(auctionDuration, 1),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

        return true;
      }
    );
  });

  it("should setup a new auction duration by an admin", async () => {
    const auctionDuration: BigNumber = new BigNumber(666);

    await auction.setAuctionDuration(auctionDuration);
    await auction.updateStorage();

    expect(auction.storage.storage.auction_duration).to.be.bignumber.equal(
      auctionDuration
    );
  });

  it("should fail if not admin is trying to setup a new min bid", async () => {
    const minBid: BigNumber = new BigNumber(666);

    await utils.setProvider(alice.sk);
    await rejects(auction.setMinBid(minBid), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const minBid: BigNumber = new BigNumber(666);

    await utils.setProvider(bob.sk);
    await rejects(auction.setMinBid(minBid, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should setup a new min bid by an admin", async () => {
    const minBid: BigNumber = new BigNumber(666);

    await auction.setMinBid(minBid);
    await auction.updateStorage();

    expect(auction.storage.storage.min_bid).to.be.bignumber.equal(minBid);
  });

  it("should fail if not admin is trying to update the whitelist for tokens", async () => {
    const params: UpdateWhitelist = {
      token: {
        tez: undefined,
      },
      add: true,
    };

    await utils.setProvider(alice.sk);
    await rejects(auction.updateWhitelist(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const params: UpdateWhitelist = {
      token: {
        tez: undefined,
      },
      add: true,
    };

    await utils.setProvider(bob.sk);
    await rejects(auction.updateWhitelist(params, 1), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should add a new TEZ token to the whitelist by an admin", async () => {
    const params: UpdateWhitelist = {
      token: {
        tez: undefined,
      },
      add: true,
    };

    await auction.updateWhitelist(params);
    await auction.updateStorage();

    expect(auction.storage.storage.whitelist.length).to.be.equal(1);
  });

  it("should add a new FA1.2 token to the whitelist by an admin", async () => {
    const params: UpdateWhitelist = {
      token: {
        fa12: alice.pkh,
      },
      add: true,
    };

    await auction.updateWhitelist(params);
    await auction.updateStorage();

    expect(auction.storage.storage.whitelist.length).to.be.equal(2);
    expect(auction.storage.storage.whitelist).to.deep.include(params.token);
  });

  it("should add a new FA2 token to the whitelist by an admin", async () => {
    const params: UpdateWhitelist = {
      token: {
        fa2: {
          token: alice.pkh,
          id: new BigNumber(0),
        },
      },
      add: true,
    };

    await auction.updateWhitelist(params);
    await auction.updateStorage();

    expect(auction.storage.storage.whitelist.length).to.be.equal(3);
    expect(auction.storage.storage.whitelist).to.deep.include(params.token);
  });

  it("should remove TEZ token from the whitelist by an admin", async () => {
    const params: UpdateWhitelist = {
      token: {
        tez: undefined,
      },
      add: false,
    };

    await auction.updateWhitelist(params);
    await auction.updateStorage();

    expect(auction.storage.storage.whitelist.length).to.be.equal(2);
    expect(auction.storage.storage.whitelist).to.not.deep.include(params.token);
  });

  it("should remove FA1.2 token from the whitelist by an admin", async () => {
    const params: UpdateWhitelist = {
      token: {
        fa12: alice.pkh,
      },
      add: false,
    };

    await auction.updateWhitelist(params);
    await auction.updateStorage();

    expect(auction.storage.storage.whitelist.length).to.be.equal(1);
    expect(auction.storage.storage.whitelist).to.not.deep.include(params.token);
  });

  it("should remove FA2 token from the whitelist by an admin", async () => {
    const params: UpdateWhitelist = {
      token: {
        fa2: {
          token: alice.pkh,
          id: new BigNumber(0),
        },
      },
      add: false,
    };

    await auction.updateWhitelist(params);
    await auction.updateStorage();

    expect(auction.storage.storage.whitelist.length).to.be.equal(0);
    expect(auction.storage.storage.whitelist).to.not.deep.include(params.token);
  });
});
