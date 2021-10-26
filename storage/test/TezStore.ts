import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { zeroAddress } from "test/helpers/Utils";

import { TezStoreStorage } from "test/types/TezStore";

export const tezStoreStorage: TezStoreStorage = {
  voters: MichelsonMap.fromLiteral({}),
  bakers: MichelsonMap.fromLiteral({}),
  user_rewards: MichelsonMap.fromLiteral({}),
  current_delegated: zeroAddress,
  next_candidate: zeroAddress,
  baker_registry: null,
  dex_core: null,
  total_votes: new BigNumber(0),
  reward: new BigNumber(0),
  total_reward: new BigNumber(0),
  reward_per_share: new BigNumber(0),
  reward_per_second: new BigNumber(0),
  cycle_duration: new BigNumber(0),
  period_finish: new BigNumber(0),
  last_update_level: new BigNumber(0),
  total_supply: new BigNumber(0),
};
