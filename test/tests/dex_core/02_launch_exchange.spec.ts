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

import { BucketStorage } from "../../types/Bucket";
import { SBAccount } from "../../types/Common";
import {
  DivestLiquidity,
  LaunchExchange,
  TokensPerShare,
  Swap,
} from "../../types/DexCore";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (launch exchange)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore2: DexCore;
  var auction: Auction;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa12Token2: FA12;
  var fa12Token3: FA12;
  var fa2Token1: FA2;
  var fa2Token2: FA2;
  var fa2Token3: FA2;
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
    dexCoreStorage.storage.collecting_period = defaultCollectingPeriod;
    dexCoreStorage.storage.cycle_duration = defaultCycleDuration;
    dexCoreStorage.storage.voting_period = defaultVotingPeriod;
    dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

    dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

    dexCoreStorage.storage.entered = true;

    dexCore2 = await DexCore.originate(utils.tezos, dexCoreStorage);

    await dexCore.setLambdas();
    await dexCore2.setLambdas();

    fa12Token1 = await FA12.originate(utils.tezos, fa12Storage);
    fa12Token2 = await FA12.originate(utils.tezos, fa12Storage);
    fa12Token3 = await FA12.originate(utils.tezos, fa12Storage);
    fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);
    fa2Token2 = await FA2.originate(utils.tezos, fa2Storage);
    fa2Token3 = await FA2.originate(utils.tezos, fa2Storage);

    auctionStorage.storage.admin = alice.pkh;
    auctionStorage.storage.dex_core = dexCore.contract.address;
    auctionStorage.storage.quipu_token = fa2Token1.contract.address;

    auction = await Auction.originate(utils.tezos, auctionStorage);

    await auction.setLambdas();
  });

  it("should fail if reentrancy", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { tez: undefined },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(0),
      token_b_in: new BigNumber(0),
      shares_receiver: zeroAddress,
      candidate: zeroAddress,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000),
    };

    await rejects(dexCore2.launchExchange(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if action is outdated", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { tez: undefined },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000),
    };

    await rejects(
      dexCore.launchExchange(params, params.token_a_in.toNumber()),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_ACTION_OUTDATED);

        return true;
      }
    );
  });

  it("should fail if wrong pair order was passed with TEZ token and TEZ token", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { tez: undefined },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await rejects(
      dexCore.launchExchange(params, params.token_a_in.toNumber()),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_PAIR_ORDER);

        return true;
      }
    );
  });

  it("should fail if wrong pair order was passed with FA1.2 token and TEZ token", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { tez: undefined },
        token_b: { fa12: fa12Token1.contract.address },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await rejects(
      dexCore.launchExchange(params, params.token_a_in.toNumber()),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_PAIR_ORDER);

        return true;
      }
    );
  });

  it("should fail if wrong pair order was passed with FA2 token and TEZ token", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { tez: undefined },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await rejects(
      dexCore.launchExchange(params, params.token_a_in.toNumber()),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_PAIR_ORDER);

        return true;
      }
    );
  });

  it("should fail if wrong pair order was passed with FA1.2 token and FA1.2 token", async () => {
    let params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa2Token1.contract.address },
        token_b: { fa12: fa2Token2.contract.address },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    params = DexCore.changeTokensOrderInPair(params, true);

    await rejects(dexCore.launchExchange(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_PAIR_ORDER);

      return true;
    });
  });

  it("should fail if wrong pair order was passed with FA2 token and FA2 token", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(1) },
        },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await rejects(dexCore.launchExchange(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_PAIR_ORDER);

      return true;
    });
  });

  it("should fail if wrong pair order was passed with FA1.2 token and FA2 token", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: { fa12: fa2Token1.contract.address },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await rejects(dexCore.launchExchange(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_PAIR_ORDER);

      return true;
    });
  });

  it("should fail if token A zero amount in was passed", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(0),
      token_b_in: new BigNumber(1),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await rejects(
      dexCore.launchExchange(params, params.token_b_in.toNumber()),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_ZERO_A_IN);

        return true;
      }
    );
  });

  it("should fail if TEZ token B zero amount in was passed", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(0),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await rejects(
      dexCore.launchExchange(params, params.token_b_in.toNumber()),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_ZERO_B_IN);

        return true;
      }
    );
  });

  it("should fail if TEZ token B wrong amount in was passed", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await rejects(
      dexCore.launchExchange(params, params.token_b_in.toNumber() - 50),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_WRONG_TEZ_AMOUNT);

        return true;
      }
    );
  });

  it("should fail if token B zero amount in was passed", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(0),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await rejects(dexCore.launchExchange(params), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_ZERO_B_IN);

      return true;
    });
  });

  it("should launch FA1.2/TEZ exchange", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(50),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    const expectedPairId: BigNumber = new BigNumber(0);

    await fa12Token1.approve(dexCore.contract.address, params.token_a_in);
    await dexCore.launchExchange(params, params.token_b_in.toNumber());
    await dexCore.updateStorage({
      ledger: [[params.shares_receiver, expectedPairId.toFixed()]],
      tokens: [expectedPairId.toFixed()],
      pairs: [expectedPairId.toFixed()],
    });

    expect(dexCore.storage.storage.tokens_count).to.be.bignumber.equal(
      expectedPairId.plus(1)
    );
    expect(
      dexCore.storage.storage.ledger[
        `${params.shares_receiver},${expectedPairId.toFixed()}`
      ]
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(
      dexCore.storage.storage.tokens[expectedPairId.toFixed()].token_a
    ).to.be.deep.equal(params.pair.token_a);
    expect(
      typeof dexCore.storage.storage.tokens[expectedPairId.toFixed()].token_b
        .tez
    ).to.be.equal("symbol");
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_a_pool
    ).to.be.bignumber.equal(params.token_a_in);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_b_pool
    ).to.be.bignumber.equal(params.token_b_in);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].total_supply
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket).to
      .not.be.null;
  });

  it("should fail if pair already listed", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(1),
      token_b_in: new BigNumber(1),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await rejects(
      dexCore.launchExchange(params, params.token_b_in.toNumber()),
      (err: Error) => {
        expect(err.message).to.equal(DexCoreErrors.ERR_PAIR_LISTED);

        return true;
      }
    );
  });

  it("should launch FA2/TEZ exchange", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(50),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    const expectedPairId: BigNumber = new BigNumber(1);

    await fa2Token1.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: params.pair.token_a["fa2"].id,
        },
      },
    ]);
    await dexCore.launchExchange(params, params.token_b_in.toNumber());
    await dexCore.updateStorage({
      ledger: [[params.shares_receiver, expectedPairId.toFixed()]],
      tokens: [expectedPairId.toFixed()],
      pairs: [expectedPairId.toFixed()],
    });

    expect(dexCore.storage.storage.tokens_count).to.be.bignumber.equal(
      expectedPairId.plus(1)
    );
    expect(
      dexCore.storage.storage.ledger[
        `${params.shares_receiver},${expectedPairId.toFixed()}`
      ]
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(
      dexCore.storage.storage.tokens[expectedPairId.toFixed()].token_a
    ).to.be.deep.equal(params.pair.token_a);
    expect(
      typeof dexCore.storage.storage.tokens[expectedPairId.toFixed()].token_b
        .tez
    ).to.be.equal("symbol");
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_a_pool
    ).to.be.bignumber.equal(params.token_a_in);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_b_pool
    ).to.be.bignumber.equal(params.token_b_in);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].total_supply
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket).to
      .not.be.null;
  });

  it("should launch FA1.2/FA1.2 exchange", async () => {
    let params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { fa12: fa12Token2.contract.address },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    const expectedPairId: BigNumber = new BigNumber(2);

    params = DexCore.changeTokensOrderInPair(params, false);

    await fa12Token1.approve(dexCore.contract.address, params.token_a_in);
    await fa12Token2.approve(dexCore.contract.address, params.token_b_in);
    await dexCore.launchExchange(params);
    await dexCore.updateStorage({
      ledger: [[params.shares_receiver, expectedPairId.toFixed()]],
      tokens: [expectedPairId.toFixed()],
      pairs: [expectedPairId.toFixed()],
    });

    expect(dexCore.storage.storage.tokens_count).to.be.bignumber.equal(
      expectedPairId.plus(1)
    );
    expect(
      dexCore.storage.storage.ledger[
        `${params.shares_receiver},${expectedPairId.toFixed()}`
      ]
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(
      dexCore.storage.storage.tokens[expectedPairId.toFixed()]
    ).to.be.deep.equal(params.pair);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_a_pool
    ).to.be.bignumber.equal(params.token_a_in);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_b_pool
    ).to.be.bignumber.equal(params.token_b_in);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].total_supply
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket).to.be
      .null;
  });

  it("should launch FA2/FA2 exchange", async () => {
    let params: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: {
          fa2: { token: fa2Token2.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(50),
      token_b_in: new BigNumber(50),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    const expectedPairId: BigNumber = new BigNumber(3);

    params = DexCore.changeTokensOrderInPair(params, false);

    await fa2Token2.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: params.pair.token_b["fa2"].id,
        },
      },
    ]);
    await dexCore.launchExchange(params);
    await dexCore.updateStorage({
      ledger: [[params.shares_receiver, expectedPairId.toFixed()]],
      tokens: [expectedPairId.toFixed()],
      pairs: [expectedPairId.toFixed()],
    });

    expect(dexCore.storage.storage.tokens_count).to.be.bignumber.equal(
      expectedPairId.plus(1)
    );
    expect(
      dexCore.storage.storage.ledger[
        `${params.shares_receiver},${expectedPairId.toFixed()}`
      ]
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(
      dexCore.storage.storage.tokens[expectedPairId.toFixed()]
    ).to.be.deep.equal(params.pair);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_a_pool
    ).to.be.bignumber.equal(params.token_a_in);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_b_pool
    ).to.be.bignumber.equal(params.token_b_in);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].total_supply
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket).to.be
      .null;
  });

  it("should launch FA1.2/FA2 exchange", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(50),
      token_b_in: new BigNumber(50),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    const expectedPairId: BigNumber = new BigNumber(4);

    await fa12Token1.approve(dexCore.contract.address, params.token_a_in);
    await dexCore.launchExchange(params);
    await dexCore.updateStorage({
      ledger: [[params.shares_receiver, expectedPairId.toFixed()]],
      tokens: [expectedPairId.toFixed()],
      pairs: [expectedPairId.toFixed()],
    });

    expect(dexCore.storage.storage.tokens_count).to.be.bignumber.equal(
      expectedPairId.plus(1)
    );
    expect(
      dexCore.storage.storage.ledger[
        `${params.shares_receiver},${expectedPairId.toFixed()}`
      ]
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(
      dexCore.storage.storage.tokens[expectedPairId.toFixed()]
    ).to.be.deep.equal(params.pair);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_a_pool
    ).to.be.bignumber.equal(params.token_a_in);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].token_b_pool
    ).to.be.bignumber.equal(params.token_b_in);
    expect(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].total_supply
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket).to.be
      .null;
  });

  it("should setup correct default metadata in time of exchange launch", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token2.contract.address },
        token_b: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(100),
      token_b_in: new BigNumber(50),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    const expectedPairId: BigNumber = new BigNumber(5);

    await fa12Token2.approve(dexCore.contract.address, params.token_a_in);
    await dexCore.launchExchange(params);
    await dexCore.updateStorage({
      token_metadata: [expectedPairId.toFixed()],
    });

    expect(
      dexCore.storage.storage.token_metadata[expectedPairId.toFixed()].token_id
    ).to.be.bignumber.equal(expectedPairId);
    expect(
      await dexCore.storage.storage.token_metadata[
        expectedPairId.toFixed()
      ].token_info.get("name")
    ).to.be.equal("517569707573776170204c5020546f6b656e");
    expect(
      await dexCore.storage.storage.token_metadata[
        expectedPairId.toFixed()
      ].token_info.get("symbol")
    ).to.be.equal("515054");
    expect(
      await dexCore.storage.storage.token_metadata[
        expectedPairId.toFixed()
      ].token_info.get("decimals")
    ).to.be.equal("36");
    expect(
      await dexCore.storage.storage.token_metadata[
        expectedPairId.toFixed()
      ].token_info.get("description")
    ).to.be.equal(
      "517569707573776170204c5020746f6b656e20726570726573656e7473207573657220736861726520696e20746865206c697175696469747920706f6f6c"
    );
    expect(
      await dexCore.storage.storage.token_metadata[
        expectedPairId.toFixed()
      ].token_info.get("shouldPreferSymbol")
    ).to.be.equal("74727565");
    expect(
      await dexCore.storage.storage.token_metadata[
        expectedPairId.toFixed()
      ].token_info.get("thumbnailUri")
    ).to.be.equal(
      "68747470733a2f2f7175697075737761702e636f6d2f51504c502e706e67"
    );
    Buffer.from;
  });

  it("should transfer FA1.2 tokens and TEZ tokens in time of FA1.2/TEZ exchange launch", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token2.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(600),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    const expectedPairId: BigNumber = new BigNumber(6);

    await fa12Token2.updateStorage({
      ledger: [dexCore.contract.address],
    });

    const prevDexCoreBalance: BigNumber = fa12Token2.getBalance(
      dexCore.contract.address
    );

    await fa12Token2.approve(dexCore.contract.address, params.token_a_in);
    await dexCore.launchExchange(params, params.token_b_in.toNumber());
    await dexCore.updateStorage({
      pairs: [expectedPairId.toFixed()],
    });
    await fa12Token2.updateStorage({
      ledger: [dexCore.contract.address],
    });

    const currDexCoreBalance: BigNumber = fa12Token2.getBalance(
      dexCore.contract.address
    );

    expect(
      await utils.tezos.tz.getBalance(dexCore.contract.address)
    ).to.be.bignumber.equal(new BigNumber(0));
    expect(
      await utils.tezos.tz.getBalance(
        dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket
      )
    ).to.be.bignumber.equal(params.token_b_in);
    expect(currDexCoreBalance).to.be.bignumber.equal(
      prevDexCoreBalance.plus(params.token_a_in)
    );
  });

  it("should transfer FA2 tokens and TEZ tokens in time of FA2/TEZ exchange launch", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token2.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(600),
      token_b_in: new BigNumber(100),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    const expectedPairId: BigNumber = new BigNumber(7);

    await fa2Token2.updateStorage({
      account_info: [dexCore.contract.address],
    });

    const prevDexCoreBalance: BigNumber = await fa2Token2.getBalance(
      dexCore.contract.address,
      params.pair.token_a["fa2"].id
    );

    await dexCore.launchExchange(params, params.token_b_in.toNumber());
    await dexCore.updateStorage({
      pairs: [expectedPairId.toFixed()],
    });
    await fa2Token2.updateStorage({
      account_info: [dexCore.contract.address],
    });

    const currDexCoreBalance: BigNumber = await fa2Token2.getBalance(
      dexCore.contract.address,
      params.pair.token_a["fa2"].id
    );

    expect(
      await utils.tezos.tz.getBalance(dexCore.contract.address)
    ).to.be.bignumber.equal(new BigNumber(0));
    expect(
      await utils.tezos.tz.getBalance(
        dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket
      )
    ).to.be.bignumber.equal(params.token_b_in);
    expect(currDexCoreBalance).to.be.bignumber.equal(
      prevDexCoreBalance.plus(params.token_a_in)
    );
  });

  it("should transfer FA1.2 tokens in time of FA1.2/FA1.2 exchange launch", async () => {
    let params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token1.contract.address },
        token_b: { fa12: fa12Token3.contract.address },
      },
      token_a_in: new BigNumber(600),
      token_b_in: new BigNumber(600),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    params = DexCore.changeTokensOrderInPair(params, false);

    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address],
    });
    await fa12Token3.updateStorage({
      ledger: [dexCore.contract.address],
    });

    const prevDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const prevDexCoreTok2Balance: BigNumber = fa12Token3.getBalance(
      dexCore.contract.address
    );

    await fa12Token1.approve(dexCore.contract.address, params.token_a_in);
    await fa12Token3.approve(dexCore.contract.address, params.token_b_in);
    await dexCore.launchExchange(params);
    await fa12Token1.updateStorage({
      ledger: [dexCore.contract.address],
    });
    await fa12Token3.updateStorage({
      ledger: [dexCore.contract.address],
    });

    const currDexCoreTok1Balance: BigNumber = fa12Token1.getBalance(
      dexCore.contract.address
    );
    const currDexCoreTok2Balance: BigNumber = fa12Token3.getBalance(
      dexCore.contract.address
    );

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(params.token_a_in)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.plus(params.token_a_in)
    );
  });

  it("should transfer FA2 tokens in time of FA2/FA2 exchange launch", async () => {
    let params: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: {
          fa2: { token: fa2Token3.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(400),
      token_b_in: new BigNumber(400),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    params = DexCore.changeTokensOrderInPair(params, false);

    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address],
    });
    await fa2Token3.updateStorage({
      account_info: [dexCore.contract.address],
    });

    const prevDexCoreTok1Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address,
      params.pair.token_a["fa2"].id
    );
    const prevDexCoreTok2Balance: BigNumber = await fa2Token3.getBalance(
      dexCore.contract.address,
      params.pair.token_b["fa2"].id
    );

    await fa2Token3.updateOperators([
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: params.pair.token_b["fa2"].id,
        },
      },
    ]);
    await dexCore.launchExchange(params);
    await fa2Token1.updateStorage({
      account_info: [dexCore.contract.address],
    });
    await fa2Token3.updateStorage({
      account_info: [dexCore.contract.address],
    });

    const currDexCoreTok1Balance: BigNumber = await fa2Token1.getBalance(
      dexCore.contract.address,
      params.pair.token_a["fa2"].id
    );
    const currDexCoreTok2Balance: BigNumber = await fa2Token3.getBalance(
      dexCore.contract.address,
      params.pair.token_b["fa2"].id
    );

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(params.token_a_in)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.plus(params.token_b_in)
    );
  });

  it("should transfer FA1.2 tokens and FA2 tokens in time of FA1.2/FA2 exchange launch", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token3.contract.address },
        token_b: {
          fa2: { token: fa2Token3.contract.address, id: new BigNumber(0) },
        },
      },
      token_a_in: new BigNumber(1000),
      token_b_in: new BigNumber(1000),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await fa12Token3.updateStorage({
      ledger: [dexCore.contract.address],
    });
    await fa2Token3.updateStorage({
      account_info: [dexCore.contract.address],
    });

    const prevDexCoreTok1Balance: BigNumber = fa12Token3.getBalance(
      dexCore.contract.address
    );
    const prevDexCoreTok2Balance: BigNumber = await fa2Token3.getBalance(
      dexCore.contract.address,
      params.pair.token_b["fa2"].id
    );

    await fa12Token3.approve(dexCore.contract.address, params.token_a_in);
    await dexCore.launchExchange(params);
    await fa12Token3.updateStorage({
      ledger: [dexCore.contract.address],
    });
    await fa2Token3.updateStorage({
      account_info: [dexCore.contract.address],
    });

    const currDexCoreTok1Balance: BigNumber = fa12Token3.getBalance(
      dexCore.contract.address
    );
    const currDexCoreTok2Balance: BigNumber = await fa2Token3.getBalance(
      dexCore.contract.address,
      params.pair.token_b["fa2"].id
    );

    expect(currDexCoreTok1Balance).to.be.bignumber.equal(
      prevDexCoreTok1Balance.plus(params.token_a_in)
    );
    expect(currDexCoreTok2Balance).to.be.bignumber.equal(
      prevDexCoreTok2Balance.plus(params.token_a_in)
    );
  });

  it("should deploy bucket contract with correct initial storage in time of exchange launch with TEZ token", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: { fa12: fa12Token3.contract.address },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(50),
      token_b_in: new BigNumber(200),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    const expectedPairId: BigNumber = new BigNumber(11);

    await fa12Token3.approve(dexCore.contract.address, params.token_a_in);
    await dexCore.launchExchange(params, params.token_b_in.toNumber());
    await dexCore.updateStorage({
      pairs: [expectedPairId.toFixed()],
    });

    expect(dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket).to
      .not.be.null;
    expect(
      await utils.tezos.tz.getBalance(
        dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket
      )
    ).to.be.bignumber.equal(params.token_b_in);

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket,
      dexCore.tezos
    );

    await bucket.updateStorage({
      users: [params.shares_receiver],
      bakers: [params.candidate],
    });

    expect(bucket.storage.users[params.shares_receiver].candidate).to.be.equal(
      params.candidate
    );
    expect(
      bucket.storage.users[params.shares_receiver].votes
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(
      Date.parse(bucket.storage.bakers[params.candidate].ban_start_time)
    ).to.be.lte(await utils.getLastBlockTimestamp());
    expect(
      bucket.storage.bakers[params.candidate].ban_period
    ).to.be.bignumber.equal(new BigNumber(0));
    expect(bucket.storage.bakers[params.candidate].votes).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(bucket.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(bucket.storage.current_delegated).to.be.equal(params.candidate);
    expect(bucket.storage.next_candidate).to.be.equal(zeroAddress);
    expect(bucket.storage.baker_registry).to.be.equal(
      dexCore.storage.storage.baker_registry
    );
    expect(bucket.storage.dex_core).to.be.equal(dexCore.contract.address);
    expect(bucket.storage.pair_id).to.be.bignumber.equal(expectedPairId);
    expect(bucket.storage.next_reward).to.be.bignumber.equal(new BigNumber(0));
    expect(bucket.storage.total_reward).to.be.bignumber.equal(new BigNumber(0));
    expect(bucket.storage.reward_paid).to.be.bignumber.equal(new BigNumber(0));
    expect(bucket.storage.reward_per_share).to.be.bignumber.equal(
      new BigNumber(0)
    );
    expect(bucket.storage.reward_per_block).to.be.bignumber.equal(
      new BigNumber(0)
    );
    expect(bucket.storage.last_update_level).to.be.bignumber.equal(
      new BigNumber((await utils.tezos.rpc.getBlock()).header.level)
    );
    expect(bucket.storage.collecting_period_end).to.be.bignumber.equal(
      dexCore.storage.storage.collecting_period
        .multipliedBy(defaultCycleDuration)
        .plus(new BigNumber((await utils.tezos.rpc.getBlock()).header.level))
    );
    expect(bucket.storage.voting_period_end).to.be.bignumber.equal(
      new BigNumber(
        (await utils.tezos.rpc.getBlock()).header.level +
          dexCore.storage.storage.cycle_duration.toNumber() *
            dexCore.storage.storage.voting_period.toNumber()
      )
    );
  });

  it("should vote on bucket contract in time of exchange launch with TEZ token", async () => {
    const params: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token3.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(50),
      token_b_in: new BigNumber(200),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };
    const expectedPairId: BigNumber = new BigNumber(12);

    await dexCore.launchExchange(params, params.token_b_in.toNumber());
    await dexCore.updateStorage({
      pairs: [expectedPairId.toFixed()],
    });

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[expectedPairId.toFixed()].bucket,
      dexCore.tezos
    );

    await bucket.updateStorage({
      users: [params.shares_receiver],
      bakers: [params.candidate],
    });

    expect(bucket.storage.users[params.shares_receiver].candidate).to.be.equal(
      params.candidate
    );
    expect(
      bucket.storage.users[params.shares_receiver].votes
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(bucket.storage.bakers[params.candidate].votes).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(bucket.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(bucket.storage.current_delegated).to.be.equal(params.candidate);
    expect(bucket.storage.next_candidate).to.be.equal(zeroAddress);
    expect(await utils.tezos.rpc.getDelegate(bucket.contract.address)).to.equal(
      null
    );
    expect(bucket.storage.baker_registry).to.be.equal(
      dexCore.storage.storage.baker_registry
    );
    expect(bucket.storage.last_update_level).to.be.bignumber.equal(
      new BigNumber((await utils.tezos.rpc.getBlock()).header.level)
    );
    expect(bucket.storage.collecting_period_end).to.be.bignumber.equal(
      dexCore.storage.storage.collecting_period
        .multipliedBy(defaultCycleDuration)
        .plus(new BigNumber((await utils.tezos.rpc.getBlock()).header.level))
    );
    expect(bucket.storage.voting_period_end).to.be.bignumber.equal(
      new BigNumber(
        (await utils.tezos.rpc.getBlock()).header.level +
          dexCore.storage.storage.cycle_duration.toNumber() *
            dexCore.storage.storage.voting_period.toNumber()
      )
    );
  });

  it("should vote on bucket contract if exchange already launched and have 0 liquidity", async () => {
    const pairId: BigNumber = new BigNumber(12);
    const shares: BigNumber = new BigNumber(50);
    const params: LaunchExchange = {
      pair: {
        token_a: {
          fa2: { token: fa2Token3.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(200),
      token_b_in: new BigNumber(200),
      shares_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await dexCore.updateStorage({
      pairs: [pairId.toFixed()],
    });

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[pairId.toFixed()].bucket,
      dexCore.tezos
    );
    const divestedTokens: TokensPerShare = DexCore.getTokensPerShare(
      shares,
      dexCore.storage.storage.pairs[pairId.toFixed()]
    );
    const divestParams: DivestLiquidity = {
      pair_id: pairId,
      min_token_a_out: divestedTokens.token_a_amt,
      min_token_b_out: divestedTokens.token_b_amt,
      shares: shares,
      liquidity_receiver: alice.pkh,
      candidate: alice.pkh,
      deadline: String((await utils.getLastBlockTimestamp()) / 1000 + 100),
    };

    await bucket.updateStorage();

    const prevBucketStorage: BucketStorage = bucket.storage;

    await dexCore.divestLiquidity(divestParams);
    await bucket.updateStorage({
      users: [alice.pkh],
      bakers: [alice.pkh],
    });

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(new BigNumber(0));
    expect(bucket.storage.users[params.shares_receiver].candidate).to.be.equal(
      null
    );
    expect(
      bucket.storage.users[params.shares_receiver].votes
    ).to.be.bignumber.equal(new BigNumber(0));
    expect(bucket.storage.bakers[params.candidate].votes).to.be.bignumber.equal(
      new BigNumber(0)
    );
    expect(bucket.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(bucket.storage.current_delegated).to.be.equal(params.candidate);
    expect(bucket.storage.next_candidate).to.be.equal(zeroAddress);
    expect(await utils.tezos.rpc.getDelegate(bucket.contract.address)).to.equal(
      null
    );
    expect(bucket.storage.baker_registry).to.be.equal(
      dexCore.storage.storage.baker_registry
    );
    expect(bucket.storage.last_update_level).to.be.bignumber.equal(
      prevBucketStorage.last_update_level
    );
    expect(bucket.storage.collecting_period_end).to.be.bignumber.equal(
      prevBucketStorage.collecting_period_end
    );
    expect(bucket.storage.voting_period_end).to.be.bignumber.equal(
      prevBucketStorage.voting_period_end
    );

    await dexCore.launchExchange(params, params.token_b_in.toNumber());
    await bucket.updateStorage({
      users: [params.shares_receiver],
      bakers: [params.candidate],
    });

    expect(
      await utils.tezos.tz.getBalance(bucket.contract.address)
    ).to.be.bignumber.equal(params.token_b_in);
    expect(bucket.storage.users[params.shares_receiver].candidate).to.be.equal(
      params.candidate
    );
    expect(
      bucket.storage.users[params.shares_receiver].votes
    ).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(bucket.storage.bakers[params.candidate].votes).to.be.bignumber.equal(
      BigNumber.min(params.token_a_in, params.token_b_in)
    );
    expect(bucket.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(bucket.storage.current_delegated).to.be.equal(params.candidate);
    expect(bucket.storage.next_candidate).to.be.equal(zeroAddress);
    expect(await utils.tezos.rpc.getDelegate(bucket.contract.address)).to.equal(
      null
    );
    expect(bucket.storage.baker_registry).to.be.equal(
      dexCore.storage.storage.baker_registry
    );
    expect(bucket.storage.last_update_level).to.be.bignumber.equal(
      (await utils.getLastBlock()).toFixed()
    );
    expect(bucket.storage.collecting_period_end).to.be.bignumber.equal(
      prevBucketStorage.collecting_period_end
    );
    expect(bucket.storage.voting_period_end).to.be.bignumber.equal(
      prevBucketStorage.voting_period_end
    );
  });
});
