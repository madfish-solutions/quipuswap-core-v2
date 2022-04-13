import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

export type User = {
  candidate: string | null | undefined;
  votes: BigNumber;
};

export type Baker = {
  ban_start_time: string;
  ban_period: BigNumber;
  votes: BigNumber;
};

export type PourOut = {
  receiver: string;
  amt: BigNumber;
};

export type PourOver = {
  bucket: string;
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
};

export type BucketStorage = {
  users: MichelsonMap<MichelsonMapKey, unknown>;
  bakers: MichelsonMap<MichelsonMapKey, unknown>;
  users_rewards: MichelsonMap<MichelsonMapKey, unknown>;
  previous_delegated: string;
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
  collecting_period_end: BigNumber;
};

export type UpdateRewards = {
  rewardPerShare: BigNumber;
  rewardPerBlock: BigNumber;
  totalReward: BigNumber;
  lastUpdateLevel: BigNumber;
  collectingPeriodEnd: BigNumber;
};

export type UpdateUserRewards = {
  reward_f: BigNumber;
  rewardPaid_f: BigNumber;
};
