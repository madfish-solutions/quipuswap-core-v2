import { BigNumber } from "bignumber.js";

export type Tez = undefined;

export type FA12Token = string;

export type FA2Token = {
  token: string;
  id: BigNumber;
};

export type Token = { tez: Tez } | { fa12: FA12Token } | { fa2: FA2Token };
