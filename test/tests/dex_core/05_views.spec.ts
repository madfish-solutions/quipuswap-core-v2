import { ViewSimulationError } from "@taquito/taquito";

import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
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

import chai, { expect } from "chai";

import { BigNumber } from "bignumber.js";

import accounts from "../../../scripts/sandbox/accounts";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { auctionStorage } from "../../../storage/Auction";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";
import { fa2Storage } from "../../../storage/test/FA2";

import { SBAccount } from "test/types/Common";
import {
  TokensPerShareRequest,
  CheckIsBannedBaker,
  LaunchExchange,
  TokensPerShare,
  Pair,
  Ban,
} from "test/types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (views)", async () => {
  var bakerRegistry: BakerRegistry;
  var auction: Auction;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa12Token2: FA12;
  var fa2Token1: FA2;
  var fa2Token2: FA2;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;

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

    await dexCore.setLambdas();

    fa12Token1 = await FA12.originate(utils.tezos, fa12Storage);
    fa12Token2 = await FA12.originate(utils.tezos, fa12Storage);
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
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: launchParams.pair.token_a["fa2"].id,
        },
      },
    ]);
    await dexCore.launchExchange(
      launchParams,
      launchParams.token_b_in.toNumber()
    );

    launchParams = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { fa12: fa12Token2.contract.address },
      },
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };
    launchParams = DexCore.changeTokensOrderInPair(launchParams, false);

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await fa12Token2.approve(dexCore.contract.address, launchParams.token_b_in);
    await dexCore.launchExchange(launchParams);

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
    };
    launchParams = DexCore.changeTokensOrderInPair(launchParams, false);

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

    launchParams = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(100_000),
      token_b_in: new BigNumber(100_000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
    };

    await fa12Token1.approve(dexCore.contract.address, launchParams.token_a_in);
    await dexCore.launchExchange(launchParams);
  });

  it("should fail if pair not listed", async () => {
    const params: CheckIsBannedBaker = {
      pair_id: new BigNumber(666),
      baker: alice.pkh,
    };

    try {
      await dexCore.contract.contractViews
        .check_is_banned_baker(params)
        .executeView({ viewCaller: alice.pkh });
    } catch (err: any) {
      expect(err).to.be.instanceof(ViewSimulationError);
      expect(
        Utils.parseOnChainViewError(JSON.parse(err.originalError.body))
      ).to.be.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);
    }
  });

  it("should fail if pair does not have TEZ store contract (not TOK/TEZ pair)", async () => {
    const params: CheckIsBannedBaker = {
      pair_id: new BigNumber(2),
      baker: alice.pkh,
    };

    try {
      await dexCore.contract.contractViews
        .check_is_banned_baker(params)
        .executeView({ viewCaller: alice.pkh });
    } catch (err: any) {
      expect(err).to.be.instanceof(ViewSimulationError);
      expect(
        Utils.parseOnChainViewError(JSON.parse(err.originalError.body))
      ).to.be.equal(DexCoreErrors.ERR_TEZ_STORE_404);
    }
  });

  it("should return false if baker is not banned", async () => {
    const isBanned: any = await dexCore.contract.contractViews
      .check_is_banned_baker({ pair_id: new BigNumber(0), baker: alice.pkh })
      .executeView({ viewCaller: alice.pkh });

    expect(isBanned).to.be.false;
  });

  it("should return true if baker is banned", async () => {
    const params: Ban = {
      pair_id: new BigNumber(0),
      ban_params: {
        baker: alice.pkh,
        ban_period: new BigNumber(3),
      },
    };

    await dexCore.ban(params);

    const isBanned: any = await dexCore.contract.contractViews
      .check_is_banned_baker({ pair_id: params.pair_id, baker: alice.pkh })
      .executeView({ viewCaller: alice.pkh });

    expect(isBanned).to.be.true;
  });

  it("should return false if baker's banning period is finished", async () => {
    await utils.bakeBlocks(2);

    const isBannedAlice: any = await dexCore.contract.contractViews
      .check_is_banned_baker({ pair_id: new BigNumber(0), baker: alice.pkh })
      .executeView({ viewCaller: alice.pkh });

    expect(isBannedAlice).to.be.false;
  });

  it("should return proper voting period", async () => {
    const votingPeriod: any = await dexCore.contract.contractViews
      .get_voting_period()
      .executeView({ viewCaller: alice.pkh });

    expect(votingPeriod).to.be.bignumber.equal(defaultVotingPeriod);
  });

  it("should return proper collecting period", async () => {
    const collectingPeriod: any = await dexCore.contract.contractViews
      .get_collecting_period()
      .executeView({ viewCaller: alice.pkh });

    expect(collectingPeriod).to.be.bignumber.equal(defaultCollectingPeriod);
  });

  it("should return proper cycle duration", async () => {
    const cycleDuration: any = await dexCore.contract.contractViews
      .get_cycle_duration()
      .executeView({ viewCaller: alice.pkh });

    expect(cycleDuration).to.be.bignumber.equal(defaultCycleDuration);
  });

  it("should fail if pair not listed", async () => {
    const pairs: BigNumber[] = [new BigNumber(666)];

    try {
      await dexCore.contract.contractViews
        .get_reserves(pairs)
        .executeView({ viewCaller: alice.pkh });
    } catch (err: any) {
      expect(err).to.be.instanceof(ViewSimulationError);
      expect(
        Utils.parseOnChainViewError(JSON.parse(err.originalError.body))
      ).to.be.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);
    }
  });

  it("should fail if one pair from list not listed", async () => {
    const pairs: BigNumber[] = [
      new BigNumber(0),
      new BigNumber(1),
      new BigNumber(666),
    ];

    try {
      await dexCore.contract.contractViews
        .get_reserves(pairs)
        .executeView({ viewCaller: alice.pkh });
    } catch (err: any) {
      expect(err).to.be.instanceof(ViewSimulationError);
      expect(
        Utils.parseOnChainViewError(JSON.parse(err.originalError.body))
      ).to.be.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);
    }
  });

  it("should return proper reserves for pair", async () => {
    const pairs: BigNumber[] = [new BigNumber(0)];
    const reservesResponse: any = await dexCore.contract.contractViews
      .get_reserves(pairs)
      .executeView({ viewCaller: alice.pkh });

    await dexCore.updateStorage({
      pairs: pairs,
    });

    const pair: Pair = dexCore.storage.storage.pairs[pairs[0].toFixed()];

    expect(reservesResponse.length).to.be.equal(1);
    expect(reservesResponse[0].request).to.be.bignumber.equal(pairs[0]);
    expect(reservesResponse[0].reserves.token_a_pool).to.be.bignumber.equal(
      pair.token_a_pool
    );
    expect(reservesResponse[0].reserves.token_b_pool).to.be.bignumber.equal(
      pair.token_b_pool
    );
  });

  it("should return proper reserves for all pairs in a list", async () => {
    const pairs: BigNumber[] = [
      new BigNumber(0),
      new BigNumber(1),
      new BigNumber(2),
    ];
    const reservesResponse: any = await dexCore.contract.contractViews
      .get_reserves(pairs)
      .executeView({ viewCaller: alice.pkh });

    await dexCore.updateStorage({
      pairs: pairs,
    });

    expect(reservesResponse.length).to.be.equal(pairs.length);

    for (
      let i: number = 0, j: number = pairs.length - 1;
      i < pairs.length;
      ++i, --j
    ) {
      const pair: Pair = dexCore.storage.storage.pairs[pairs[j].toFixed()];

      expect(reservesResponse[j].request).to.be.bignumber.equal(pairs[i]);
      expect(reservesResponse[j].reserves.token_a_pool).to.be.bignumber.equal(
        pair.token_a_pool
      );
      expect(reservesResponse[j].reserves.token_b_pool).to.be.bignumber.equal(
        pair.token_b_pool
      );
    }
  });

  it("should fail if pair not listed", async () => {
    const pairs: BigNumber[] = [new BigNumber(666)];

    try {
      await dexCore.contract.contractViews
        .get_total_supply(pairs)
        .executeView({ viewCaller: alice.pkh });
    } catch (err: any) {
      expect(err).to.be.instanceof(ViewSimulationError);
      expect(
        Utils.parseOnChainViewError(JSON.parse(err.originalError.body))
      ).to.be.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);
    }
  });

  it("should fail if one pair from list not listed", async () => {
    const pairs: BigNumber[] = [
      new BigNumber(0),
      new BigNumber(1),
      new BigNumber(666),
    ];

    try {
      await dexCore.contract.contractViews
        .get_total_supply(pairs)
        .executeView({ viewCaller: alice.pkh });
    } catch (err: any) {
      expect(err).to.be.instanceof(ViewSimulationError);
      expect(
        Utils.parseOnChainViewError(JSON.parse(err.originalError.body))
      ).to.be.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);
    }
  });

  it("should return proper total supply for pair", async () => {
    const pairs: BigNumber[] = [new BigNumber(0)];
    const totalSupplyResponse: any = await dexCore.contract.contractViews
      .get_total_supply(pairs)
      .executeView({ viewCaller: alice.pkh });

    await dexCore.updateStorage({
      pairs: pairs,
    });

    const pair: Pair = dexCore.storage.storage.pairs[pairs[0].toFixed()];

    expect(totalSupplyResponse.length).to.be.equal(1);
    expect(totalSupplyResponse[0].request).to.be.bignumber.equal(pairs[0]);
    expect(totalSupplyResponse[0].total_supply).to.be.bignumber.equal(
      pair.total_supply
    );
  });

  it("should return proper total supply for all pairs in a list", async () => {
    const pairs: BigNumber[] = [
      new BigNumber(0),
      new BigNumber(1),
      new BigNumber(2),
    ];
    const totalSupplyResponse: any = await dexCore.contract.contractViews
      .get_total_supply(pairs)
      .executeView({ viewCaller: alice.pkh });

    await dexCore.updateStorage({
      pairs: pairs,
    });

    expect(totalSupplyResponse.length).to.be.equal(pairs.length);

    for (
      let i: number = 0, j: number = pairs.length - 1;
      i < pairs.length;
      ++i, --j
    ) {
      const pair: Pair = dexCore.storage.storage.pairs[pairs[j].toFixed()];

      expect(totalSupplyResponse[j].request).to.be.bignumber.equal(pairs[i]);
      expect(totalSupplyResponse[j].total_supply).to.be.bignumber.equal(
        pair.total_supply
      );
    }
  });

  it("should fail if pair not listed", async () => {
    const params: TokensPerShareRequest[] = [
      { pair_id: new BigNumber(666), shares_amt: new BigNumber(0) },
    ];

    try {
      await dexCore.contract.contractViews
        .get_toks_per_share(params)
        .executeView({ viewCaller: alice.pkh });
    } catch (err: any) {
      expect(err).to.be.instanceof(ViewSimulationError);
      expect(
        Utils.parseOnChainViewError(JSON.parse(err.originalError.body))
      ).to.be.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);
    }
  });

  it("should fail if one pair from list not listed", async () => {
    const params: TokensPerShareRequest[] = [
      { pair_id: new BigNumber(0), shares_amt: new BigNumber(0) },
      { pair_id: new BigNumber(1), shares_amt: new BigNumber(0) },
      { pair_id: new BigNumber(666), shares_amt: new BigNumber(0) },
    ];

    try {
      await dexCore.contract.contractViews
        .get_toks_per_share(params)
        .executeView({ viewCaller: alice.pkh });
    } catch (err: any) {
      expect(err).to.be.instanceof(ViewSimulationError);
      expect(
        Utils.parseOnChainViewError(JSON.parse(err.originalError.body))
      ).to.be.equal(DexCoreErrors.ERR_PAIR_NOT_LISTED);
    }
  });

  it("should return proper tokens per shares amount for pair", async () => {
    const params: TokensPerShareRequest[] = [
      { pair_id: new BigNumber(0), shares_amt: new BigNumber(100) },
    ];
    const tokensPerSharesResponse: any = await dexCore.contract.contractViews
      .get_toks_per_share(params)
      .executeView({ viewCaller: alice.pkh });

    await dexCore.updateStorage({
      pairs: [params[0].pair_id],
    });

    const pair: Pair =
      dexCore.storage.storage.pairs[params[0].pair_id.toFixed()];
    const expectedTokensPerShare: TokensPerShare = DexCore.getTokensPerShare(
      params[0].shares_amt,
      pair
    );

    expect(tokensPerSharesResponse.length).to.be.equal(1);
    expect(tokensPerSharesResponse[0].request).to.be.deep.equal(params[0]);
    expect(
      tokensPerSharesResponse[0].tokens_per_share.token_a_amt
    ).to.be.bignumber.equal(expectedTokensPerShare.token_a_amt);
    expect(
      tokensPerSharesResponse[0].tokens_per_share.token_b_amt
    ).to.be.bignumber.equal(expectedTokensPerShare.token_b_amt);
  });

  it("should return proper tokens per shares anount for all pairs in a list", async () => {
    const params: TokensPerShareRequest[] = [
      { pair_id: new BigNumber(0), shares_amt: new BigNumber(12345) },
      { pair_id: new BigNumber(1), shares_amt: new BigNumber(13) },
      { pair_id: new BigNumber(2), shares_amt: new BigNumber(666) },
    ];
    const tokensPerSharesResponse: any = await dexCore.contract.contractViews
      .get_toks_per_share(params)
      .executeView({ viewCaller: alice.pkh });

    expect(tokensPerSharesResponse.length).to.be.equal(3);

    for (
      let i: number = 0, j: number = params.length - 1;
      i < params.length;
      ++i, --j
    ) {
      await dexCore.updateStorage({
        pairs: [params[i].pair_id],
      });

      const pair: Pair =
        dexCore.storage.storage.pairs[params[i].pair_id.toFixed()];
      const expectedTokensPerShare: TokensPerShare = DexCore.getTokensPerShare(
        params[i].shares_amt,
        pair
      );

      expect(tokensPerSharesResponse[j].request).to.be.deep.equal(params[i]);
      expect(
        tokensPerSharesResponse[j].tokens_per_share.token_a_amt
      ).to.be.bignumber.equal(expectedTokensPerShare.token_a_amt);
      expect(
        tokensPerSharesResponse[j].tokens_per_share.token_b_amt
      ).to.be.bignumber.equal(expectedTokensPerShare.token_b_amt);
    }
  });
});
