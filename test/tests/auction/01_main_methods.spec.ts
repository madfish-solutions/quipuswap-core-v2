import { Common } from "../../helpers/Errors";
import { Auction } from "../../helpers/Auction";
import { Utils } from "../../helpers/Utils";
import { FA2 } from "../../helpers/FA2";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { auctionStorage } from "../../../storage/Auction";
import { fa2Storage } from "../../../storage/test/FA2";

import { ReceiveFee } from "test/types/Auction";
import { SBAccount } from "test/types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("Auction tests (main methods)", async () => {
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
    auctionStorage.storage.quipu_token = quipuToken.contract.address;
    auctionStorage.storage.fees.bid_fee_f = new BigNumber(0.5 * 10 ** 18);
    auctionStorage.storage.fees.dev_fee_f = new BigNumber(4.2 * 10 ** 18);

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();
  });

  it("should fail if not dex core is trying to send fees", async () => {
    const params: ReceiveFee = {
      token: {
        tez: undefined,
      },
      fee: new BigNumber(0),
    };

    await utils.setProvider(bob.sk);
    await rejects(auction.receiveFee(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });
});
