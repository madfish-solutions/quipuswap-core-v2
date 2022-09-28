import { Common } from "../../helpers/Errors";
import { AuctionMock } from "../../helpers/AuctionMock";
import { Utils } from "../../helpers/Utils";
import { FA2 } from "../../helpers/FA2";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { auctionMockStorage } from "../../../storage/Auction";
import { fa2Storage } from "../../../storage/test/FA2";

import { SBAccount } from "../../types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("AuctionMock", async () => {
  var utils: Utils;
  var auction: AuctionMock;
  var token: FA2;
  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    token = await FA2.originate(utils.tezos, fa2Storage);

    auctionMockStorage.owner = alice.pkh;
    auctionMockStorage.dex = alice.pkh;

    auction = await AuctionMock.originate(utils.tezos, auctionMockStorage);

    await token.transfer([
      {
        from_: alice.pkh,
        txs: [
          {
            to_: auction.contract.address,
            token_id: new BigNumber(0),
            amount: new BigNumber(1000),
          },
        ],
      },
    ]);
  });

  it("Should changeOwner", async () => {
    await auction.changeOwner(bob.pkh);
    await auction.updateStorage();

    expect(auction.storage.owner).to.equal(bob.pkh);
  });

  it("Should fail change owner if user not a owner", async () => {
    await rejects(auction.changeOwner(alice.pkh), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
    await utils.setProvider(bob.sk);
  });

  it("Should failt receive fee if sender not dex", async () => {
    await rejects(
      auction.receiveFee({
        token: {
          fa2: { token: token.contract.address, id: new BigNumber(0) },
        },
        fee: new BigNumber(1000),
      }),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

        return true;
      },
    );
  });

  it("Should receive fee", async () => {
    await utils.setProvider(alice.sk);
    await auction.receiveFee({
      token: { fa2: { token: token.contract.address, id: new BigNumber(0) } },
      fee: new BigNumber(500),
    });
    await auction.updateStorage();

    expect(
      await auction.storage.fees.get({
        fa2: { token: token.contract.address, id: "0" },
      }),
    ).to.be.bignumber.equal(new BigNumber(500));
  });
  it("Should receive fee again", async () => {
    await auction.receiveFee({
      token: { fa2: { token: token.contract.address, id: new BigNumber(0) } },
      fee: new BigNumber(500),
    });
    await auction.updateStorage();

    expect(
      await auction.storage.fees.get({
        fa2: { token: token.contract.address, id: "0" },
      }),
    ).to.be.bignumber.equal(new BigNumber(1000));
  });

  it("Should fail claim fee if user not owner", async () => {
    await rejects(
      auction.claimFee({
        token: { fa2: { token: token.contract.address, id: new BigNumber(0) } },
        fee: new BigNumber(1000),
        recipient: bob.pkh,
      }),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

        return true;
      },
    );
  });

  it("Should receive XTZ fee", async () => {
    const prevBalance = await utils.tezos.tz
      .getBalance(auction.contract.address)
      .then(balance => Math.floor(balance.toNumber()))
      .catch(error => console.log(JSON.stringify(error)));
    await auction.default(1000000);
    await auction.receiveFee({
      token: { tez: null },
      fee: new BigNumber(1000000),
    });
    await auction.updateStorage();

    const balance = await utils.tezos.tz
      .getBalance(auction.contract.address)
      .then(balance => Math.floor(balance.toNumber()))
      .catch(error => console.log(JSON.stringify(error)));

    expect(balance).to.be.equal((prevBalance as number) + 1000000);
    expect(
      await auction.storage.fees.get({
        tez: null,
      }),
    ).to.be.bignumber.equal(new BigNumber(1000000));
  });

  it("Should claim fee", async () => {
    await utils.setProvider(bob.sk);
    const tokenPrevStorage: any = await token.contract.storage();
    const prevAliceBalance = await (
      await tokenPrevStorage.account_info.get(alice.pkh)
    ).balances.get("0");

    await auction.claimFee({
      token: { fa2: { token: token.contract.address, id: new BigNumber(0) } },
      fee: new BigNumber(1000),
      recipient: alice.pkh,
    });
    await auction.updateStorage();
    const tokenStorage: any = await token.contract.storage();
    const aliceBalance = await (
      await tokenStorage.account_info.get(alice.pkh)
    ).balances.get("0");

    expect(
      await auction.storage.fees.get({
        fa2: { token: token.contract.address, id: "0" },
      }),
    ).to.be.bignumber.equal(new BigNumber(0));

    expect(aliceBalance).to.be.bignumber.equal(
      new BigNumber(1000).plus(prevAliceBalance),
    );
  });
  it("Should claim XTZ fee", async () => {
    const prevAliceXTZBalance = await utils.tezos.tz
      .getBalance(alice.pkh)
      .then(balance => Math.floor(balance.toNumber()))
      .catch(error => console.log(JSON.stringify(error)));

    await auction.claimFee({
      token: { tez: null },
      fee: new BigNumber(1000000),
      recipient: alice.pkh,
    });
    await auction.updateStorage();

    const aliceXTZBalance = await utils.tezos.tz
      .getBalance(alice.pkh)
      .then(balance => Math.floor(balance.toNumber()))
      .catch(error => console.log(JSON.stringify(error)));

    expect(aliceXTZBalance).to.be.equal(
      (prevAliceXTZBalance as number) + 1000000,
    );
    expect(
      await auction.storage.fees.get({
        tez: null,
      }),
    ).to.be.bignumber.equal(new BigNumber(0));
  });
  it("Should receive extra xtz", async () => {
    const prevBalance = await utils.tezos.tz
      .getBalance(auction.contract.address)
      .then(balance => Math.floor(balance.toNumber()))
      .catch(error => console.log(JSON.stringify(error)));
    await auction.default(1000000);
    await auction.updateStorage();

    const balance = await utils.tezos.tz
      .getBalance(auction.contract.address)
      .then(balance => Math.floor(balance.toNumber()))
      .catch(error => console.log(JSON.stringify(error)));

    expect(balance).to.be.equal((prevBalance as number) + 1000000);
  });
  it("Should fail claim xtz fee if balance = 0 and extra fee > 0", async () => {
    await rejects(
      auction.claimFee({
        token: { tez: null },
        fee: new BigNumber(1000000),
        recipient: alice.pkh,
      }),
      (err: Error) => {
        expect(err.message).to.equal(Common.ERR_NOT_A_NAT);

        return true;
      },
    );
  });
  it("Should fail claim extra xtz fee if user not owner", async () => {
    await utils.setProvider(alice.sk);
    await rejects(auction.withdrawExtraXTZ(alice.pkh), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });
  it("Should claim extra xtz fee", async () => {
    await utils.setProvider(bob.sk);
    const prevAliceXTZBalance = await utils.tezos.tz
      .getBalance(alice.pkh)
      .then(balance => Math.floor(balance.toNumber()))
      .catch(error => console.log(JSON.stringify(error)));

    await auction.withdrawExtraXTZ(alice.pkh);
    await auction.updateStorage();

    const aliceXTZBalance = await utils.tezos.tz
      .getBalance(alice.pkh)
      .then(balance => Math.floor(balance.toNumber()))
      .catch(error => console.log(JSON.stringify(error)));

    expect(aliceXTZBalance).to.be.equal(
      (prevAliceXTZBalance as number) + 1000000,
    );
  });
});
