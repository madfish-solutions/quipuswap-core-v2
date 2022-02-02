import {
  TransactionOperation,
  TezosToolkit,
  MichelsonMap,
} from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";

import { BigNumber } from "bignumber.js";

import { confirmOperation } from "../../scripts/confirmation";

import env from "../../env";

import { FA12Token, FA2Token } from "../types/Common";

const defaultNetwork = "development";
const network = env.network || defaultNetwork;

export class Utils {
  tezos: TezosToolkit;

  async init(providerSK: string): Promise<void> {
    const networkConfig = env.networks[network];

    this.tezos = new TezosToolkit(networkConfig.rpc);
    this.tezos.setProvider({
      config: {
        confirmationPollingTimeoutSecond: env.confirmationPollingTimeoutSecond,
      },
      signer: await InMemorySigner.fromSecretKey(providerSK),
    });
  }

  async setProvider(newProviderSK: string): Promise<void> {
    this.tezos.setProvider({
      signer: await InMemorySigner.fromSecretKey(newProviderSK),
    });
  }

  async bakeBlocks(count: number) {
    for (let i: number = 0; i < count; ++i) {
      const operation: TransactionOperation =
        await this.tezos.contract.transfer({
          to: await this.tezos.signer.publicKeyHash(),
          amount: 1,
        });

      await confirmOperation(this.tezos, operation.hash);
    }
  }

  async getLastBlockTimestamp(): Promise<number> {
    return Date.parse((await this.tezos.rpc.getBlockHeader()).timestamp);
  }

  static destructObj(obj: any) {
    const strs: string[] = ["tez", "fa12", "fa2", "tokan_a", "tokan_b"];
    let arr: any[] = [];

    Object.keys(obj).map(function (k) {
      if (strs.includes(k)) {
        arr.push(k);
      }

      if (obj[k] instanceof BigNumber) {
        arr.push(obj[k].toFixed());
      } else if (obj[k] instanceof MichelsonMap || Array.isArray(obj[k])) {
        arr.push(obj[k]);
      } else if (
        typeof obj[k] === "object" &&
        (!(obj[k] instanceof Date) ||
          !(obj[k] instanceof null) ||
          !(obj[k] instanceof undefined))
      ) {
        arr = arr.concat(Utils.destructObj(obj[k]));
      } else {
        arr.push(obj[k]);
      }
    });

    return arr;
  }

  static getMinFA12Token(tokenA: FA12Token, tokenB: FA12Token): string {
    return tokenA < tokenB ? tokenA : tokenB;
  }

  static getMaxFA12Token(tokenA: FA12Token, tokenB: FA12Token): string {
    return tokenA > tokenB ? tokenA : tokenB;
  }

  static getMinFA2Token(tokenA: FA2Token, tokenB: FA2Token): FA2Token {
    if (tokenA.token < tokenB.token) {
      return tokenA;
    } else if (tokenA.token > tokenB.token) {
      return tokenB;
    } else {
      return tokenA.id < tokenB.id ? tokenA : tokenB;
    }
  }

  static getMaxFA2Token(tokenA: FA2Token, tokenB: FA2Token): FA2Token {
    if (tokenA.token > tokenB.token) {
      return tokenA;
    } else if (tokenA.token < tokenB.token) {
      return tokenB;
    } else {
      return tokenA.id > tokenB.id ? tokenA : tokenB;
    }
  }

  static parseOnChainViewError(json: any[]): string {
    for (let i: number = 0; i < json.length; ++i) {
      for (var key in json[i]) {
        if (key === "with") {
          return json[i][key]["string"];
        }
      }
    }

    return "";
  }
}

export const zeroAddress: string = "tz1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZNkiRg";

export const defaultCycleDuration: BigNumber = new BigNumber(4096);

export const defaultCollectingPeriod: BigNumber =
  defaultCycleDuration.multipliedBy(new BigNumber(12));

export const defaultVotingPeriod: BigNumber = new BigNumber(2);
