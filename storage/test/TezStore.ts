import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { zeroAddress } from "test/helpers/Utils";

import { TezStoreStorage } from "test/types/TezStore";

export const tezStoreStorage: TezStoreStorage = {
  users: MichelsonMap.fromLiteral({}),
  bakers: MichelsonMap.fromLiteral({}),
  users_rewards: MichelsonMap.fromLiteral({}),
  current_delegated: zeroAddress,
  next_candidate: zeroAddress,
  baker_registry: null,
  dex_core: null,
  pair_id: new BigNumber(0),
  next_reward: new BigNumber(0),
  total_reward: new BigNumber(0),
  reward_paid: new BigNumber(0),
  reward_per_share: new BigNumber(0),
  reward_per_block: new BigNumber(0),
  last_update_level: new BigNumber(0),
  collecting_period_ends: new BigNumber(0),
  voting_period_ends: new BigNumber(0),
};
