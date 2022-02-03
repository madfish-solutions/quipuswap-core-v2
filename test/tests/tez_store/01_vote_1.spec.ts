import { BakerRegistry } from "../../helpers/BakerRegistry";
import { zeroAddress, Utils } from "../../helpers/Utils";
import { TezStore } from "../../helpers/TezStore";
import { DexCore } from "../../helpers/DexCore";
import { Common } from "../../helpers/Errors";
import { FA2 } from "../../helpers/FA2";

import { rejects } from "assert";

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa2Storage } from "../../../storage/test/FA2";

import { Baker, User, Vote } from "test/types/TezStore";
import { SBAccount } from "test/types/Common";
import { Transfer } from "test/types/FA2";
import {
  InvestLiquidity,
  DivestLiquidity,
  LaunchExchange,
  RequiredTokens,
  TokensPerShare,
  Pair,
} from "test/types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("TezStore (vote - 1)", async () => {
  var utils: Utils;
  var bakerRegistry: BakerRegistry;
  var tezStore: TezStore;
  var dexCore: DexCore;
  var fa2Token1: FA2;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;
  var carol: SBAccount = accounts.carol;

  var pairId: BigNumber = new BigNumber(0);

  before("setup", async () => {
    utils = new Utils();

    await utils.init(alice.sk);

    bakerRegistry = await BakerRegistry.originate(
      utils.tezos,
      bakerRegistryStorage
    );

    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);

    dexCoreStorage.storage.entered = false;
    dexCoreStorage.storage.admin = alice.pkh;
    dexCoreStorage.storage.collecting_period = new BigNumber(100);
    dexCoreStorage.storage.cycle_duration = new BigNumber(10);
    dexCoreStorage.storage.voting_period = new BigNumber(10);
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();
  });

  it("should vote for bob, bob must become first current delegated", async () => {
    const launchParams: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(50),
      shares_receiver: alice.pkh,
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

    tezStore = await TezStore.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].tez_store,
      dexCore.tezos
    );

    await tezStore.updateStorage({
      users: [launchParams.shares_receiver],
      bakers: [launchParams.candidate],
    });

    expect(
      tezStore.storage.users[launchParams.shares_receiver].candidate
    ).to.be.equal(launchParams.candidate);
    expect(
      tezStore.storage.users[launchParams.shares_receiver].votes
    ).to.be.bignumber.equal(
      BigNumber.min(launchParams.token_a_in, launchParams.token_b_in)
    );
    expect(
      tezStore.storage.bakers[launchParams.candidate].votes
    ).to.be.bignumber.equal(
      BigNumber.min(launchParams.token_a_in, launchParams.token_b_in)
    );
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(
      launchParams.candidate
    );
    expect(tezStore.storage.next_candidate).to.be.equal(zeroAddress);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should fail if not dex core is trying to vote", async () => {
    const params: Vote = {
      voter: alice.pkh,
      candidate: bob.pkh,
      execute_voting: true,
      votes: new BigNumber(0),
      current_balance: new BigNumber(0),
      new_balance: new BigNumber(0),
    };

    await rejects(tezStore.vote(params), (err: Error) => {
      expect(err.message).to.equal(Common.ERR_NOT_DEX_CORE);

      return true;
    });
  });

  it("should vote for alice, alice must become next candidate", async () => {
    const sharesReceiver: string = bob.pkh;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(20);
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
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(bob.pkh);
    expect(tezStore.storage.next_candidate).to.be.equal(investParams.candidate);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should vote for alice, alice must not become current delegated", async () => {
    const sharesReceiver: string = bob.pkh;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(30);
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

    const initialVoterInfo: User = tezStore.storage.users[sharesReceiver];
    const initialBakerInfo: Baker =
      tezStore.storage.bakers[investParams.candidate];

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
      initialVoterInfo.votes.plus(shares)
    );
    expect(
      tezStore.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerInfo.votes.plus(shares));
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(bob.pkh);
    expect(tezStore.storage.next_candidate).to.be.equal(investParams.candidate);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should vote for alice, alice must become current delegated", async () => {
    const sharesReceiver: string = bob.pkh;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(1);
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

    const initialVoterInfo: User = tezStore.storage.users[sharesReceiver];
    const initialBakerInfo: Baker =
      tezStore.storage.bakers[investParams.candidate];

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
      initialVoterInfo.votes.plus(shares)
    );
    expect(
      tezStore.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerInfo.votes.plus(shares));
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.next_candidate).to.be.equal(bob.pkh);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should vote for bob, bob must become current delegated after alice", async () => {
    const sharesReceiver: string = alice.pkh;
    const prevPair: Pair = dexCore.storage.storage.pairs[pairId.toFixed()];
    const shares: BigNumber = new BigNumber(20);
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

    const initialVoterInfo: User = tezStore.storage.users[sharesReceiver];
    const initialBakerInfo: Baker =
      tezStore.storage.bakers[investParams.candidate];

    await utils.setProvider(alice.sk);
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
      initialVoterInfo.votes.plus(shares)
    );
    expect(
      tezStore.storage.bakers[investParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerInfo.votes.plus(shares));
    expect(tezStore.storage.current_delegated).to.be.equal(
      investParams.candidate
    );
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.next_candidate).to.be.equal(alice.pkh);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should vote for bob, alice must become current delegated", async () => {
    const liquidityReceiver: string = alice.pkh;
    const shares: BigNumber = new BigNumber(20);
    const divestedTokens: TokensPerShare = DexCore.getTokensPerShare(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_amt,
      min_token_b_out: divestedTokens.token_b_amt,
      shares: shares,
      liquidity_receiver: liquidityReceiver,
      candidate: bob.pkh,
    };

    await tezStore.updateStorage({
      users: [liquidityReceiver],
      bakers: [divestParams.candidate],
    });

    const initialVoterInfo: User = tezStore.storage.users[liquidityReceiver];
    const initialBakerInfo: Baker =
      tezStore.storage.bakers[divestParams.candidate];

    await dexCore.divestLiquidity(divestParams);
    await tezStore.updateStorage({
      users: [liquidityReceiver],
      bakers: [divestParams.candidate],
    });

    expect(tezStore.storage.users[liquidityReceiver].candidate).to.be.equal(
      divestParams.candidate
    );
    expect(
      tezStore.storage.users[liquidityReceiver].votes
    ).to.be.bignumber.equal(initialVoterInfo.votes.minus(shares));
    expect(
      tezStore.storage.bakers[divestParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerInfo.votes.minus(shares));
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(alice.pkh);
    expect(tezStore.storage.next_candidate).to.be.equal(divestParams.candidate);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should vote for alice, bob must become current delegated", async () => {
    const liquidityReceiver: string = bob.pkh;
    const shares: BigNumber = new BigNumber(10);
    const divestedTokens: TokensPerShare = DexCore.getTokensPerShare(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_amt,
      min_token_b_out: divestedTokens.token_b_amt,
      shares: shares,
      liquidity_receiver: liquidityReceiver,
      candidate: alice.pkh,
    };

    await tezStore.updateStorage({
      users: [liquidityReceiver],
      bakers: [divestParams.candidate],
    });

    const initialVoterInfo: User = tezStore.storage.users[liquidityReceiver];
    const initialBakerInfo: Baker =
      tezStore.storage.bakers[divestParams.candidate];

    await utils.setProvider(bob.sk);
    await dexCore.divestLiquidity(divestParams);
    await tezStore.updateStorage({
      users: [liquidityReceiver],
      bakers: [divestParams.candidate],
    });

    expect(tezStore.storage.users[liquidityReceiver].candidate).to.be.equal(
      divestParams.candidate
    );
    expect(
      tezStore.storage.users[liquidityReceiver].votes
    ).to.be.bignumber.equal(initialVoterInfo.votes.minus(shares));
    expect(
      tezStore.storage.bakers[divestParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerInfo.votes.minus(shares));
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(bob.pkh);
    expect(tezStore.storage.next_candidate).to.be.equal(divestParams.candidate);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should vote for bob, bob must remain current delegated", async () => {
    const liquidityReceiver: string = alice.pkh;
    const shares: BigNumber = new BigNumber(9);
    const divestedTokens: TokensPerShare = DexCore.getTokensPerShare(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_amt,
      min_token_b_out: divestedTokens.token_b_amt,
      shares: shares,
      liquidity_receiver: liquidityReceiver,
      candidate: bob.pkh,
    };

    await tezStore.updateStorage({
      users: [liquidityReceiver],
      bakers: [divestParams.candidate],
    });

    const initialVoterInfo: User = tezStore.storage.users[liquidityReceiver];
    const initialBakerInfo: Baker =
      tezStore.storage.bakers[divestParams.candidate];

    await utils.setProvider(alice.sk);
    await dexCore.divestLiquidity(divestParams);
    await tezStore.updateStorage({
      users: [liquidityReceiver],
      bakers: [divestParams.candidate],
    });

    expect(tezStore.storage.users[liquidityReceiver].candidate).to.be.equal(
      divestParams.candidate
    );
    expect(
      tezStore.storage.users[liquidityReceiver].votes
    ).to.be.bignumber.equal(initialVoterInfo.votes.minus(shares));
    expect(
      tezStore.storage.bakers[divestParams.candidate].votes
    ).to.be.bignumber.equal(initialBakerInfo.votes.minus(shares));
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(
      divestParams.candidate
    );
    expect(tezStore.storage.next_candidate).to.be.equal(alice.pkh);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should transfer tokens from alice to bob, vote, alice must become current delegated", async () => {
    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: pairId,
            amount: new BigNumber(1),
          },
        ],
      },
    ];

    await tezStore.updateStorage({
      users: [alice.pkh, bob.pkh],
      bakers: [alice.pkh, bob.pkh],
    });

    const initialVoterAliceInfo: User = tezStore.storage.users[alice.pkh];
    const initialVoterBobInfo: User = tezStore.storage.users[bob.pkh];
    const initialBakerAliceInfo: Baker = tezStore.storage.bakers[alice.pkh];
    const initialBakerBobInfo: Baker = tezStore.storage.bakers[bob.pkh];

    await dexCore.transfer(transferParams);
    await tezStore.updateStorage({
      users: [alice.pkh, bob.pkh],
      bakers: [alice.pkh, bob.pkh],
    });

    expect(tezStore.storage.users[alice.pkh].candidate).to.be.equal(bob.pkh);
    expect(tezStore.storage.users[bob.pkh].candidate).to.be.equal(alice.pkh);
    expect(tezStore.storage.users[alice.pkh].votes).to.be.bignumber.equal(
      initialVoterAliceInfo.votes.minus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.users[bob.pkh].votes).to.be.bignumber.equal(
      initialVoterBobInfo.votes.plus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.bakers[alice.pkh].votes).to.be.bignumber.equal(
      initialBakerAliceInfo.votes.plus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.bakers[bob.pkh].votes).to.be.bignumber.equal(
      initialBakerBobInfo.votes.minus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(alice.pkh);
    expect(tezStore.storage.next_candidate).to.be.equal(bob.pkh);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should transfer tokens from alice to bob, vote, alice must remain current delegated", async () => {
    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: pairId,
            amount: new BigNumber(5),
          },
        ],
      },
    ];

    await tezStore.updateStorage({
      users: [alice.pkh, bob.pkh],
      bakers: [alice.pkh, bob.pkh],
    });

    const initialVoterAliceInfo: User = tezStore.storage.users[alice.pkh];
    const initialVoterBobInfo: User = tezStore.storage.users[bob.pkh];
    const initialBakerAliceInfo: Baker = tezStore.storage.bakers[alice.pkh];
    const initialBakerBobInfo: Baker = tezStore.storage.bakers[bob.pkh];

    await dexCore.transfer(transferParams);
    await tezStore.updateStorage({
      users: [alice.pkh, bob.pkh],
      bakers: [alice.pkh, bob.pkh],
    });

    expect(tezStore.storage.users[alice.pkh].candidate).to.be.equal(bob.pkh);
    expect(tezStore.storage.users[bob.pkh].candidate).to.be.equal(alice.pkh);
    expect(tezStore.storage.users[alice.pkh].votes).to.be.bignumber.equal(
      initialVoterAliceInfo.votes.minus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.users[bob.pkh].votes).to.be.bignumber.equal(
      initialVoterBobInfo.votes.plus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.bakers[alice.pkh].votes).to.be.bignumber.equal(
      initialBakerAliceInfo.votes.plus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.bakers[bob.pkh].votes).to.be.bignumber.equal(
      initialBakerBobInfo.votes.minus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(alice.pkh);
    expect(tezStore.storage.next_candidate).to.be.equal(bob.pkh);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should transfer tokens from bob to alice, vote, bob must become current delegated", async () => {
    const transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: alice.pkh,
            token_id: pairId,
            amount: new BigNumber(10),
          },
        ],
      },
    ];

    await tezStore.updateStorage({
      users: [alice.pkh, bob.pkh],
      bakers: [alice.pkh, bob.pkh],
    });

    const initialVoterAliceInfo: User = tezStore.storage.users[alice.pkh];
    const initialVoterBobInfo: User = tezStore.storage.users[bob.pkh];
    const initialBakerAliceInfo: Baker = tezStore.storage.bakers[alice.pkh];
    const initialBakerBobInfo: Baker = tezStore.storage.bakers[bob.pkh];

    await utils.setProvider(bob.sk);
    await dexCore.transfer(transferParams);
    await tezStore.updateStorage({
      users: [alice.pkh, bob.pkh],
      bakers: [alice.pkh, bob.pkh],
    });

    expect(tezStore.storage.users[alice.pkh].candidate).to.be.equal(bob.pkh);
    expect(tezStore.storage.users[bob.pkh].candidate).to.be.equal(alice.pkh);
    expect(tezStore.storage.users[alice.pkh].votes).to.be.bignumber.equal(
      initialVoterAliceInfo.votes.plus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.users[bob.pkh].votes).to.be.bignumber.equal(
      initialVoterBobInfo.votes.minus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.bakers[alice.pkh].votes).to.be.bignumber.equal(
      initialBakerAliceInfo.votes.minus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.bakers[bob.pkh].votes).to.be.bignumber.equal(
      initialBakerBobInfo.votes.plus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(bob.pkh);
    expect(tezStore.storage.next_candidate).to.be.equal(alice.pkh);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });

  it("should transfer tokens from bob to carol, vote, bob must remain current delegated", async () => {
    const transferParams: Transfer[] = [
      {
        from_: bob.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: pairId,
            amount: new BigNumber(10),
          },
        ],
      },
    ];

    await tezStore.updateStorage({
      users: [alice.pkh, bob.pkh],
      bakers: [alice.pkh, bob.pkh],
    });

    const initialVoterAliceInfo: User = tezStore.storage.users[alice.pkh];
    const initialVoterBobInfo: User = tezStore.storage.users[bob.pkh];
    const initialBakerAliceInfo: Baker = tezStore.storage.bakers[alice.pkh];
    const initialBakerBobInfo: Baker = tezStore.storage.bakers[bob.pkh];

    await dexCore.transfer(transferParams);
    await tezStore.updateStorage({
      users: [alice.pkh, bob.pkh, carol.pkh],
      bakers: [alice.pkh, bob.pkh],
    });

    expect(tezStore.storage.users[alice.pkh].candidate).to.be.equal(bob.pkh);
    expect(tezStore.storage.users[bob.pkh].candidate).to.be.equal(alice.pkh);
    expect(tezStore.storage.users[carol.pkh].candidate).to.be.equal(bob.pkh);
    expect(tezStore.storage.users[alice.pkh].votes).to.be.bignumber.equal(
      initialVoterAliceInfo.votes
    );
    expect(tezStore.storage.users[bob.pkh].votes).to.be.bignumber.equal(
      initialVoterBobInfo.votes.minus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.users[carol.pkh].votes).to.be.bignumber.equal(
      transferParams[0].txs[0].amount
    );
    expect(tezStore.storage.bakers[alice.pkh].votes).to.be.bignumber.equal(
      initialBakerAliceInfo.votes.minus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.bakers[bob.pkh].votes).to.be.bignumber.equal(
      initialBakerBobInfo.votes.plus(transferParams[0].txs[0].amount)
    );
    expect(tezStore.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(tezStore.storage.current_delegated).to.be.equal(bob.pkh);
    expect(tezStore.storage.next_candidate).to.be.equal(alice.pkh);
    expect(
      await utils.tezos.rpc.getDelegate(tezStore.contract.address)
    ).to.equal(null);
  });
});
