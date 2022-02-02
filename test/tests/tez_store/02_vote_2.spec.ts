import { BakerRegistry } from "../../helpers/BakerRegistry";
import { zeroAddress, Utils } from "../../helpers/Utils";
import { TezStore } from "../../helpers/TezStore";
import { DexCore } from "../../helpers/DexCore";
import { FA2 } from "../../helpers/FA2";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa2Storage } from "../../../storage/test/FA2";

import { Baker, User } from "test/types/TezStore";
import { SBAccount } from "test/types/Common";
import {
  InvestLiquidity,
  LaunchExchange,
  RequiredTokens,
  Pair,
} from "test/types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("TezStore (vote - 2)", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;
  var tezStore: TezStore;
  var dexCore: DexCore;
  var fa2Token1: FA2;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;

  var pairId: BigNumber = new BigNumber(0);

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);

    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = new BigNumber(100);
    dexCoreStorage.storage.cycle_duration = new BigNumber(1);
    dexCoreStorage.storage.voting_period = new BigNumber(1);
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();
  });

  it("should validate and set a new delegate if voting can be done and current delegated was changed - 1", async () => {
    const sharesReceiver: string = alice.pkh;
    const launchParams: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(50),
      shares_receiver: sharesReceiver,
      candidate: bob.pkh,
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
    await dexCore.updateStorage({
      pairs: [pairId],
    });

    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(50);
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
    };

    await utils.bakeBlocks(1);
    await dexCore.investLiquidity(
      investParams,
      requiredTokens.tokens_b_required.toNumber()
    );

    tezStore = await TezStore.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store,
      dexCore.tezos
    );

    await tezStore.updateStorage({
      users: [sharesReceiver],
      bakers: [launchParams.candidate],
    });

    expect(tezStore.storage.users[sharesReceiver].candidate).to.be.equal(
      launchParams.candidate
    );
    expect(tezStore.storage.users[sharesReceiver].votes).to.be.bignumber.equal(
      new BigNumber(100)
    );
    expect(
      tezStore.storage.bakers[launchParams.candidate].votes
    ).to.be.bignumber.equal(new BigNumber(100));
    expect(tezStore.storage.previous_delegated).to.be.equal(
      launchParams.candidate
    );
    expect(tezStore.storage.current_delegated).to.be.equal(
      launchParams.candidate
    );
    expect(tezStore.storage.next_candidate).to.be.equal(zeroAddress);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(launchParams.candidate);
  });

  it("should validate and set a new delegate if voting can be done and current delegated was changed - 2", async () => {
    const sharesReceiver: string = bob.pkh;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(200);
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
    };

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
    await tezStore.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    expect(tezStore.storage.users[sharesReceiver].candidate).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.users[sharesReceiver].votes).to.be.bignumber.equal(
      shares
    );
    expect(
      tezStore.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(shares);
    expect(tezStore.storage.previous_delegated).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.current_delegated).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.next_candidate).to.be.equal(bob.pkh);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(investParams.candidate);
  });

  it("should change next candidate to the `zero_address` if voting can be done and next candidate is banned", async () => {
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
      candidate: alice.pkh,
    };

    await tezStore.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    const initialVoterBobInfo: User = tezStore.storage.users[bob.pkh];
    const initialBakerAliceInfo: Baker = tezStore.storage.bakers[alice.pkh];

    await utils.setProvider(bob.sk);
    await dexCore.investLiquidity(
      investParams,
      requiredTokens.tokens_b_required.toNumber()
    );
    await tezStore.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    expect(tezStore.storage.users[sharesReceiver].candidate).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.users[sharesReceiver].votes).to.be.bignumber.equal(
      initialVoterBobInfo.votes.plus(shares)
    );
    expect(
      tezStore.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerAliceInfo.votes.plus(shares));
    expect(tezStore.storage.previous_delegated).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.current_delegated).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.next_candidate).to.be.equal(zeroAddress);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(investParams.candidate);
  });

  it("should update end of voting period if voting can be done", async () => {
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
      candidate: alice.pkh,
    };

    await tezStore.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    const initialVoterBobInfo: User = tezStore.storage.users[bob.pkh];
    const initialBakerAliceInfo: Baker = tezStore.storage.bakers[alice.pkh];

    await dexCore.investLiquidity(
      investParams,
      requiredTokens.tokens_b_required.toNumber()
    );
    await tezStore.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    expect(tezStore.storage.users[sharesReceiver].candidate).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.users[sharesReceiver].votes).to.be.bignumber.equal(
      initialVoterBobInfo.votes.plus(shares)
    );
    expect(
      tezStore.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerAliceInfo.votes.plus(shares));
    expect(tezStore.storage.previous_delegated).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.current_delegated).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.next_candidate).to.be.equal(zeroAddress);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(investParams.candidate);
    expect(tezStore.storage.voting_period_ends).to.be.bignumber.equal(
      (await utils.tezos.rpc.getBlock()).header.level +
        dexCoreStorage.storage.cycle_duration.toNumber() *
          dexCoreStorage.storage.voting_period.toNumber()
    );
  });

  it("should remove delegate and set current delegated to the `zero_address` if voting can be done and current delegated is banned", async () => {
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
      candidate: bob.pkh,
    };

    await tezStore.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    const initialVoterAliceInfo: User = tezStore.storage.users[alice.pkh];
    const initialBakerBobInfo: Baker = tezStore.storage.bakers[bob.pkh];

    await dexCore.investLiquidity(
      investParams,
      requiredTokens.tokens_b_required.toNumber()
    );
    await tezStore.updateStorage({
      users: [sharesReceiver],
      bakers: [investParams.candidate],
    });

    expect(tezStore.storage.users[sharesReceiver].candidate).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.users[sharesReceiver].votes).to.be.bignumber.equal(
      initialVoterAliceInfo.votes.plus(shares)
    );
    expect(
      tezStore.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerBobInfo.votes.plus(shares));
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.next_candidate).to.be.equal(zeroAddress);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });
});
