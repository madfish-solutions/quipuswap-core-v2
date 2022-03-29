import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { Auction } from "../../helpers/Auction";
import { DexCore } from "../../helpers/DexCore";
import { Bucket } from "../../helpers/Bucket";
import { FA12 } from "../../helpers/FA12";
import { FA2 } from "../../helpers/FA2";
import {
  defaultCollectingPeriod,
  defaultCycleDuration,
  defaultVotingPeriod,
  zeroAddress,
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

import { LaunchExchange, DexVote } from "../../types/DexCore";
import { SBAccount } from "../../types/Common";
import { User } from "../../types/Bucket";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (vote)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore2: DexCore;
  var auction: Auction;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa2Token1: FA2;
  var fa2Token2: FA2;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.cycle_duration = defaultCycleDuration;
    dexCoreStorage.storage.voting_period = defaultVotingPeriod;
    dexCoreStorage.storage.collecting_period = defaultCollectingPeriod;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    dexCoreStorage.storage.entered = true;

    dexCore2 = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();
    await dexCore2.setLambdas();

    fa12Token1 = await FA12.originate(utils.tezos, fa12Storage);
    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);
    fa2Token2 = await FA2.originate(utils.tezos, fa2Storage);

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = dexCore.contract.address;
    auctionStorage.storage.quipu_token = fa2Token1.contract.address;

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();

    let launchParams: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );

    launchParams = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: {
          fa2: { token: fa2Token2.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    launchParams = DexCore.changeTokensOrderInPair(launchParams, false);

    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: launchParams.pair.token_a["fa2"].id,
        },
      },
    ]);
    await fa2Token2.updateOperators([
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
    const voteParams: DexVote = {
      pair_id: new BigNumber(0),
      candidate: alice.pkh,
    };

    await rejects(dexCore2.vote(voteParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if pair not listed", async () => {
    const voteParams: DexVote = {
      pair_id: new BigNumber(666),
      candidate: alice.pkh,
    };

    await rejects(dexCore.vote(voteParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);

      return true;
    });
  });

  it("should fail if voter balance is negative", async () => {
    const voteParams: DexVote = {
      pair_id: new BigNumber(0),
      candidate: bob.pkh,
    };

    await utils.setProvider(bob.sk);
    await rejects(dexCore.vote(voteParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_CAN_NOT_PERFORM_VOTING);

      return true;
    });
  });

  it("should fail if pair does not have bucket contract (not TOK/TEZ pair)", async () => {
    const voteParams: DexVote = {
      pair_id: new BigNumber(1),
      candidate: bob.pkh,
    };

    await utils.setProvider(alice.sk);
    await rejects(dexCore.vote(voteParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_BUCKET_404);

      return true;
    });
  });

  it("should vote", async () => {
    const voteParams: DexVote = {
      pair_id: new BigNumber(0),
      candidate: bob.pkh,
    };

    await dexCore.updateStorage({
      pairs: [voteParams.pair_id],
    });

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[voteParams.pair_id.toFixed()].bucket,
      dexCore.tezos
    );

    await bucket.updateStorage({
      users: [alice.pkh],
    });

    const initialVoterAliceInfo: User = bucket.storage.users[alice.pkh];

    await dexCore.vote(voteParams);
    await bucket.updateStorage({
      users: [alice.pkh],
      bakers: [bob.pkh],
    });

    expect(bucket.storage.users[alice.pkh].candidate).to.be.equal(
      voteParams.candidate
    );
    expect(bucket.storage.users[alice.pkh].votes).to.be.bignumber.equal(
      initialVoterAliceInfo.votes
    );
    expect(
      bucket.storage.bakers[voteParams.candidate].votes
    ).to.be.bignumber.equal(100_000);
    expect(bucket.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(bucket.storage.current_delegated).to.be.equal(bob.pkh);
    expect(bucket.storage.next_candidate).to.be.equal(alice.pkh);
    expect(await utils.tezos.rpc.getDelegate(bucket.contract.address)).to.equal(
      null
    );
  });
});
