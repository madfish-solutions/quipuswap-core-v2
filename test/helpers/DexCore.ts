import { MichelsonV1Expression } from "@taquito/rpc";
import { Schema } from "@taquito/michelson-encoder";
import { hex2buf } from "@taquito/utils";
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

import blake from "blakejs";

import fs from "fs";

import { BigNumber } from "bignumber.js";

import env from "../../env";

import { execSync } from "child_process";

import { getLigo } from "../../scripts/helpers";

import { confirmOperation } from "../../scripts/confirmation";

import dexCoreLambdas from "../../build/lambdas/dex_core_lambdas.json";

import { PRECISION } from "./Constants";

import { Utils } from "./Utils";

import { Transfer, UpdateOperator } from "test/types/FA2";
import { FA12Token, FA2Token } from "test/types/Common";
import {
  UpdateTokenMetadata,
  WithdrawAuctionFee,
  FlashSwapCallback,
  CumulativePrices,
  InvestLiquidity,
  DivestLiquidity,
  LaunchExchange,
  DexCoreStorage,
  WithdrawProfit,
  LaunchCallback,
  RequiredTokens,
  TokensPerShare,
  CalculateSwap,
  ClaimTezFee,
  AddManager,
  SetExpiry,
  SwapSlice,
  ClaimFee,
  DexVote,
  Swap,
  Pair,
  Fees,
  Ban,
} from "../types/DexCore";
import { preProcessFile } from "typescript";

const permitSchemaType: MichelsonV1Expression = {
  prim: "pair",
  args: [
    {
      prim: "pair",
      args: [{ prim: "address" }, { prim: "chain_id" }],
    },
    {
      prim: "pair",
      args: [{ prim: "nat" }, { prim: "bytes" }],
    },
  ],
};

const permitSchema: Schema = new Schema(permitSchemaType);

export class DexCore {
  storage: DexCoreStorage;
  tezos: TezosToolkit;
  contract: Contract;

  constructor(contract: Contract, tezos: TezosToolkit) {
    this.contract = contract;
    this.tezos = tezos;
  }

  static async init(
    dexCoreAddress: string,
    tezos: TezosToolkit,
  ): Promise<DexCore> {
    return new DexCore(await tezos.contract.at(dexCoreAddress), tezos);
  }

