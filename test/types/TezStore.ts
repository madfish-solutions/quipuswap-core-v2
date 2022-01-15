import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

export type DivestTez = {
  receiver: string;
  amt: BigNumber;
};

export type WithdrawRewards = {
  receiver: string;
  user: string;
  current_balance: BigNumber;
  new_balance: BigNumber;
};

export type BanBaker = {
  baker: string;
  ban_period: BigNumber;
};

export type Vote = {
  voter: string;
  candidate: string;
  execute_voting: boolean;
  votes: BigNumber;
  current_balance: BigNumber;
  new_balance: BigNumber;
};

export type TezStoreStorage = {
  users: MichelsonMap<MichelsonMapKey, unknown>;
  bakers: MichelsonMap<MichelsonMapKey, unknown>;
  users_rewards: MichelsonMap<MichelsonMapKey, unknown>;
  current_delegated: string;
  next_candidate: string;
  baker_registry: string;
  dex_core: string;
  pair_id: BigNumber;
  next_reward: BigNumber;
  total_reward: BigNumber;
  reward_paid: BigNumber;
  reward_per_share: BigNumber;
  reward_per_block: BigNumber;
  last_update_level: BigNumber;
  collecting_period_ends: BigNumber;
  voting_period_ends: BigNumber;
};
