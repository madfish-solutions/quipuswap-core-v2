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
  voters: MichelsonMap<MichelsonMapKey, unknown>;
  bakers: MichelsonMap<MichelsonMapKey, unknown>;
  user_rewards: MichelsonMap<MichelsonMapKey, unknown>;
  current_delegated: string | undefined | null;
  next_candidate: string | undefined | null;
  baker_registry: string;
  dex_core: string;
  total_votes: BigNumber;
  reward: BigNumber;
  total_reward: BigNumber;
  reward_per_share: BigNumber;
  reward_per_second: BigNumber;
  cycle_duration: BigNumber;
  period_finish: BigNumber;
  last_update_level: BigNumber;
  total_supply: BigNumber;
};