  static async originate(
    tezos: TezosToolkit,
    storage: DexCoreStorage,
  ): Promise<DexCore> {
    const contract: string = "dex_core";
    let artifacts: any = JSON.parse(
      fs.readFileSync(`${env.buildDir}/${contract}.json`).toString(),
    );
    const operation: OriginationOperation = await tezos.contract
      .originate({
        code: artifacts.michelson,
        storage: storage,
      })
      .catch(e => {
        console.error(e);

        return null;
      });

    await confirmOperation(tezos, operation.hash);

    artifacts.networks[env.network] = { [contract]: operation.contractAddress };

    if (!fs.existsSync(env.buildDir)) {
      fs.mkdirSync(env.buildDir);
    }

    fs.writeFileSync(
      `${env.buildDir}/${contract}.json`,
      JSON.stringify(artifacts, null, 2),
    );

    return new DexCore(
      await tezos.contract.at(operation.contractAddress),
      tezos,
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
        Promise.resolve({}),
      );
    }
  }

  async setLambdas(): Promise<void> {
    let params: WalletParamsWithKind[] = [];
    const parts: number = 7;

    for (let i: number = 0; i < dexCoreLambdas.length; ) {
      for (
        let j: number = 0;
        j < Math.ceil(dexCoreLambdas.length / parts);
        ++j
      ) {
        if (i + j >= dexCoreLambdas.length) break;

        params.push({
          kind: OpKind.TRANSACTION,
          ...this.contract.methods
            .setup_func(i + j, dexCoreLambdas[i + j])
            .toTransferParams(),
        });
      }

      const batch: WalletOperationBatch = this.tezos.wallet.batch(params);
      const operation: WalletOperation = await batch.send();

      await confirmOperation(this.tezos, operation.opHash);

      params = [];
      i += Math.ceil(dexCoreLambdas.length / parts);
    }
  }

  async launchExchange(
    params: LaunchExchange,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .launch_exchange(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async investLiquidity(
    params: InvestLiquidity,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .invest_liquidity(params)
      .send({
        amount: mutezAmount,
        mutez: true,
        fee: 1000000,
        gasLimit: 1040000,
      });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async divestLiquidity(
    params: DivestLiquidity,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .divest_liquidity(params)
      .send({
        amount: mutezAmount,
        mutez: true,
        fee: 1000000,
        gasLimit: 1040000,
      });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  parseSwaps(swaps: SwapSlice[]): string {
    let result: string = "list [ ";

    for (const swap of swaps) {
      const direction: string =
        Object.keys(swap.direction)[0].charAt(0).toUpperCase() +
        Object.keys(swap.direction)[0].substring(1);

      result += `record [ direction = ${direction}; pair_id = ${swap.pair_id.toFixed()}n; ]; `;
    }

    return result + " ]";
  }

  async swap(
    params: Swap,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    let operation: TransactionOperation;

    if (params.flash) {
      const ligo: string = getLigo(true);
      const stdout: string = execSync(
        `${ligo} compile parameter $PWD/contracts/test/lambdas.ligo 'Use(Swap((record [ lambda = Some(lambda); swaps = ${this.parseSwaps(
          params.swaps,
        )}; deadline = (${params.deadline} : timestamp); receiver = ("${
          params.receiver
        }" : address); referrer = ("${
          params.referrer
        }" : address); amount_in = ${params.amount_in.toFixed()}n; min_amount_out = ${params.min_amount_out.toFixed()}n ]: swap_t )))' -p jakarta --michelson-format json`,
        { maxBuffer: 1024 * 500 },
      ).toString();

      operation = await this.tezos.contract.transfer({
        to: this.contract.address,
        amount: mutezAmount,
        mutez: true,
        parameter: {
          entrypoint: "use",
          value: JSON.parse(stdout).args[0],
        },
        fee: 1000000,
        gasLimit: 1040000,
        storageLimit: 20000,
      });
    } else {
      operation = await this.contract.methodsObject
        .swap(params)
        .send({ amount: mutezAmount, mutez: true });
    }

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawProfit(
    params: WithdrawProfit,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .withdraw_profit(params)
      .send({
        amount: mutezAmount,
        mutez: true,
        fee: 1000000,
        gasLimit: 1040000,
      });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async claimInterfaceFee(
    params: ClaimFee,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .claim_interface_fee(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async claimInterfaceTezFee(
    params: ClaimTezFee,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .claim_interface_tez_fee(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async withdrawAuctionFee(
    params: WithdrawAuctionFee,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .withdraw_auction_fee(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async vote(
    params: DexVote,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .vote(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setAdmin(
    admin: string,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_admin(admin)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async confirmAdmin(mutezAmount: number = 0): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .confirm_admin([])
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setFlashSwapsProxy(
    flashSwapsProxy: string,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_flash_swaps_proxy(flashSwapsProxy)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setAuction(
    auction: string,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_auction(auction)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async addManagers(
    params: AddManager[],
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .add_managers(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setFees(
    params: Fees,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .set_fees(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setCollectingPeriod(
    collectingPeriod: BigNumber,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .set_collecting_period(collectingPeriod.toString())
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async updateTokenMetadata(
    params: UpdateTokenMetadata,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .update_token_metadata(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async ban(
    params: Ban,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .ban(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async permit(
    key: string,
    signature: string,
    permitHash: string,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const param = {
      "0": key,
      "1": signature,
      permit_hash: permitHash,
    };

    const operation: TransactionOperation = await this.contract.methods
      .permit([param])
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async setExpiry(
    params: SetExpiry,
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .set_expiry(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async transfer(
    params: Transfer[],
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .transfer(params)
      .send({
        amount: mutezAmount,
        mutez: true,
        fee: 1000000,
        gasLimit: 1040000,
      });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async updateOperators(
    params: UpdateOperator[],
    mutezAmount: number = 0,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .update_operators(params)
      .send({ amount: mutezAmount, mutez: true });

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async flashSwapCallback(
    params: FlashSwapCallback,
  ): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .flash_swap_callback(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async launchCallback(params: LaunchCallback): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methodsObject
      .launch_callback(params)
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  async close(): Promise<TransactionOperation> {
    const operation: TransactionOperation = await this.contract.methods
      .close([])
      .send();

    await confirmOperation(this.tezos, operation.hash);

    return operation;
  }

  static changeTokensOrderInPair(
    params: LaunchExchange,
    wrongOrder: boolean,
  ): LaunchExchange {
    let result: LaunchExchange = params;

    if (
      params.pair.token_a.hasOwnProperty("fa12") &&
      params.pair.token_b.hasOwnProperty("fa12")
    ) {
      if (wrongOrder) {
        const tokenA: FA12Token = Utils.getMaxFA12Token(
          params.pair.token_a["fa12"],
          params.pair.token_b["fa12"],
        );
        const tokenB: FA12Token = Utils.getMinFA12Token(
          params.pair.token_a["fa12"],
          params.pair.token_b["fa12"],
        );

        result.pair.token_a["fa12"] = tokenA;
        result.pair.token_b["fa12"] = tokenB;
      } else {
        const tokenA: FA12Token = Utils.getMinFA12Token(
          params.pair.token_a["fa12"],
          params.pair.token_b["fa12"],
        );
        const tokenB: FA12Token = Utils.getMaxFA12Token(
          params.pair.token_a["fa12"],
          params.pair.token_b["fa12"],
        );

        result.pair.token_a["fa12"] = tokenA;
        result.pair.token_b["fa12"] = tokenB;
      }
    } else if (
      params.pair.token_a.hasOwnProperty("fa2") &&
      params.pair.token_b.hasOwnProperty("fa2")
    ) {
      if (wrongOrder) {
        const tokenA: FA2Token = Utils.getMaxFA2Token(
          params.pair.token_a["fa2"],
          params.pair.token_b["fa2"],
        );
        const tokenB: FA2Token = Utils.getMinFA2Token(
          params.pair.token_a["fa2"],
          params.pair.token_b["fa2"],
        );

        result.pair.token_a["fa2"] = tokenA;
        result.pair.token_b["fa2"] = tokenB;
      } else {
        const tokenA: FA2Token = Utils.getMinFA2Token(
          params.pair.token_a["fa2"],
          params.pair.token_b["fa2"],
        );
        const tokenB: FA2Token = Utils.getMaxFA2Token(
          params.pair.token_a["fa2"],
          params.pair.token_b["fa2"],
        );

        result.pair.token_a["fa2"] = tokenA;
        result.pair.token_b["fa2"] = tokenB;
      }
    }

    return result;
  }

  static getRequiredTokens(shares: BigNumber, pair: Pair): RequiredTokens {
    return {
      tokens_a_required: shares
        .multipliedBy(pair.token_a_pool)
        .dividedBy(pair.total_supply)
        .integerValue(BigNumber.ROUND_DOWN),
      tokens_b_required: shares
        .multipliedBy(pair.token_b_pool)
        .dividedBy(pair.total_supply)
        .integerValue(BigNumber.ROUND_DOWN),
    };
  }

  static getTokensPerShare(shares: BigNumber, pair: Pair): TokensPerShare {
    return {
      token_a_amt: shares
        .multipliedBy(pair.token_a_pool)
        .dividedBy(pair.total_supply)
        .integerValue(BigNumber.ROUND_DOWN),
      token_b_amt: shares
        .multipliedBy(pair.token_b_pool)
        .dividedBy(pair.total_supply)
        .integerValue(BigNumber.ROUND_DOWN),
    };
  }

  static async calculateCumulativePrices(
    pair: Pair,
    utils: Utils,
  ): Promise<CumulativePrices> {
    const timeElasped: BigNumber = new BigNumber(
      (await utils.getLastBlockTimestamp()) -
        Date.parse(pair.last_block_timestamp),
    )
      .dividedBy(1000)
      .integerValue(BigNumber.ROUND_DOWN);

    if (
      timeElasped.gt(0) &&
      pair.token_a_pool.isGreaterThan(0) &&
      pair.token_b_pool.isGreaterThan(0)
    ) {
      return {
        tokenACumulativePrice: pair.token_a_price_cml.plus(
          pair.token_b_pool
            .multipliedBy(timeElasped)
            .multipliedBy(PRECISION)
            .dividedBy(pair.token_a_pool)
            .integerValue(BigNumber.ROUND_DOWN),
        ),
        tokenBCumulativePrice: pair.token_b_price_cml.plus(
          pair.token_a_pool
            .multipliedBy(timeElasped)
            .multipliedBy(PRECISION)
            .dividedBy(pair.token_b_pool)
            .integerValue(BigNumber.ROUND_DOWN),
        ),
      };
    }

    return {
      tokenACumulativePrice: pair.token_a_price_cml,
      tokenBCumulativePrice: pair.token_b_price_cml,
    };
  }

  getBalance(user: string, tokenId: BigNumber = new BigNumber(0)): BigNumber {
    return this.storage.storage.ledger[`${user},${tokenId}`] !== undefined
      ? new BigNumber(this.storage.storage.ledger[`${user},${tokenId}`])
      : new BigNumber(0);
  }

  private async getPermitParamsHash(
    tezos: TezosToolkit,
    contract: any,
    entrypoint: string,
    parameter: any,
  ): Promise<string> {
    const raw_packed: { packed: string; gas: BigNumber | "unaccounted" } =
      await tezos.rpc.packData({
        data: contract.parameterSchema.Encode(entrypoint, parameter),
        type: contract.parameterSchema.root.typeWithoutAnnotations(),
      });

    return blake.blake2bHex(hex2buf(raw_packed.packed), null, 32);
  }

  async createPermitPayload(
    tezos: TezosToolkit,
    contract: Contract,
    entrypoint: string,
    params: any,
  ): Promise<[string, string, string]> {
    const signerKey: string = await tezos.signer.publicKey();
    const permitCounter: BigNumber = await contract
      .storage()
      .then((storage: DexCoreStorage) => storage.storage.permits_counter);
    const paramHash: string = await this.getPermitParamsHash(
      tezos,
      contract,
      entrypoint,
      params,
    );
    const chainId: string = await tezos.rpc.getChainId();
    const bytesToSign: { packed: string; gas: BigNumber | "unaccounted" } =
      await tezos.rpc.packData({
        data: permitSchema.Encode({
          0: contract.address,
          1: chainId,
          2: permitCounter,
          3: paramHash,
        }),
        type: permitSchemaType,
      });
    const signature: string = await tezos.signer
      .sign(bytesToSign.packed)
      .then(s => s.prefixSig);

    return [signerKey, signature, paramHash];
  }

  static calculateSwap(
    fees: Fees,
    amountIn: BigNumber,
    fromPool: BigNumber,
    toPool: BigNumber,
  ): CalculateSwap {
    const feeRate: BigNumber = fees.interface_fee
      .plus(fees.swap_fee)
      .plus(fees.auction_fee);
    const rateWithoutFee: BigNumber = PRECISION.minus(feeRate);
    const fromInWithFee: BigNumber = amountIn.multipliedBy(rateWithoutFee);
    const numerator: BigNumber = fromInWithFee.multipliedBy(toPool);
    const denominator: BigNumber = fromPool
      .multipliedBy(PRECISION)
      .plus(fromInWithFee);
    const out: BigNumber = numerator
      .dividedBy(denominator)
      .integerValue(BigNumber.ROUND_DOWN);
    const interfaceFee: BigNumber = amountIn.multipliedBy(fees.interface_fee);
    const amountWithSwapFee: BigNumber = fromInWithFee
      .plus(amountIn.multipliedBy(fees.swap_fee))
      .dividedBy(PRECISION)
      .integerValue(BigNumber.ROUND_DOWN);
    const auctionFee: BigNumber = amountIn
      .multipliedBy(PRECISION)
      .minus(amountWithSwapFee.multipliedBy(PRECISION))
      .minus(interfaceFee);
    const newFromPool: BigNumber = fromPool.plus(amountWithSwapFee);
    const newToPool: BigNumber = toPool.minus(out);

    return {
      out,
      interfaceFee,
      auctionFee,
      newFromPool,
      newToPool,
    };
  }
}
