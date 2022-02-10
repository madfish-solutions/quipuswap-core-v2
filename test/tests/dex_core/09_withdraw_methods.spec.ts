import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { PRECISION } from "../../helpers/Constants";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
import { FA12 } from "../../helpers/FA12";
import { FA2 } from "../../helpers/FA2";
import {
  defaultCollectingPeriod,
  defaultCycleDuration,
  defaultVotingPeriod,
  Utils,
} from "../../helpers/Utils";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { auctionStorage } from "../../../storage/Auction";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";
import { fa2Storage } from "../../../storage/test/FA2";

import { ClaimTokFee, LaunchExchange, Swap } from "test/types/DexCore";
import { SBAccount, Token } from "test/types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (withdraw methods)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore2: DexCore;
  var auction: Auction;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa2Token1: FA2;
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
    dexCoreStorage.storage.cycle_duration = defaultCycleDuration;
    dexCoreStorage.storage.voting_period = defaultVotingPeriod;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;
    dexCoreStorage.storage.fees = {
      interface_fee: new BigNumber(0.25).multipliedBy(PRECISION),
      swap_fee: new BigNumber(0.0005).multipliedBy(PRECISION),
      auction_fee: new BigNumber(0.0005).multipliedBy(PRECISION),
      withdraw_fee_reward: new BigNumber(0.0005).multipliedBy(PRECISION),
    };

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    dexCoreStorage.storage.entered = true;

    dexCore2 = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();
    await dexCore2.setLambdas();

    fa12Token1 = await FA12.originate(utils.tezos, fa12Storage);
    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = dexCore.contract.address;
    auctionStorage.storage.quipu_token = fa2Token1.contract.address;

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();

    const launchParams: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(5_000_000),
      token_b_in: new BigNumber(5_000_000),
      shares_receiver: alice.pkh,
      candidate: bob.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: launchParams.pair.token_b["fa2"].id,
        },
      },
    ]);
    await dexCore.launchExchange(launchParams);
  });

  it("should fail if reentrancy", async () => {
    const claimParams: ClaimTokFee = {
      token: { fa12: fa12Token1.contract.address },
      receiver: alice.pkh,
      amount: new BigNumber(0),
    };

    await rejects(dexCore2.claimTokInterfaceFee(claimParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if insufficient interface fee balance - 1", async () => {
    const claimParams: ClaimTokFee = {
      token: { fa12: fa12Token1.contract.address },
      receiver: alice.pkh,
      amount: new BigNumber(1),
    };

    await rejects(dexCore.claimTokInterfaceFee(claimParams), (err: Error) => {
      expect(err.message).to.equal(
        DexCoreErrors.ERR_INSUFFICIENT_INTERFACE_FEE_BALANCE
      );

      return true;
    });
  });

  it("should fail if insufficient interface fee balance - 2", async () => {
    const token: Token = { fa12: fa12Token1.contract.address };
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(333),
      min_amount_out: new BigNumber(0),
    };

    await fa12Token1.approve(dexCore.contract.address, swapParams.amount_in);
    await dexCore.swap(swapParams);
    await dexCore.updateStorage({
      tok_interface_fee: [[token, swapParams.referrer]],
    });

    const availableInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token.toString()},${swapParams.referrer}`
      ]
        .dividedBy(PRECISION)
        .integerValue(BigNumber.ROUND_FLOOR);
    const claimParams: ClaimTokFee = {
      token: { fa12: fa12Token1.contract.address },
      receiver: alice.pkh,
      amount: availableInterfaceFee.plus(1),
    };

    await utils.setProvider(bob.sk);
    await rejects(dexCore.claimTokInterfaceFee(claimParams), (err: Error) => {
      expect(err.message).to.equal(
        DexCoreErrors.ERR_INSUFFICIENT_INTERFACE_FEE_BALANCE
      );

      return true;
    });
  });

  it("should claim interface fee and transfer it to a receiver - 1", async () => {
    const token: Token = { fa12: fa12Token1.contract.address };
    const receiver: string = carol.pkh;
    const referrer: string = bob.pkh;

    await dexCore.updateStorage({
      tok_interface_fee: [[token, referrer]],
    });
    await fa12Token1.updateStorage({
      ledger: [receiver, dexCore.contract.address],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token.toString()},${referrer}`
      ];
    const prevTokReceiverBalance: BigNumber = fa12Token1.getBalance(receiver);
    const prevTokDexCoreBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const claimParams: ClaimTokFee = {
      token: { fa12: fa12Token1.contract.address },
      receiver: receiver,
      amount: new BigNumber(25),
    };

    await dexCore.claimTokInterfaceFee(claimParams);
    await dexCore.updateStorage({
      tok_interface_fee: [[token, referrer]],
    });
    await fa12Token1.updateStorage({
      ledger: [receiver, dexCore.contract.address],
    });

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token.toString()},${referrer}`
      ];
    const currTokReceiverBalance: BigNumber = fa12Token1.getBalance(receiver);
    const currTokDexCoreBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.minus(claimParams.amount.multipliedBy(PRECISION))
    );
    expect(currTokReceiverBalance).to.be.bignumber.equal(
      prevTokReceiverBalance.plus(claimParams.amount)
    );
    expect(currTokDexCoreBalance).to.be.bignumber.equal(
      prevTokDexCoreBalance.minus(claimParams.amount)
    );
  });

  it("should claim interface fee and transfer it to a receiver - 2", async () => {
    const token: Token = { fa12: fa12Token1.contract.address };
    const receiver: string = alice.pkh;
    const referrer: string = bob.pkh;

    await dexCore.updateStorage({
      tok_interface_fee: [[token, referrer]],
    });
    await fa12Token1.updateStorage({
      ledger: [receiver, dexCore.contract.address],
    });

    const prevInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token.toString()},${referrer}`
      ];
    const prevTokReceiverBalance: BigNumber = fa12Token1.getBalance(receiver);
    const prevTokDexCoreBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const claimParams: ClaimTokFee = {
      token: { fa12: fa12Token1.contract.address },
      receiver: receiver,
      amount: prevInterfaceFee
        .dividedBy(PRECISION)
        .integerValue(BigNumber.ROUND_FLOOR),
    };

    await dexCore.claimTokInterfaceFee(claimParams);
    await dexCore.updateStorage({
      tok_interface_fee: [[token, referrer]],
    });
    await fa12Token1.updateStorage({
      ledger: [receiver, dexCore.contract.address],
    });

    const currInterfaceFee: BigNumber =
      dexCore.storage.storage.tok_interface_fee[
        `${token.toString()},${referrer}`
      ];
    const currTokReceiverBalance: BigNumber = fa12Token1.getBalance(receiver);
    const currTokDexCoreBalance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );

    expect(currInterfaceFee).to.be.bignumber.equal(
      prevInterfaceFee.minus(claimParams.amount.multipliedBy(PRECISION))
    );
    expect(currTokReceiverBalance).to.be.bignumber.equal(
      prevTokReceiverBalance.plus(claimParams.amount)
    );
    expect(currTokDexCoreBalance).to.be.bignumber.equal(
      prevTokDexCoreBalance.minus(claimParams.amount)
    );
  });
});
