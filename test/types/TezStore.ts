import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

export type InvestTez = {
  user: string;
  total_supply: BigNumber;
};

export type DivestTez = {
  receiver: string;
  user: string;
  amt: BigNumber;
  total_supply: BigNumber;
};

export type BanBaker = {
  baker: string;
  ban_period: BigNumber;
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
