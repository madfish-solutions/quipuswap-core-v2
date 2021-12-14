import {
  OriginationOperation,
  TransactionOperation,
  WalletParamsWithKind,
  WalletOperationBatch,
  WalletOperation,
  TezosToolkit,
  Contract,
  OpKind,
} from "@taquito/taquito";

import fs from "fs";

import { BigNumber } from "bignumber.js";

import env from "../../env";

import { confirmOperation } from "../../scripts/confirmation";

import auctionLambdas from "../../build/lambdas/auction_lambdas.json";

import { Utils } from "./Utils";

import { PRECISION } from "./Constants";

import {
  UpdateWhitelist,
  AuctionStorage,
  LaunchAuction,
  WithdrawFee,
  ReceiveFees,
  ReceiveFee,
  PlaceBid,
  Fees,
} from "../types/Auction";

export class Auction {
  contract: Contract;
  storage: AuctionStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    auctionAddress: string,
    tezos: TezosToolkit
  ): Promise<Auction> {
    return new Auction(await tezos.contract.at(auctionAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: AuctionStorage
  ): Promise<Auction> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/auction.json`).toString()
    );
    const operation: OriginationOperation = await tezos.contract
      .originate({
        code: artifacts.michelson,
        storage: storage,
      })
      .catch((e) => {
        console.error(e);

        return null;
      });

    await confirmOperation(tezos, operation.hash);

    return new Auction(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  calculateReceiveFees(amount: BigNumber): ReceiveFees {
    const devFee: BigNumber = amount.multipliedBy(
      this.storage.storage.fees.dev_fee_f
    );
    const publicFee: BigNumber = amount
      .multipliedBy(100)
      .multipliedBy(PRECISION)
      .minus(devFee);

    return {
      devFee,
      publicFee,
    };
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: AuctionStorage = await this.contract.storage();

    this.storage = {
      storage: storage.storage,
      auction_lambdas: storage.auction_lambdas,
      metadata: storage.metadata,
    };

    for (const key in maps) {
      this.storage.storage[key] = await maps[key].reduce(
        async (prev: any, current: any) => {
          try {
            return {
              ...(await prev),
              [current]: await storage.storage[key].get(current),
            };
          } catch (ex) {
            return {
              ...(await prev),
              [current]: 0,
            };
          }
        },
        Promise.resolve({})
      );
    }
  }

  async setLambdas(): Promise<void> {
    let params: WalletParamsWithKind[] = [];
    const parts: number = 1;

    for (let i: number = 0; i < auctionLambdas.length; ) {
      for (
        let j: number = 0;
        j < Math.ceil(auctionLambdas.length / parts);
        ++j
      ) {
        if (i + j >= auctionLambdas.length) break;

        params.push({
          kind: OpKind.TRANSACTION,
          ...this.contract.methods
            .setup_func(i + j, auctionLambdas[i + j])
            .toTransferParams(),
        });
      }

      const batch: WalletOperationBatch = this.tezos.wallet.batch(params);
      const operation: WalletOperation = await batch.send();

      await confirmOperation(this.tezos, operation.opHash);

      params = [];
      i += Math.ceil(auctionLambdas.length / parts);
    }
  }

  async receiveFee(
    params: ReceiveFee,
    mutezAmount: number = 0
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .receive_fee(...Utils.destructObj(params))
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async launchAuction(params: LaunchAuction): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .launch_auction(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async placeBid(params: PlaceBid): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .place_bid(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async claim(auctionId: BigNumber): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .claim(auctionId.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setAdmin(admin: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_admin(admin)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async confirmAdmin(): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .confirm_admin([])
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setBaker(baker: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_baker(baker)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setFees(params: Fees): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_fees(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setAuctionDuration(
    auctionDuration: BigNumber
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_auction_duration(auctionDuration.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setMinBid(minBid: BigNumber): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_min_bid(minBid.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async updateWhitelist(
    params: UpdateWhitelist
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .update_whitelist(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawDevFee(params: WithdrawFee): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .withdraw_dev_fee(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawPulicFee(params: WithdrawFee): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .withdraw_public_fee(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async burnBidFee(): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .burn_bid_fee([])
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}
