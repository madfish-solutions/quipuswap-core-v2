import { Common, Auction as AuctionErrors } from "../../helpers/Errors";
import { Utils, zeroAddress } from "../../helpers/Utils";
import { PRECISION } from "../../helpers/Constants";
import { Auction } from "../../helpers/Auction";
import { FA12 } from "../../helpers/FA12";
import { FA2 } from "../../helpers/FA2";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import { confirmOperation } from "../../../scripts/confirmation";

import accounts from "../../../scripts/sandbox/accounts";

import { auctionStorage } from "../../../storage/Auction";
import { fa12Storage } from "../../../storage/test/FA12";
import { fa2Storage } from "../../../storage/test/FA2";

import { SBAccount, Token } from "../../types/Common";
import { Transfer } from "../../types/FA2";
import {
  UpdateWhitelist,
  LaunchAuction,
  ReceiveFees,
  WithdrawFee,
  ReceiveFee,
  PlaceBid,
  AuctionStorage,
} from "../../types/Auction";

chai.use(require("chai-bignumber")(BigNumber));

describe("Auction (main methods)", async () => {
  var utils: Utils;
  var auction: Auction;
  var fa12Whitelisted: FA12;
  var fa12: FA12;
  var fa2: FA2;
  var quipuToken: FA2;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    fa12Whitelisted = await FA12.originate(utils.tezos, fa12Storage);
    fa12 = await FA12.originate(utils.tezos, fa12Storage);
    fa2 = await FA2.originate(utils.tezos, fa2Storage);
    quipuToken = await FA2.originate(utils.tezos, fa2Storage);

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = alice.pkh;
    auctionStorage.storage.quipu_token.token = quipuToken.contract.address;
    auctionStorage.storage.whitelist = [
      { fa12: fa12Whitelisted.contract.address },
    ];
    auctionStorage.storage.fees.bid_fee_f = new BigNumber(0.07).multipliedBy(
      PRECISION,
    );
    auctionStorage.storage.fees.dev_fee_f = new BigNumber(0.042).multipliedBy(
      PRECISION,
    );
    auctionStorage.storage.min_bid = new BigNumber(10);
    auctionStorage.storage.auction_duration = new BigNumber(17);

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const params: ReceiveFee = {
      token: { tez: undefined },
      fee: new BigNumber(0),
    };

    await rejects(auction.receiveFee(params, 1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should fail if not dex core is trying to send fees", async () => {
    const params: ReceiveFee = {
      token: { tez: undefined },
      fee: new BigNumber(0),
    };

    await utils.setProvider(bob.sk);
    await rejects(auction.receiveFee(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should receive TEZ tokens as fee and correctly update dev and public fee balances", async () => {
    const params: ReceiveFee = {
      token: { tez: undefined },
      fee: new BigNumber(10_000_000),
    };

    await utils.setProvider(alice.sk);

    const operation = await utils.tezos.contract.transfer({
      to: auction.contract.address,
      amount: params.fee.toNumber(),
      mutez: true,
    });

    await confirmOperation(utils.tezos, operation.hash);
    await auction.receiveFee(params);
    await auction.updateStorage({
      dev_fee_balances_f: [params.token],
      public_fee_balances_f: [params.token],
    });

    const receiveFees: ReceiveFees = auction.calculateReceiveFees(params.fee);

    expect(
      await utils.tezos.tz.getBalance(auction.contract.address),
    ).to.be.bignumber.equal(new BigNumber(params.fee));
    expect(
      auction.storage.storage.dev_fee_balances_f[params.token.toString()],
    ).to.be.bignumber.equal(receiveFees.devFee);
    expect(
      auction.storage.storage.public_fee_balances_f[params.token.toString()],
    ).to.be.bignumber.equal(receiveFees.publicFee);
  });

  it("should receive FA1.2 tokens as fee and correctly update dev and public fee balances", async () => {
    const params: ReceiveFee = {
      token: { fa12: fa12.contract.address },
      fee: new BigNumber(666_666),
    };

    await fa12.updateStorage({
      ledger: [auction.contract.address],
    });

    const prevFA12TokBalance: BigNumber = fa12.getBalance(
      auction.contract.address,
    );

    await fa12.transfer(alice.pkh, auction.contract.address, params.fee);
    await auction.receiveFee(params);
    await auction.updateStorage({
      dev_fee_balances_f: [params.token],
      public_fee_balances_f: [params.token],
    });
    await fa12.updateStorage({
      ledger: [auction.contract.address],
    });

    const currFA12TokBalance: BigNumber = fa12.getBalance(
      auction.contract.address,
    );
    const receiveFees: ReceiveFees = auction.calculateReceiveFees(params.fee);

    expect(currFA12TokBalance).to.be.bignumber.equal(
      prevFA12TokBalance.plus(params.fee),
    );
    expect(
      auction.storage.storage.dev_fee_balances_f[params.token.toString()],
    ).to.be.bignumber.equal(receiveFees.devFee);
    expect(
      auction.storage.storage.public_fee_balances_f[params.token.toString()],
    ).to.be.bignumber.equal(receiveFees.publicFee);
  });

  it("should receive FA2 tokens as fee and correctly update dev and public fee balances", async () => {
    const params: ReceiveFee = {
      token: { fa2: { token: fa2.contract.address, id: new BigNumber(0) } },
      fee: new BigNumber(999),
    };
    const transferParam: Transfer = {
      from_: alice.pkh,
      txs: [
        {
          to_: auction.contract.address,
          token_id: params.token["fa2"].id,
          amount: params.fee,
        },
      ],
    };

    await fa2.updateStorage({
      account_info: [auction.contract.address],
    });

    const prevFA2TokBalance: BigNumber = await fa2.getBalance(
      auction.contract.address,
      params.token["fa2"].id,
    );

    await fa2.transfer([transferParam]);
    await auction.receiveFee(params);
    await auction.updateStorage({
      dev_fee_balances_f: [params.token],
      public_fee_balances_f: [params.token],
    });
    await fa2.updateStorage({
      account_info: [auction.contract.address],
    });

    const currFA2TokBalance: BigNumber = await fa2.getBalance(
      auction.contract.address,
      params.token["fa2"].id,
    );
    const receiveFees: ReceiveFees = auction.calculateReceiveFees(params.fee);

    expect(currFA2TokBalance).to.be.bignumber.equal(
      prevFA2TokBalance.plus(params.fee),
    );
    expect(
      auction.storage.storage.dev_fee_balances_f[params.token.toString()],
    ).to.be.bignumber.equal(receiveFees.devFee);
    expect(
      auction.storage.storage.public_fee_balances_f[params.token.toString()],
    ).to.be.bignumber.equal(receiveFees.publicFee);
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const params: LaunchAuction = {
      token: { fa12: fa12Whitelisted.contract.address },
      amt: new BigNumber(0),
      bid: new BigNumber(0),
    };

    await rejects(auction.launchAuction(params, 1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should fail if token for auction is whitelisted", async () => {
    const params: LaunchAuction = {
      token: { fa12: fa12Whitelisted.contract.address },
      amt: new BigNumber(0),
      bid: new BigNumber(0),
    };

    await utils.setProvider(alice.sk);
    await rejects(auction.launchAuction(params), (err: Error) => {
      expect(err.message).to.equal(AuctionErrors.ERR_WHITELISTED_TOKEN);

      return true;
    });
  });

  it("should fail if token public fee balance is less than the number of tokens that are put up for auction", async () => {
    const params: LaunchAuction = {
      token: { tez: undefined },
      amt: new BigNumber(10_000_000),
      bid: new BigNumber(10_000),
    };

    await rejects(auction.launchAuction(params), (err: Error) => {
      expect(err.message).to.equal(AuctionErrors.ERR_INSUFFICIENT_BALANCE);

      return true;
    });
  });

  it("should fail if the first bid is less than min bid", async () => {
    const params: LaunchAuction = {
      token: { tez: undefined },
      amt: new BigNumber(5_000_000),
      bid: new BigNumber(1),
    };

    await rejects(auction.launchAuction(params), (err: Error) => {
      expect(err.message).to.equal(AuctionErrors.ERR_LOW_BID);

      return true;
    });
  });

  it("should start TEZ auction and transfer QUIPU tokens as the first bid", async () => {
    const params: LaunchAuction = {
      token: { tez: undefined },
      amt: new BigNumber(5_000_000),
      bid: new BigNumber(10),
    };
    const expectedAuctionId: BigNumber = new BigNumber(0);

    await auction.updateStorage({
      public_fee_balances_f: [params.token],
    });
    await quipuToken.updateStorage({
      account_info: [alice.pkh, auction.contract.address],
    });

    const prevPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const prevAliceQTBalance: BigNumber = await quipuToken.getBalance(
      alice.pkh,
      new BigNumber(0),
    );
    const prevAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );

    await quipuToken.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: auction.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await auction.launchAuction(params);
    await auction.updateStorage({
      auctions: [expectedAuctionId],
      public_fee_balances_f: [params.token],
    });
    await quipuToken.updateStorage({
      account_info: [alice.pkh, auction.contract.address],
    });

    const currPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const currAliceQTBalance: BigNumber = await quipuToken.getBalance(
      alice.pkh,
      new BigNumber(0),
    );
    const currAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );

    expect(auction.storage.storage.auctions_count).to.be.bignumber.equal(
      expectedAuctionId.plus(1),
    );
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].status,
    ).to.have.keys("active");
    expect(
      Date.parse(
        auction.storage.storage.auctions[expectedAuctionId.toFixed()].end_time,
      ) / 1000,
    ).to.be.lte(
      (await utils.getLastBlockTimestamp()) / 1000 +
        auction.storage.storage.auction_duration.toNumber(),
    );
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()]
        .current_bidder,
    ).to.be.equal(alice.pkh);
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].current_bid,
    ).to.be.bignumber.equal(params.bid);
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].amt,
    ).to.be.bignumber.equal(params.amt);
    expect(currPublicFeeBalance).to.be.bignumber.equal(
      prevPublicFeeBalance.minus(params.amt.multipliedBy(PRECISION)),
    );
    expect(currAliceQTBalance).to.be.bignumber.equal(
      prevAliceQTBalance.minus(params.bid),
    );
    expect(currAuctionQTBalance).to.be.bignumber.equal(
      prevAuctionQTBalance.plus(params.bid),
    );
  });

  it("should start FA1.2 auction and transfer QUIPU tokens as the first bid", async () => {
    const params: LaunchAuction = {
      token: { fa12: fa12.contract.address },
      amt: new BigNumber(100_000),
      bid: new BigNumber(20),
    };
    const expectedAuctionId: BigNumber = new BigNumber(1);

    await auction.updateStorage({
      public_fee_balances_f: [params.token],
    });
    await quipuToken.updateStorage({
      account_info: [alice.pkh, auction.contract.address],
    });

    const prevPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const prevAliceQTBalance: BigNumber = await quipuToken.getBalance(
      alice.pkh,
      new BigNumber(0),
    );
    const prevAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );

    await auction.launchAuction(params);
    await auction.updateStorage({
      auctions: [expectedAuctionId],
      public_fee_balances_f: [params.token],
    });
    await quipuToken.updateStorage({
      account_info: [alice.pkh, auction.contract.address],
    });

    const currPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const currAliceQTBalance: BigNumber = await quipuToken.getBalance(
      alice.pkh,
      new BigNumber(0),
    );
    const currAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );

    expect(auction.storage.storage.auctions_count).to.be.bignumber.equal(
      expectedAuctionId.plus(1),
    );
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].status,
    ).to.have.keys("active");
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].token,
    ).to.be.deep.equal(params.token);
    expect(
      Date.parse(
        auction.storage.storage.auctions[expectedAuctionId.toFixed()].end_time,
      ) / 1000,
    ).to.be.lte(
      (await utils.getLastBlockTimestamp()) / 1000 +
        auction.storage.storage.auction_duration.toNumber(),
    );
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()]
        .current_bidder,
    ).to.be.equal(alice.pkh);
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].current_bid,
    ).to.be.bignumber.equal(params.bid);
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].amt,
    ).to.be.bignumber.equal(params.amt);
    expect(currPublicFeeBalance).to.be.bignumber.equal(
      prevPublicFeeBalance.minus(params.amt.multipliedBy(PRECISION)),
    );
    expect(currAliceQTBalance).to.be.bignumber.equal(
      prevAliceQTBalance.minus(params.bid),
    );
    expect(currAuctionQTBalance).to.be.bignumber.equal(
      prevAuctionQTBalance.plus(params.bid),
    );
  });

  it("should start FA2 auction and transfer QUIPU tokens as the first bid", async () => {
    const params: LaunchAuction = {
      token: { fa2: { token: fa2.contract.address, id: new BigNumber(0) } },
      amt: new BigNumber(900),
      bid: new BigNumber(30),
    };
    const expectedAuctionId: BigNumber = new BigNumber(2);

    await auction.updateStorage({
      public_fee_balances_f: [params.token],
    });
    await quipuToken.updateStorage({
      account_info: [alice.pkh, auction.contract.address],
    });

    const prevPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const prevAliceQTBalance: BigNumber = await quipuToken.getBalance(
      alice.pkh,
      new BigNumber(0),
    );
    const prevAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );

    await auction.launchAuction(params);
    await auction.updateStorage({
      auctions: [expectedAuctionId],
      public_fee_balances_f: [params.token],
    });
    await quipuToken.updateStorage({
      account_info: [alice.pkh, auction.contract.address],
    });

    const currPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const currAliceQTBalance: BigNumber = await quipuToken.getBalance(
      alice.pkh,
      new BigNumber(0),
    );
    const currAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );

    expect(auction.storage.storage.auctions_count).to.be.bignumber.equal(
      expectedAuctionId.plus(1),
    );
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].status,
    ).to.have.keys("active");
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].token,
    ).to.be.deep.equal(params.token);
    expect(
      Date.parse(
        auction.storage.storage.auctions[expectedAuctionId.toFixed()].end_time,
      ) / 1000,
    ).to.be.lte(
      (await utils.getLastBlockTimestamp()) / 1000 +
        auction.storage.storage.auction_duration.toNumber(),
    );
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()]
        .current_bidder,
    ).to.be.equal(alice.pkh);
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].current_bid,
    ).to.be.bignumber.equal(params.bid);
    expect(
      auction.storage.storage.auctions[expectedAuctionId.toFixed()].amt,
    ).to.be.bignumber.equal(params.amt);
    expect(currPublicFeeBalance).to.be.bignumber.equal(
      prevPublicFeeBalance.minus(params.amt.multipliedBy(PRECISION)),
    );
    expect(currAliceQTBalance).to.be.bignumber.equal(
      prevAliceQTBalance.minus(params.bid),
    );
    expect(currAuctionQTBalance).to.be.bignumber.equal(
      prevAuctionQTBalance.plus(params.bid),
    );
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const params: PlaceBid = {
      auction_id: new BigNumber(666),
      bid: new BigNumber(0),
    };

    await rejects(auction.placeBid(params, 1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should fail if auction not found", async () => {
    const params: PlaceBid = {
      auction_id: new BigNumber(666),
      bid: new BigNumber(0),
    };

    await rejects(auction.placeBid(params), (err: Error) => {
      expect(err.message).to.equal(AuctionErrors.ERR_AUCTION_NOT_FOUND);

      return true;
    });
  });

  it("should fail if a new bid is less than or equal to current bid", async () => {
    const params: PlaceBid = {
      auction_id: new BigNumber(0),
      bid: new BigNumber(0),
    };

    await rejects(auction.placeBid(params), (err: Error) => {
      expect(err.message).to.equal(AuctionErrors.ERR_LOW_BID);

      return true;
    });
  });

  it("should make a new bid for TEZ tokens auction", async () => {
    const params: PlaceBid = {
      auction_id: new BigNumber(0),
      bid: new BigNumber(15),
    };

    await utils.setProvider(bob.sk);
    await quipuToken.updateOperators([
      {
        add_operator: {
          owner: bob.pkh,
          operator: auction.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await auction.placeBid(params);
    await auction.updateStorage({
      auctions: [params.auction_id],
    });

    expect(
      auction.storage.storage.auctions[params.auction_id.toFixed()].current_bid,
    ).to.be.bignumber.equal(params.bid);
    expect(
      auction.storage.storage.auctions[params.auction_id.toFixed()]
        .current_bidder,
    ).to.be.equal(bob.pkh);
  });

  it("should make a new bid for FA1.2 tokens auction", async () => {
    const params: PlaceBid = {
      auction_id: new BigNumber(1),
      bid: new BigNumber(21),
    };

    await auction.placeBid(params);
    await auction.updateStorage({
      auctions: [params.auction_id],
    });

    expect(
      auction.storage.storage.auctions[params.auction_id.toFixed()].current_bid,
    ).to.be.bignumber.equal(params.bid);
    expect(
      auction.storage.storage.auctions[params.auction_id.toFixed()]
        .current_bidder,
    ).to.be.equal(bob.pkh);
  });

  it("should make a new bid for FA2 tokens auction", async () => {
    const params: PlaceBid = {
      auction_id: new BigNumber(2),
      bid: new BigNumber(35),
    };

    await auction.placeBid(params);
    await auction.updateStorage({
      auctions: [params.auction_id],
    });

    expect(
      auction.storage.storage.auctions[params.auction_id.toFixed()].current_bid,
    ).to.be.bignumber.equal(params.bid);
    expect(
      auction.storage.storage.auctions[params.auction_id.toFixed()]
        .current_bidder,
    ).to.be.equal(bob.pkh);
  });

  it("should charge a bid fee from a previous bidder and refund QUIPU tokens without bid fee to him", async () => {
    const params: PlaceBid = {
      auction_id: new BigNumber(0),
      bid: new BigNumber(16),
    };

    await auction.updateStorage({
      auctions: [params.auction_id],
    });
    await quipuToken.updateStorage({
      account_info: [bob.pkh, auction.contract.address],
    });

    const currentBid: BigNumber =
      auction.storage.storage.auctions[params.auction_id.toFixed()].current_bid;
    const bidFee: BigNumber = currentBid
      .multipliedBy(auction.storage.storage.fees.bid_fee_f)
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_UP);

    const refund: BigNumber = currentBid.minus(bidFee);
    const prevBidFeeBalance: BigNumber =
      auction.storage.storage.bid_fee_balance;
    const prevBobQTBalance: BigNumber = await quipuToken.getBalance(
      bob.pkh,
      new BigNumber(0),
    );
    const prevAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );

    await utils.setProvider(alice.sk);
    await auction.placeBid(params);
    await auction.updateStorage();
    await quipuToken.updateStorage({
      account_info: [bob.pkh, auction.contract.address],
    });

    const currBidFeeBalance: BigNumber =
      auction.storage.storage.bid_fee_balance;
    const currBobQTBalance: BigNumber = await quipuToken.getBalance(
      bob.pkh,
      new BigNumber(0),
    );
    const currAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );

    expect(currBidFeeBalance).to.be.bignumber.equal(
      prevBidFeeBalance.plus(bidFee),
    );
    expect(currBobQTBalance).to.be.bignumber.equal(
      prevBobQTBalance.plus(refund),
    );
    expect(currAuctionQTBalance).to.be.bignumber.equal(
      prevAuctionQTBalance.plus(params.bid.minus(refund)),
    );
  });

  it("should charge a new bid from a new bidder", async () => {
    const params: PlaceBid = {
      auction_id: new BigNumber(0),
      bid: new BigNumber(666),
    };

    await auction.updateStorage({
      auctions: [params.auction_id],
    });
    await quipuToken.updateStorage({
      account_info: [bob.pkh, auction.contract.address],
    });

    const currentBid: BigNumber =
      auction.storage.storage.auctions[params.auction_id.toFixed()].current_bid;
    const bidFee: BigNumber = currentBid.multipliedBy(
      auction.storage.storage.fees.bid_fee_f,
    );
    const refund: BigNumber = currentBid.minus(
      bidFee.dividedBy(PRECISION).integerValue(BigNumber.ROUND_UP),
    );
    const prevBobQTBalance: BigNumber = await quipuToken.getBalance(
      bob.pkh,
      new BigNumber(0),
    );
    const prevAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );

    await utils.setProvider(bob.sk);
    await auction.placeBid(params);
    await quipuToken.updateStorage({
      account_info: [bob.pkh, auction.contract.address],
    });

    const currBobQTBalance: BigNumber = await quipuToken.getBalance(
      bob.pkh,
      new BigNumber(0),
    );
    const currAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );

    expect(currBobQTBalance).to.be.bignumber.equal(
      prevBobQTBalance.minus(params.bid),
    );
    expect(currAuctionQTBalance).to.be.bignumber.equal(
      prevAuctionQTBalance.plus(params.bid.minus(refund)),
    );
  });
  it("should charge a new bid with extension auction", async () => {
    const params: PlaceBid = {
      auction_id: new BigNumber(0),
      bid: new BigNumber(777),
    };

    await auction.updateStorage({
      auctions: [params.auction_id],
    });
    await quipuToken.updateStorage({
      account_info: [bob.pkh, auction.contract.address],
    });

    const currentBid: BigNumber =
      auction.storage.storage.auctions[params.auction_id.toFixed()].current_bid;
    const bidFee: BigNumber = currentBid
      .multipliedBy(auction.storage.storage.fees.bid_fee_f)
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_UP);

    const refund: BigNumber = currentBid.minus(bidFee);
    const prevBidFeeBalance: BigNumber =
      auction.storage.storage.bid_fee_balance;
    const prevBobQTBalance: BigNumber = await quipuToken.getBalance(
      bob.pkh,
      new BigNumber(0),
    );
    const prevAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );
    const prevAuction =
      auction.storage.storage.auctions[params.auction_id.toFixed()];
    await utils.setProvider(alice.sk);
    await auction.placeBid(params);
    await utils.setProvider(bob.sk);
    await auction.updateStorage({
      auctions: [params.auction_id],
    });
    await quipuToken.updateStorage({
      account_info: [bob.pkh, auction.contract.address],
    });

    const currBidFeeBalance: BigNumber =
      auction.storage.storage.bid_fee_balance;
    const currBobQTBalance: BigNumber = await quipuToken.getBalance(
      bob.pkh,
      new BigNumber(0),
    );
    const currAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );
    const updatedAuction =
      auction.storage.storage.auctions[params.auction_id.toFixed()];
    expect(currBidFeeBalance).to.be.bignumber.equal(
      prevBidFeeBalance.plus(bidFee),
    );
    expect(currBobQTBalance).to.be.bignumber.equal(
      prevBobQTBalance.plus(refund),
    );
    expect(currAuctionQTBalance).to.be.bignumber.equal(
      prevAuctionQTBalance.plus(params.bid.minus(refund)),
    );
    expect(updatedAuction.end_time.toString()).to.equal(
      (prevAuction.end_time + auction.storage.storage.auction_extension)
        .toString()
        .slice(0, -3),
    );
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await rejects(auction.claim(new BigNumber(666), 1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should fail if auction not found", async () => {
    await rejects(auction.claim(new BigNumber(666)), (err: Error) => {
      expect(err.message).to.equal(AuctionErrors.ERR_AUCTION_NOT_FOUND);

      return true;
    });
  });

  it("should fail if auction is not finished", async () => {
    await rejects(auction.claim(new BigNumber(0)), (err: Error) => {
      expect(err.message).to.equal(AuctionErrors.ERR_AUCTION_NOT_FINISHED);

      return true;
    });
  });

  it("should fail if not admin is trying to withdraw dev fee", async () => {
    const params: WithdrawFee = {
      token: { tez: undefined },
      receiver: alice.pkh,
    };

    await rejects(auction.withdrawDevFee(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const params: WithdrawFee = {
      token: { tez: undefined },
      receiver: alice.pkh,
    };

    await utils.setProvider(alice.sk);
    await rejects(auction.withdrawDevFee(params, 1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should withdraw TEZ dev fee by admin", async () => {
    const params: WithdrawFee = {
      token: { tez: undefined },
      receiver: bob.pkh,
    };

    await auction.updateStorage({
      dev_fee_balances_f: [params.token],
    });

    const prevTokDevFeeBalance: BigNumber =
      auction.storage.storage.dev_fee_balances_f[params.token.toString()];
    const prevTokReceiverBalance: BigNumber = await utils.tezos.tz.getBalance(
      params.receiver,
    );

    await auction.withdrawDevFee(params);
    await auction.updateStorage({
      dev_fee_balances_f: [params.token],
    });

    const currTokDevFeeBalance: BigNumber =
      auction.storage.storage.dev_fee_balances_f[params.token.toString()];
    const currTokReceiverBalance: BigNumber = await utils.tezos.tz.getBalance(
      params.receiver,
    );

    expect(currTokDevFeeBalance).to.be.bignumber.equal(
      prevTokDevFeeBalance.minus(
        prevTokDevFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN)
          .multipliedBy(PRECISION),
      ),
    );
    expect(currTokReceiverBalance).to.be.bignumber.equal(
      prevTokReceiverBalance.plus(
        prevTokDevFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN),
      ),
    );
  });

  it("should withdraw FA1.2 dev fee by admin", async () => {
    const params: WithdrawFee = {
      token: { fa12: fa12.contract.address },
      receiver: alice.pkh,
    };

    await auction.updateStorage({
      dev_fee_balances_f: [params.token],
    });
    await fa12.updateStorage({
      ledger: [params.receiver],
    });

    const prevTokDevFeeBalance: BigNumber =
      auction.storage.storage.dev_fee_balances_f[params.token.toString()];
    const prevTokReceiverBalance: BigNumber = fa12.getBalance(params.receiver);

    await auction.withdrawDevFee(params);
    await auction.updateStorage({
      dev_fee_balances_f: [params.token],
    });
    await fa12.updateStorage({
      ledger: [params.receiver],
    });

    const currTokDevFeeBalance: BigNumber =
      auction.storage.storage.dev_fee_balances_f[params.token.toString()];
    const currTokReceiverBalance: BigNumber = fa12.getBalance(params.receiver);

    expect(currTokDevFeeBalance).to.be.bignumber.equal(
      prevTokDevFeeBalance.minus(
        prevTokDevFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN)
          .multipliedBy(PRECISION),
      ),
    );
    expect(currTokReceiverBalance).to.be.bignumber.equal(
      prevTokReceiverBalance.plus(
        prevTokDevFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN),
      ),
    );
  });

  it("should withdraw FA2 dev fee by admin", async () => {
    const params: WithdrawFee = {
      token: { fa2: { token: fa2.contract.address, id: new BigNumber(0) } },
      receiver: alice.pkh,
    };

    await auction.updateStorage({
      dev_fee_balances_f: [params.token],
    });
    await fa2.updateStorage({
      account_info: [params.receiver],
    });

    const prevTokDevFeeBalance: BigNumber =
      auction.storage.storage.dev_fee_balances_f[params.token.toString()];
    const prevTokReceiverBalance: BigNumber = await fa2.getBalance(
      params.receiver,
    );

    await auction.withdrawDevFee(params);
    await auction.updateStorage({
      dev_fee_balances_f: [params.token],
    });
    await fa2.updateStorage({
      account_info: [params.receiver],
    });

    const currTokDevFeeBalance: BigNumber =
      auction.storage.storage.dev_fee_balances_f[params.token.toString()];
    const currTokReceiverBalance: BigNumber = await fa2.getBalance(
      params.receiver,
    );

    expect(currTokDevFeeBalance).to.be.bignumber.equal(
      prevTokDevFeeBalance.minus(
        prevTokDevFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN)
          .multipliedBy(PRECISION),
      ),
    );
    expect(currTokReceiverBalance).to.be.bignumber.equal(
      prevTokReceiverBalance.plus(
        prevTokDevFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN),
      ),
    );
  });

  it("should fail if not admin is trying to withdraw public fee", async () => {
    const params: WithdrawFee = {
      token: { tez: undefined },
      receiver: alice.pkh,
    };

    await utils.setProvider(bob.sk);
    await rejects(auction.withdrawPublicFee(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    const params: WithdrawFee = {
      token: { tez: undefined },
      receiver: alice.pkh,
    };

    await utils.setProvider(alice.sk);
    await rejects(auction.withdrawPublicFee(params, 1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should fail if admin is trying to withdraw not whitelisted token", async () => {
    const params: WithdrawFee = {
      token: { tez: undefined },
      receiver: bob.pkh,
    };

    await rejects(auction.withdrawPublicFee(params), (err: Error) => {
      expect(err.message).to.equal(AuctionErrors.ERR_NOT_WHITELISTED_TOKEN);

      return true;
    });
  });

  it("should withdraw TEZ public fee by admin", async () => {
    const token: Token = { tez: undefined };
    const updateWhitelistParams: UpdateWhitelist = {
      token: token,
      add: true,
    };

    await auction.updateWhitelist(updateWhitelistParams);

    const params: WithdrawFee = {
      token: token,
      receiver: bob.pkh,
    };

    await auction.updateStorage({
      public_fee_balances_f: [params.token],
    });

    const prevTokPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const prevTokReceiverBalance: BigNumber = await utils.tezos.tz.getBalance(
      params.receiver,
    );

    await auction.withdrawPublicFee(params);
    await auction.updateStorage({
      public_fee_balances_f: [params.token],
    });

    const currTokPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const currTokReceiverBalance: BigNumber = await utils.tezos.tz.getBalance(
      params.receiver,
    );

    expect(currTokPublicFeeBalance).to.be.bignumber.equal(
      prevTokPublicFeeBalance.minus(
        prevTokPublicFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN)
          .multipliedBy(PRECISION),
      ),
    );
    expect(currTokReceiverBalance).to.be.bignumber.equal(
      prevTokReceiverBalance.plus(
        prevTokPublicFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_UP),
      ),
    );
  });

  it("should withdraw FA1.2 public fee by admin", async () => {
    const token: Token = { fa12: fa12.contract.address };
    const updateWhitelistParams: UpdateWhitelist = {
      token: token,
      add: true,
    };

    await auction.updateWhitelist(updateWhitelistParams);

    const params: WithdrawFee = {
      token: token,
      receiver: alice.pkh,
    };

    await auction.updateStorage({
      public_fee_balances_f: [params.token],
    });
    await fa12.updateStorage({
      ledger: [params.receiver],
    });

    const prevTokPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const prevTokReceiverBalance: BigNumber = fa12.getBalance(params.receiver);

    await auction.withdrawPublicFee(params);
    await auction.updateStorage({
      public_fee_balances_f: [params.token],
    });
    await fa12.updateStorage({
      ledger: [params.receiver],
    });

    const currTokPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const currTokReceiverBalance: BigNumber = fa12.getBalance(params.receiver);

    expect(currTokPublicFeeBalance).to.be.bignumber.equal(
      prevTokPublicFeeBalance.minus(
        prevTokPublicFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN)
          .multipliedBy(PRECISION),
      ),
    );
    expect(currTokReceiverBalance).to.be.bignumber.equal(
      prevTokReceiverBalance.plus(
        prevTokPublicFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN),
      ),
    );
  });

  it("should withdraw FA2 public fee by admin", async () => {
    const token: Token = {
      fa2: { token: fa2.contract.address, id: new BigNumber(0) },
    };
    const updateWhitelistParams: UpdateWhitelist = {
      token: token,
      add: true,
    };

    await auction.updateWhitelist(updateWhitelistParams);

    const params: WithdrawFee = {
      token: token,
      receiver: alice.pkh,
    };

    await auction.updateStorage({
      public_fee_balances_f: [params.token],
    });
    await fa2.updateStorage({
      account_info: [params.receiver],
    });

    const prevTokPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const prevTokReceiverBalance: BigNumber = await fa2.getBalance(
      params.receiver,
    );

    await auction.withdrawPublicFee(params);
    await auction.updateStorage({
      public_fee_balances_f: [params.token],
    });
    await fa2.updateStorage({
      account_info: [params.receiver],
    });

    const currTokPublicFeeBalance: BigNumber =
      auction.storage.storage.public_fee_balances_f[params.token.toString()];
    const currTokReceiverBalance: BigNumber = await fa2.getBalance(
      params.receiver,
    );

    expect(currTokPublicFeeBalance).to.be.bignumber.equal(
      prevTokPublicFeeBalance.minus(
        prevTokPublicFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN)
          .multipliedBy(PRECISION),
      ),
    );
    expect(currTokReceiverBalance).to.be.bignumber.equal(
      prevTokReceiverBalance.plus(
        prevTokPublicFeeBalance
          .dividedBy(PRECISION)
          .integerValue(BigNumber.ROUND_DOWN),
      ),
    );
  });

  it("should fail if not admin is trying to withdraw bid fee", async () => {
    await utils.setProvider(bob.sk);
    await rejects(auction.withdrawBidFee(), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_ADMIN);

      return true;
    });
  });

  it("should fail if positive TEZ tokens amount were passed", async () => {
    await utils.setProvider(alice.sk);
    await rejects(auction.withdrawBidFee(1), (err: Error) => {
      expect(err.message).to.be.equal(Common.ERR_NON_PAYABLE_ENTRYPOINT);

      return true;
    });
  });

  it("should withdraw bid fee by admin", async () => {
    await auction.updateStorage();
    await quipuToken.updateStorage({
      account_info: [auction.contract.address, zeroAddress],
    });

    const prevBidFeeBalance: BigNumber =
      auction.storage.storage.bid_fee_balance;
    const prevAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );
    const prevZeroAddressQTBalance: BigNumber = await quipuToken.getBalance(
      zeroAddress,
      new BigNumber(0),
    );

    await auction.withdrawBidFee();
    await auction.updateStorage();
    await quipuToken.updateStorage({
      account_info: [auction.contract.address, zeroAddress],
    });

    const currBidFeeBalance: BigNumber =
      auction.storage.storage.bid_fee_balance;
    const currAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
      new BigNumber(0),
    );
    const currZeroAddressQTBalance: BigNumber = await quipuToken.getBalance(
      zeroAddress,
      new BigNumber(0),
    );

    expect(currBidFeeBalance).to.be.bignumber.equal(0);
    expect(currAuctionQTBalance).to.be.bignumber.equal(
      prevAuctionQTBalance.minus(prevBidFeeBalance),
    );
    expect(currZeroAddressQTBalance).to.be.bignumber.equal(
      prevZeroAddressQTBalance.plus(prevBidFeeBalance),
    );
  });

  it("should fail if auction is finished", async () => {
    const params: PlaceBid = {
      auction_id: new BigNumber(0),
      bid: new BigNumber(0),
    };

    await rejects(auction.placeBid(params), (err: Error) => {
      expect(err.message).to.equal(AuctionErrors.ERR_AUCTION_FINISHED);

      return true;
    });
  });

  it("should burn current bid, transfer claimed tokens to user and change auction status to `finished`", async () => {
    const auctionId: BigNumber = new BigNumber(1);

    await auction.updateStorage({
      auctions: [auctionId],
    });
    await quipuToken.updateStorage({
      account_info: [auction.contract.address, zeroAddress],
    });
    await fa12.updateStorage({
      ledger: [
        auction.contract.address,
        auction.storage.storage.auctions[auctionId.toFixed()].current_bidder,
      ],
    });

    const prevAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
    );
    const prevZeroAddressQTBalance: BigNumber = await quipuToken.getBalance(
      zeroAddress,
    );
    const prevTokAuctionBalance: BigNumber = fa12.getBalance(
      auction.contract.address,
    );
    const prevTokReceiverBalance: BigNumber = fa12.getBalance(
      auction.storage.storage.auctions[auctionId.toFixed()].current_bidder,
    );

    await auction.claim(auctionId);
    await auction.updateStorage({
      auctions: [auctionId],
    });
    await quipuToken.updateStorage({
      account_info: [auction.contract.address, zeroAddress],
    });
    await fa12.updateStorage({
      ledger: [
        auction.contract.address,
        auction.storage.storage.auctions[auctionId.toFixed()].current_bidder,
      ],
    });

    const currAuctionQTBalance: BigNumber = await quipuToken.getBalance(
      auction.contract.address,
    );
    const currZeroAddressQTBalance: BigNumber = await quipuToken.getBalance(
      zeroAddress,
    );
    const currTokAuctionBalance: BigNumber = fa12.getBalance(
      auction.contract.address,
    );
    const currTokReceiverBalance: BigNumber = fa12.getBalance(
      auction.storage.storage.auctions[auctionId.toFixed()].current_bidder,
    );

    expect(currAuctionQTBalance).to.be.bignumber.equal(
      prevAuctionQTBalance.minus(
        auction.storage.storage.auctions[auctionId.toFixed()].current_bid,
      ),
    );
    expect(currZeroAddressQTBalance).to.be.bignumber.equal(
      prevZeroAddressQTBalance.plus(
        auction.storage.storage.auctions[auctionId.toFixed()].current_bid,
      ),
    );
    expect(currTokAuctionBalance).to.be.bignumber.equal(
      prevTokAuctionBalance.minus(
        auction.storage.storage.auctions[auctionId.toFixed()].amt,
      ),
    );
    expect(currTokReceiverBalance).to.be.bignumber.equal(
      prevTokReceiverBalance.plus(
        auction.storage.storage.auctions[auctionId.toFixed()].amt,
      ),
    );
    expect(
      auction.storage.storage.auctions[auctionId.toFixed()].status,
    ).to.has.keys("finished");
  });

  it("should fail if auction status is `finished`", async () => {
    await rejects(auction.claim(new BigNumber(1)), (err: Error) => {
      expect(err.message).to.equal(AuctionErrors.ERR_AUCTION_FINISHED);

      return true;
    });
  });
});
