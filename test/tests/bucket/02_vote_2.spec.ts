import { BakerRegistry } from "../../helpers/BakerRegistry";
import { zeroAddress, Utils } from "../../helpers/Utils";
import { DexCore } from "../../helpers/DexCore";
import { Bucket } from "../../helpers/Bucket";
import { FA2 } from "../../helpers/FA2";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa2Storage } from "../../../storage/test/FA2";

import { Baker, User } from "../../types/Bucket";
import { SBAccount } from "../../types/Common";
import {
  InvestLiquidity,
  LaunchExchange,
  RequiredTokens,
  Pair,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("Bucket (vote - 2)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore: DexCore;
  var fa2Token1: FA2;
  var fa2Token2: FA2;
  var bucket: Bucket;
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

    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);
    fa2Token2 = await FA2.originate(utils.tezos, fa2Storage);

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = new BigNumber(100);
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();

    const sharesReceiver: string = alice.pkh;
    let launchParams: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(50),
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );

    launchParams = {
      pair: {
        token_a: {
          fa2: { token: fa2Token2.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(50),
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa2Token2.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );
  });

  it("should change next candidate to the `zero_address` if next candidate is banned", async () => {
    const pairId: BigNumber = new BigNumber(0);

    await dexCore.updateStorage({
      pairs: [pairId],
    });
    await utils.setProvider(alice.sk);
    await dexCore.ban({
      pair_id: pairId,
      ban_params: { baker: bob.pkh, ban_period: new BigNumber(10) },
    });

    const sharesReceiver: string = bob.pkh;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(10);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      utils.tezos
    );

    await bucket.updateStorage({
      bakers: [investParams.candidate],
    });

    const initialBakerAliceInfo: Baker =
      bucket.storage.bakers[investParams.candidate];

    await utils.setProvider(bob.sk);
    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: bob.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await dexCore.investLiquidity(
      investParams,
      requiredTokens.tokens_b_required.toNumber()
    );
    await bucket.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    expect(bucket.storage.users[sharesReceiver].candidate).to.be.equal(
      investParams.candidate
    );
    expect(bucket.storage.users[sharesReceiver].votes).to.be.bignumber.equal(
      shares
    );
    expect(
      bucket.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerAliceInfo.votes.plus(shares));
    expect(bucket.storage.previous_delegated).to.be.equal(alice.pkh);
    expect(bucket.storage.current_delegated).to.be.equal(alice.pkh);
    expect(bucket.storage.next_candidate).to.be.equal(zeroAddress);
    expect(await utils.tezos.rpc.getDelegate(bucket.contract.address)).to.equal(
      alice.pkh
    );
  });

  it("should remove delegate and set current delegated to the `zero_address` if current delegated is banned", async () => {
    const pairId: BigNumber = new BigNumber(0);

    await utils.setProvider(alice.sk);
    await dexCore.ban({
      pair_id: pairId,
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(10) },
    });

    const sharesReceiver: string = alice.pkh;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(10);
    const requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    const investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await bucket.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    const initialVoterAliceInfo: User = bucket.storage.users[alice.pkh];
    const initialBakerAliceInfo: Baker = bucket.storage.bakers[alice.pkh];

    await dexCore.investLiquidity(
      investParams,
      requiredTokens.tokens_b_required.toNumber()
    );
    await bucket.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    expect(bucket.storage.users[sharesReceiver].candidate).to.be.equal(
      investParams.candidate
    );
    expect(bucket.storage.users[sharesReceiver].votes).to.be.bignumber.equal(
      initialVoterAliceInfo.votes.plus(shares)
    );
    expect(
      bucket.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerAliceInfo.votes.plus(shares));
    expect(bucket.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(bucket.storage.current_delegated).to.be.equal(zeroAddress);
    expect(bucket.storage.next_candidate).to.be.equal(zeroAddress);
    expect(await utils.tezos.rpc.getDelegate(bucket.contract.address)).to.equal(
      null
    );
  });

  it("should vote for next candidate if current delegated is banned and next candidate isn't `zero_address`", async () => {
    const pairId: BigNumber = new BigNumber(1);

    await dexCore.updateStorage({
      pairs: [pairId],
    });

    const sharesReceiver: string = bob.pkh;
    const shares: BigNumber = new BigNumber(10);
    let prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    let requiredTokens: RequiredTokens = DexCore.getRequiredTokens(
      shares,
      prevPair
    );
    let investParams: InvestLiquidity = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await utils.setProvider(bob.sk);
    await fa2Token2.updateOperators([
      {
        add_operator: {
          owner: bob.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await dexCore.investLiquidity(
      investParams,
      requiredTokens.tokens_b_required.toNumber()
    );

    bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      utils.tezos
    );

    await bucket.updateStorage();

    expect(bucket.storage.current_delegated).to.be.equal(alice.pkh);
    expect(bucket.storage.next_candidate).to.be.equal(bob.pkh);

    await utils.setProvider(alice.sk);
    await dexCore.ban({
      pair_id: pairId,
      ban_params: { baker: alice.pkh, ban_period: new BigNumber(10) },
    });
    await bucket.updateStorage({
      bakers: [investParams.candidate],
    });

    const initialBakerBobInfo: Baker =
      bucket.storage.bakers[investParams.candidate];

    await dexCore.updateStorage({
      pairs: [pairId],
    });

    prevPair = dexCore.storage.storage.pairs[pairId.toFixed()];
    requiredTokens = DexCore.getRequiredTokens(shares, prevPair);
    investParams = {
      pair_id: pairId,
      token_a_in: requiredTokens.tokens_a_required,
      token_b_in: requiredTokens.tokens_b_required,
      shares: shares,
      shares_receiver: sharesReceiver,
      candidate: bob.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await utils.setProvider(bob.sk);
    await fa2Token2.updateOperators([
      {
        add_operator: {
          owner: bob.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ]);
    await dexCore.investLiquidity(
      investParams,
      requiredTokens.tokens_b_required.toNumber()
    );
    await bucket.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    expect(bucket.storage.users[sharesReceiver].candidate).to.be.equal(
      investParams.candidate
    );
    expect(bucket.storage.users[sharesReceiver].votes).to.be.bignumber.equal(
      shares.multipliedBy(2)
    );
    expect(
      bucket.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerBobInfo.votes.plus(shares));
    expect(bucket.storage.previous_delegated).to.be.equal(bob.pkh);
    expect(bucket.storage.current_delegated).to.be.equal(bob.pkh);
    expect(bucket.storage.next_candidate).to.be.equal(zeroAddress);
    expect(await utils.tezos.rpc.getDelegate(bucket.contract.address)).to.equal(
      bob.pkh
    );
  });
});
