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

import dexCorelambdas from "../../build/lambdas/dex_core_lambdas.json";

import { Utils } from "./Utils";

import { Token } from "test/types/Common";
import { BalanceResponse, Transfer, UpdateOperator } from "test/types/FA2";
import {
  UpdateTokenMetadata,
  InvestLiquidity,
  DivestLiquidity,
  LaunchExchange,
  DexCoreStorage,
  WithdrawProfit,
  LaunchCallback,
  ClaimTokFee,
  ClaimTezFee,
  AddManager,
  FlashSwap,
  SetExpiry,
  Swap,
  Fees,
  Ban,
} from "../types/DexCore";

export class DexCore {
  contract: Contract;
  storage: DexCoreStorage;
  tezos: TezosToolkit;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    dexCoreAddress: string,
    tezos: TezosToolkit
  ): Promise<DexCore> {
    return new DexCore(await tezos.contract.at(dexCoreAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: DexCoreStorage
  ): Promise<DexCore> {
    const artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/dex_core.json`).toString()
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

    return new DexCore(
      await tezos.contract.at(operation.contractAddress),
      tezos
    );
  }

  async updateStorage(maps = {}): Promise<void> {
    const storage: DexCoreStorage = await this.contract.storage();

    this.storage = {
      storage: storage.storage,
      dex_core_lambdas: storage.dex_core_lambdas,
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
    const parts: number = 7;

    for (let i: number = 0; i < dexCorelambdas.length; ) {
      for (
        let j: number = 0;
        j < Math.ceil(dexCorelambdas.length / parts);
        ++j
      ) {
        if (i + j >= dexCorelambdas.length) break;

        params.push({
          kind: OpKind.TRANSACTION,
          ...this.contract.methods
            .setup_func(i + j, dexCorelambdas[i + j])
            .toTransferParams(),
        });
      }

      const batch: WalletOperationBatch = this.tezos.wallet.batch(params);
      const operation: WalletOperation = await batch.send();

      await confirmOperation(this.tezos, operation.opHash);

      params = [];
      i += Math.ceil(dexCorelambdas.length / parts);
    }
  }

  async launchExchange(
    params: LaunchExchange,
    mutezAmount: number = 0
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .launch_exchange(...Utils.destructObj(params))
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async investLiquidity(
    params: InvestLiquidity,
    mutezAmount: number = 0
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .invest_liquidity(...Utils.destructObj(params))
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async divestLiquidity(
    params: DivestLiquidity
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .divest_liquidity(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async flashSwap(params: FlashSwap): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .flash_swap(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async swap(params: Swap): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .swap(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawProfit(params: WithdrawProfit): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .withdraw_profit(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async claimTokInterfaceFee(
    params: ClaimTokFee
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .claim_tok_interface_fee(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async claimTezInterfaceFee(
    params: ClaimTezFee
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .claim_tez_interface_fee(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawAuctionFee(token: Token): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .withdraw_auction_fee(...Utils.destructObj(token))
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

  async setFlashSwapsProxy(
    flashSwapsProxy: string
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_flash_swaps_proxy(flashSwapsProxy)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setAuction(auction: string): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_auction(auction)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async addManagers(params: AddManager[]): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .add_managers(params)
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

  async setCycleDuration(
    cycleDuration: BigNumber
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_cycle_duration(cycleDuration.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setVotingPeriod(
    votingPeriod: BigNumber
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_voting_period(votingPeriod.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setCollectingPeriod(
    collectingPeriod: BigNumber
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_collecting_period(collectingPeriod.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async updateTokenMetadata(
    params: UpdateTokenMetadata
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .update_token_metadata(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async ban(params: Ban): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .ban(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async permit(
    key: string,
    permitSignature: string[]
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .permit([key, permitSignature])
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setExpiry(params: SetExpiry): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_expiry(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async transfer(params: Transfer[]): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .transfer(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async updateOperators(
    params: UpdateOperator[]
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .update_operators(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async fa12BalanceCallback1(
    balance: BigNumber
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .fa12_balance_callback_1(balance.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async fa2BalanceCallback1(
    params: BalanceResponse[]
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .fa2_balance_callback_1(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async fa12BalanceCallback2(
    balance: BigNumber
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .fa12_balance_callback_2(balance.toString())
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async fa2BalanceCallback2(
    params: BalanceResponse[]
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .fa2_balance_callback_2(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async flashSwapCallback(): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .flash_swap_callback([])
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async launchCallback(params: LaunchCallback): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .launch_callback(...Utils.destructObj(params))
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }
}
