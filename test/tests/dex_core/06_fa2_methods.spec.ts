import { TransactionOperation } from "@taquito/taquito";

import { DexCore as DexCoreErrors } from "../../helpers/Errors";
import { BakerRegistry } from "../../helpers/BakerRegistry";
import { FA2 as FA2Errors } from "../../helpers/Errors";
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

import { confirmOperation } from "../../../scripts/confirmation";

import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
import { auctionStorage } from "../../../storage/Auction";
import { dexCoreStorage } from "../../../storage/DexCore";
import { fa12Storage } from "../../../storage/test/FA12";
import { fa2Storage } from "../../../storage/test/FA2";

import { BalanceRequest, Transfer, UpdateOperator } from "../../types/FA2";
import { LaunchExchange, Swap } from "../../types/DexCore";
import { Baker, User } from "../../types/Bucket";
import { SBAccount } from "../../types/Common";

chai.use(require("chai-bignumber")(BigNumber));

describe("DexCore (FA2 methods)", async () => {
  var bakerRegistry: BakerRegistry;
  var dexCore2: DexCore;
  var auction: Auction;
  var dexCore: DexCore;
  var fa12Token1: FA12;
  var fa12Token2: FA12;
  var fa2Token1: FA2;
  var fa2Token2: FA2;
  var utils: Utils;

  var alice: SBAccount = accounts.alice;
  var bob: SBAccount = accounts.bob;
  var carol: SBAccount = accounts.carol;
  var dev: SBAccount = accounts.dev;

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
        token_a: {
          fa2: { token: fa2Token1.contract.address, id: new BigNumber(0) },
        },
        token_b: { tez: undefined },
      },
      token_a_in: new BigNumber(100),
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

    const transferOperation: TransactionOperation =
      await utils.tezos.contract.transfer({
        to: carol.pkh,
        amount: 50_000_000,
        mutez: true,
      });

    await confirmOperation(utils.tezos, transferOperation.hash);
  });

  it("should fail if reentrancy", async () => {
    const swapParams: Swap = {
      swaps: [{ direction: { a_to_b: undefined }, pair_id: new BigNumber(0) }],
      receiver: alice.pkh,
      referrer: bob.pkh,
      amount_in: new BigNumber(1),
      min_amount_out: new BigNumber(1),
    };

    await rejects(dexCore2.swap(swapParams), (err: Error) => {
      expect(err.message).to.equal(DexCoreErrors.ERR_REENTRANCY);

      return true;
    });
  });

  it("should fail if token ID from request not found", async () => {
    const params: BalanceRequest[] = [
      { owner: alice.pkh, token_id: new BigNumber(3) },
    ];

    await rejects(
      dexCore.contract.views.balance_of(params).read(),
      (err: any) => {
        expect(Utils.parseLambdaViewError(err)).to.equal(
          FA2Errors.FA2_TOKEN_UNDEFINED
        );

        return true;
      }
    );
  });

  it("should fail if one token ID from list of requests not found", async () => {
    const params: BalanceRequest[] = [
      { owner: alice.pkh, token_id: new BigNumber(0) },
      { owner: alice.pkh, token_id: new BigNumber(1) },
      { owner: alice.pkh, token_id: new BigNumber(3) },
    ];

    await rejects(
      dexCore.contract.views.balance_of(params).read(),
      (err: any) => {
        expect(Utils.parseLambdaViewError(err)).to.equal(
          FA2Errors.FA2_TOKEN_UNDEFINED
        );

        return true;
      }
    );
  });

  it("should return positive balance for one account", async () => {
    const params: BalanceRequest[] = [
      { owner: alice.pkh, token_id: new BigNumber(0) },
    ];
    const result: Promise<any> = await dexCore.contract.views
      .balance_of(params)
      .read();

    await dexCore.updateStorage({
      ledger: [[params[0].owner, params[0].token_id]],
    });

    expect(result[0].balance).to.be.bignumber.equal(
      dexCore.storage.storage.ledger[`${params[0].owner},${params[0].token_id}`]
    );
  });

  it("should return positive balance for group of accounts", async () => {
    const params: BalanceRequest[] = [
      { owner: alice.pkh, token_id: new BigNumber(0) },
      { owner: alice.pkh, token_id: new BigNumber(1) },
      { owner: alice.pkh, token_id: new BigNumber(2) },
    ];
    const result: Promise<any> = await dexCore.contract.views
      .balance_of(params)
      .read();

    await dexCore.updateStorage({
      ledger: [
        [params[0].owner, params[0].token_id],
        [params[1].owner, params[1].token_id],
        [params[2].owner, params[2].token_id],
      ],
    });

    for (
      let i: number = 0, j: number = params.length - 1;
      i < params.length;
      ++i, --j
    ) {
      expect(result[i].balance).to.be.bignumber.equal(
        dexCore.storage.storage.ledger[
          `${params[j].owner},${params[j].token_id}`
        ]
      );
    }
  });

  it("should return the same balance for the same account 2 times in one request", async () => {
    const params: BalanceRequest[] = [
      { owner: alice.pkh, token_id: new BigNumber(0) },
      { owner: alice.pkh, token_id: new BigNumber(0) },
    ];
    const result: Promise<any> = await dexCore.contract.views
      .balance_of(params)
      .read();

    await dexCore.updateStorage({
      ledger: [[params[0].owner, params[0].token_id]],
    });

    for (let i: number = 0; i < params.length; ++i) {
      expect(result[i].balance).to.be.bignumber.equal(
        dexCore.storage.storage.ledger[
          `${params[0].owner},${params[0].token_id}`
        ]
      );
    }
  });

  it("should return 0 if an account does not have tokens", async () => {
    const params: BalanceRequest[] = [
      { owner: bob.pkh, token_id: new BigNumber(0) },
    ];
    const result: Promise<any> = await dexCore.contract.views
      .balance_of(params)
      .read();

    expect(result[0].balance).to.be.bignumber.equal(new BigNumber(0));
  });

  it("should fail if token ID from request not found", async () => {
    const params: UpdateOperator[] = [
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(3),
        },
      },
    ];

    await rejects(dexCore.updateOperators(params), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_TOKEN_UNDEFINED);

      return true;
    });
  });

  it("should fail if one token ID from list of requests not found", async () => {
    const params: UpdateOperator[] = [
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(3),
        },
      },
    ];

    await rejects(dexCore.updateOperators(params), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_TOKEN_UNDEFINED);

      return true;
    });
  });

  it("should fail if not owner of tokens is trying to update operator", async () => {
    const params: UpdateOperator[] = [
      {
        add_operator: {
          owner: bob.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ];

    await rejects(dexCore.updateOperators(params), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_NOT_OWNER);

      return true;
    });
  });

  it("should fail if one from list of parameters is not an owner of tokens and is trying to update operator", async () => {
    const params: UpdateOperator[] = [
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
      {
        add_operator: {
          owner: bob.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ];

    await rejects(dexCore.updateOperators(params), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_NOT_OWNER);

      return true;
    });
  });

  it("should add one operator", async () => {
    const params: UpdateOperator[] = [
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ];

    await dexCore.updateOperators(params);
    await dexCore.updateStorage({
      accounts: [
        [params[0]["add_operator"].owner, params[0]["add_operator"].token_id],
      ],
    });

    expect(
      dexCore.storage.storage.accounts[
        `${params[0]["add_operator"].owner},${params[0]["add_operator"].token_id}`
      ].length
    ).to.be.equal(1);
    expect(
      dexCore.storage.storage.accounts[
        `${params[0]["add_operator"].owner},${params[0]["add_operator"].token_id}`
      ]
    ).to.include(params[0]["add_operator"].operator);
  });

  it("should remove one operator", async () => {
    const params: UpdateOperator[] = [
      {
        remove_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
    ];

    await dexCore.updateOperators(params);
    await dexCore.updateStorage({
      accounts: [
        [
          params[0]["remove_operator"].owner,
          params[0]["remove_operator"].token_id,
        ],
      ],
    });

    expect(
      dexCore.storage.storage.accounts[
        `${params[0]["remove_operator"].owner},${params[0]["remove_operator"].token_id}`
      ].length
    ).to.be.equal(0);
  });

  it("should add a group of operators", async () => {
    const params: UpdateOperator[] = [
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
      {
        add_operator: {
          owner: alice.pkh,
          operator: bob.pkh,
          token_id: new BigNumber(0),
        },
      },
      {
        add_operator: {
          owner: alice.pkh,
          operator: bob.pkh,
          token_id: new BigNumber(1),
        },
      },
    ];

    await dexCore.updateOperators(params);
    await dexCore.updateStorage({
      accounts: [
        [params[0]["add_operator"].owner, params[0]["add_operator"].token_id],
        [params[1]["add_operator"].owner, params[1]["add_operator"].token_id],
        [params[2]["add_operator"].owner, params[2]["add_operator"].token_id],
      ],
    });

    expect(
      dexCore.storage.storage.accounts[
        `${params[0]["add_operator"].owner},${params[0]["add_operator"].token_id}`
      ].length
    ).to.be.equal(2);
    expect(
      dexCore.storage.storage.accounts[
        `${params[2]["add_operator"].owner},${params[2]["add_operator"].token_id}`
      ].length
    ).to.be.equal(1);

    for (let i: number = 0; i < params.length; ++i) {
      expect(
        dexCore.storage.storage.accounts[
          `${params[i]["add_operator"].owner},${params[i]["add_operator"].token_id}`
        ]
      ).to.include(params[i]["add_operator"].operator);
    }
  });

  it("should remove a group of operators", async () => {
    const params: UpdateOperator[] = [
      {
        remove_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
      {
        remove_operator: {
          owner: alice.pkh,
          operator: bob.pkh,
          token_id: new BigNumber(1),
        },
      },
    ];

    await dexCore.updateOperators(params);
    await dexCore.updateStorage({
      accounts: [
        [
          params[0]["remove_operator"].owner,
          params[0]["remove_operator"].token_id,
        ],
        [
          params[1]["remove_operator"].owner,
          params[1]["remove_operator"].token_id,
        ],
      ],
    });

    expect(
      dexCore.storage.storage.accounts[
        `${params[0]["remove_operator"].owner},${params[0]["remove_operator"].token_id}`
      ].length
    ).to.be.equal(1);
    expect(
      dexCore.storage.storage.accounts[
        `${params[1]["remove_operator"].owner},${params[1]["remove_operator"].token_id}`
      ].length
    ).to.be.equal(0);
    expect(
      dexCore.storage.storage.accounts[
        `${params[0]["remove_operator"].owner},${params[0]["remove_operator"].token_id}`
      ]
    ).to.include(bob.pkh);
  });

  it("should add/remove operators per one request", async () => {
    const params: UpdateOperator[] = [
      {
        add_operator: {
          owner: alice.pkh,
          operator: dexCore.contract.address,
          token_id: new BigNumber(0),
        },
      },
      {
        remove_operator: {
          owner: alice.pkh,
          operator: bob.pkh,
          token_id: new BigNumber(0),
        },
      },
      {
        add_operator: {
          owner: alice.pkh,
          operator: bob.pkh,
          token_id: new BigNumber(1),
        },
      },
    ];

    await dexCore.updateOperators(params);
    await dexCore.updateStorage({
      accounts: [
        [params[0]["add_operator"].owner, params[0]["add_operator"].token_id],
        [
          params[1]["remove_operator"].owner,
          params[1]["remove_operator"].token_id,
        ],
        [params[2]["add_operator"].owner, params[2]["add_operator"].token_id],
      ],
    });

    expect(
      dexCore.storage.storage.accounts[
        `${params[0]["add_operator"].owner},${params[0]["add_operator"].token_id}`
      ].length
    ).to.be.equal(1);
    expect(
      dexCore.storage.storage.accounts[
        `${params[2]["add_operator"].owner},${params[2]["add_operator"].token_id}`
      ].length
    ).to.be.equal(1);
    expect(
      dexCore.storage.storage.accounts[
        `${params[0]["add_operator"].owner},${params[0]["add_operator"].token_id}`
      ]
    ).to.include(params[0]["add_operator"].operator);
    expect(
      dexCore.storage.storage.accounts[
        `${params[1]["remove_operator"].owner},${params[1]["remove_operator"].token_id}`
      ]
    ).to.not.include(params[1]["remove_operator"].operator);
    expect(
      dexCore.storage.storage.accounts[
        `${params[2]["add_operator"].owner},${params[2]["add_operator"].token_id}`
      ]
    ).to.include(params[2]["add_operator"].operator);
  });

  it("should fail if token ID from request not found", async () => {
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(3),
            amount: new BigNumber(1),
          },
        ],
      },
    ];

    await rejects(dexCore.transfer(params), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_TOKEN_UNDEFINED);

      return true;
    });
  });

  it("should fail if one token ID from list of requests not found", async () => {
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(1),
          },
          {
            to_: bob.pkh,
            token_id: new BigNumber(3),
            amount: new BigNumber(1),
          },
        ],
      },
    ];

    await rejects(dexCore.transfer(params), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_TOKEN_UNDEFINED);

      return true;
    });
  });

  it("should fail if not operator is trying to transfer tokens", async () => {
    const params: Transfer[] = [
      {
        from_: carol.pkh,
        txs: [
          {
            to_: alice.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(1),
          },
        ],
      },
    ];

    await rejects(dexCore.transfer(params), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_NOT_OPERATOR);

      return true;
    });
  });

  it("should fail if one from list of parameters is not an operator and is trying to transfer tokens", async () => {
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(1),
          },
        ],
      },
      {
        from_: carol.pkh,
        txs: [
          {
            to_: alice.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(1),
          },
        ],
      },
    ];

    await rejects(dexCore.transfer(params), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_NOT_OPERATOR);

      return true;
    });
  });

  it("should fail if a sender has an insufficient balance of tokens", async () => {
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(101),
          },
        ],
      },
    ];

    await rejects(dexCore.transfer(params), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_INSUFFICIENT_BALANCE);

      return true;
    });
  });

  it("should fail if a sender has an insufficient balance of tokens in one parameter from the list of parameters", async () => {
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(100),
          },
          {
            to_: bob.pkh,
            token_id: new BigNumber(0),
            amount: new BigNumber(1),
          },
        ],
      },
    ];

    await rejects(dexCore.transfer(params), (err: Error) => {
      expect(err.message).to.equal(FA2Errors.FA2_INSUFFICIENT_BALANCE);

      return true;
    });
  });

  it("should make one transfer from one account", async () => {
    const amount: BigNumber = new BigNumber(1);
    const tokenId: BigNumber = new BigNumber(2);
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: tokenId,
            amount: amount,
          },
        ],
      },
    ];

    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId],
        [bob.pkh, tokenId],
      ],
    });

    const prevAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId);
    const prevBobBalance: BigNumber = dexCore.getBalance(bob.pkh, tokenId);

    await dexCore.transfer(params);
    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId],
        [bob.pkh, tokenId],
      ],
    });

    const currAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId);
    const currBobBalance: BigNumber = dexCore.getBalance(bob.pkh, tokenId);

    expect(currAliceBalance).to.be.bignumber.equal(
      prevAliceBalance.minus(amount)
    );
    expect(currBobBalance).to.be.bignumber.equal(prevBobBalance.plus(amount));
  });

  it("should make a group of transfers from one account", async () => {
    const amount: BigNumber = new BigNumber(1);
    const tokenId: BigNumber = new BigNumber(2);
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: tokenId,
            amount: amount,
          },
          {
            to_: carol.pkh,
            token_id: tokenId,
            amount: amount,
          },
        ],
      },
    ];

    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId],
        [bob.pkh, tokenId],
        [carol.pkh, tokenId],
      ],
    });

    const prevAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId);
    const prevBobBalance: BigNumber = dexCore.getBalance(bob.pkh, tokenId);
    const prevCarolBalance: BigNumber = dexCore.getBalance(carol.pkh, tokenId);

    await dexCore.transfer(params);
    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId],
        [bob.pkh, tokenId],
        [carol.pkh, tokenId],
      ],
    });

    const currAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId);
    const currBobBalance: BigNumber = dexCore.getBalance(bob.pkh, tokenId);
    const currCarolBalance: BigNumber = dexCore.getBalance(carol.pkh, tokenId);

    expect(currAliceBalance).to.be.bignumber.equal(
      prevAliceBalance.minus(amount.multipliedBy(2))
    );
    expect(currBobBalance).to.be.bignumber.equal(prevBobBalance.plus(amount));
    expect(currCarolBalance).to.be.bignumber.equal(
      prevCarolBalance.plus(amount)
    );
  });

  it("should make self to self transfer", async () => {
    const amount: BigNumber = new BigNumber(100);
    const tokenId: BigNumber = new BigNumber(2);
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: alice.pkh,
            token_id: tokenId,
            amount: amount,
          },
        ],
      },
    ];

    await dexCore.updateStorage({
      ledger: [[alice.pkh, tokenId]],
    });

    const prevAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId);

    await dexCore.transfer(params);
    await dexCore.updateStorage({
      ledger: [[alice.pkh, tokenId]],
    });

    const currAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId);

    expect(currAliceBalance).to.be.bignumber.equal(prevAliceBalance);
  });

  it("should make transfer using allowance", async () => {
    const amount: BigNumber = new BigNumber(1);
    const tokenId: BigNumber = new BigNumber(2);
    const updateOperatorsParams: UpdateOperator[] = [
      {
        add_operator: {
          owner: alice.pkh,
          operator: bob.pkh,
          token_id: tokenId,
        },
      },
    ];
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: tokenId,
            amount: amount,
          },
        ],
      },
    ];

    await dexCore.updateOperators(updateOperatorsParams);
    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId],
        [bob.pkh, tokenId],
      ],
    });

    const prevAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId);
    const prevBobBalance: BigNumber = dexCore.getBalance(bob.pkh, tokenId);

    await utils.setProvider(bob.sk);
    await dexCore.transfer(params);
    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId],
        [bob.pkh, tokenId],
      ],
    });

    const currAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId);
    const currBobBalance: BigNumber = dexCore.getBalance(bob.pkh, tokenId);

    expect(currAliceBalance).to.be.bignumber.equal(
      prevAliceBalance.minus(amount)
    );
    expect(currBobBalance).to.be.bignumber.equal(prevBobBalance.plus(amount));
  });

  it("should make a group of transfers using allowances", async () => {
    const amount: BigNumber = new BigNumber(1);
    const tokenId1: BigNumber = new BigNumber(2);
    const tokenId2: BigNumber = new BigNumber(1);
    const updateOperatorsParams: UpdateOperator[] = [
      {
        add_operator: {
          owner: carol.pkh,
          operator: bob.pkh,
          token_id: tokenId1,
        },
      },
    ];
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: tokenId1,
            amount: amount,
          },
          {
            to_: bob.pkh,
            token_id: tokenId2,
            amount: amount,
          },
        ],
      },
      {
        from_: carol.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: tokenId1,
            amount: amount,
          },
        ],
      },
    ];

    await utils.setProvider(carol.sk);
    await dexCore.updateOperators(updateOperatorsParams);
    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId1],
        [alice.pkh, tokenId2],
        [bob.pkh, tokenId1],
        [bob.pkh, tokenId2],
        [carol.pkh, tokenId1],
      ],
    });

    const prevAliceTok1Balance: BigNumber = dexCore.getBalance(
      alice.pkh,
      tokenId1
    );
    const prevAliceTok2Balance: BigNumber = dexCore.getBalance(
      alice.pkh,
      tokenId2
    );
    const prevBobTok1Balance: BigNumber = dexCore.getBalance(bob.pkh, tokenId1);
    const prevBobTok2Balance: BigNumber = dexCore.getBalance(bob.pkh, tokenId2);
    const prevCarolTok1Balance: BigNumber = dexCore.getBalance(
      carol.pkh,
      tokenId1
    );

    await utils.setProvider(bob.sk);
    await dexCore.transfer(params);
    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId1],
        [alice.pkh, tokenId2],
        [bob.pkh, tokenId1],
        [bob.pkh, tokenId2],
        [carol.pkh, tokenId1],
      ],
    });

    const currAliceTok1Balance: BigNumber = dexCore.getBalance(
      alice.pkh,
      tokenId1
    );
    const currAliceTok2Balance: BigNumber = dexCore.getBalance(
      alice.pkh,
      tokenId2
    );
    const currBobTok1Balance: BigNumber = dexCore.getBalance(bob.pkh, tokenId1);
    const currBobTok2Balance: BigNumber = dexCore.getBalance(bob.pkh, tokenId2);
    const currCarolTok1Balance: BigNumber = dexCore.getBalance(
      carol.pkh,
      tokenId1
    );

    expect(currAliceTok1Balance).to.be.bignumber.equal(
      prevAliceTok1Balance.minus(amount)
    );
    expect(currAliceTok2Balance).to.be.bignumber.equal(
      prevAliceTok2Balance.minus(amount)
    );
    expect(currBobTok1Balance).to.be.bignumber.equal(
      prevBobTok1Balance.plus(amount.multipliedBy(2))
    );
    expect(currBobTok2Balance).to.be.bignumber.equal(
      prevBobTok2Balance.plus(amount)
    );
    expect(currCarolTok1Balance).to.be.bignumber.equal(
      prevCarolTok1Balance.minus(amount)
    );
  });

  it("should make a group of transfers from one account and using allowances", async () => {
    const amount: BigNumber = new BigNumber(1);
    const tokenId1: BigNumber = new BigNumber(2);
    const params: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: dev.pkh,
            token_id: tokenId1,
            amount: amount,
          },
        ],
      },
      {
        from_: bob.pkh,
        txs: [
          {
            to_: carol.pkh,
            token_id: tokenId1,
            amount: amount,
          },
        ],
      },
      {
        from_: carol.pkh,
        txs: [
          {
            to_: dev.pkh,
            token_id: tokenId1,
            amount: amount,
          },
        ],
      },
    ];

    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId1],
        [bob.pkh, tokenId1],
        [carol.pkh, tokenId1],
        [dev.pkh, tokenId1],
      ],
    });

    const prevAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId1);
    const prevBobBalance: BigNumber = dexCore.getBalance(bob.pkh, tokenId1);
    const prevCarolBalance: BigNumber = dexCore.getBalance(carol.pkh, tokenId1);
    const prevDevBalance: BigNumber = dexCore.getBalance(dev.pkh, tokenId1);

    await dexCore.transfer(params);
    await dexCore.updateStorage({
      ledger: [
        [alice.pkh, tokenId1],
        [bob.pkh, tokenId1],
        [carol.pkh, tokenId1],
        [dev.pkh, tokenId1],
      ],
    });

    const currAliceBalance: BigNumber = dexCore.getBalance(alice.pkh, tokenId1);
    const currBobBalance: BigNumber = dexCore.getBalance(bob.pkh, tokenId1);
    const currCarolBalance: BigNumber = dexCore.getBalance(carol.pkh, tokenId1);
    const currDevBalance: BigNumber = dexCore.getBalance(dev.pkh, tokenId1);

    expect(currAliceBalance).to.be.bignumber.equal(
      prevAliceBalance.minus(amount)
    );
    expect(currBobBalance).to.be.bignumber.equal(prevBobBalance.minus(amount));
    expect(currCarolBalance).to.be.bignumber.equal(prevCarolBalance);
    expect(currDevBalance).to.be.bignumber.equal(
      prevDevBalance.plus(amount.multipliedBy(2))
    );
  });

  it("should vote in time of transfer", async () => {
    const tokenId: BigNumber = new BigNumber(0);
    const transferParams: Transfer[] = [
      {
        from_: alice.pkh,
        txs: [
          {
            to_: bob.pkh,
            token_id: tokenId,
            amount: new BigNumber(1),
          },
        ],
      },
    ];

    await dexCore.updateStorage({
      pairs: [tokenId.toFixed()],
    });

    const bucket: Bucket = await Bucket.init(
      dexCore.storage.storage.pairs[tokenId.toFixed()].bucket,
      dexCore.tezos
    );

    await bucket.updateStorage({
      users: [alice.pkh],
      bakers: [alice.pkh],
    });

    const initialVoterAliceInfo: User = bucket.storage.users[alice.pkh];
    const initialBakerAliceInfo: Baker = bucket.storage.bakers[alice.pkh];

    await utils.setProvider(alice.sk);
    await dexCore.transfer(transferParams);
    await bucket.updateStorage({
      users: [alice.pkh, bob.pkh],
      bakers: [alice.pkh],
    });

    expect(bucket.storage.users[alice.pkh].candidate).to.be.equal(alice.pkh);
    expect(bucket.storage.users[bob.pkh].candidate).to.be.equal(alice.pkh);
    expect(bucket.storage.users[alice.pkh].votes).to.be.bignumber.equal(
      initialVoterAliceInfo.votes.minus(transferParams[0].txs[0].amount)
    );
    expect(bucket.storage.users[bob.pkh].votes).to.be.bignumber.equal(
      transferParams[0].txs[0].amount
    );
    expect(bucket.storage.bakers[alice.pkh].votes).to.be.bignumber.equal(
      initialBakerAliceInfo.votes
    );
    expect(bucket.storage.previous_delegated).to.be.equal(zeroAddress);
    expect(bucket.storage.current_delegated).to.be.equal(alice.pkh);
    expect(bucket.storage.next_candidate).to.be.equal(zeroAddress);
    expect(await utils.tezos.rpc.getDelegate(bucket.contract.address)).to.equal(
      null
    );
  });
});
