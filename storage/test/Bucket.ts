import { MichelsonMap } from "@taquito/michelson-encoder";

import { BigNumber } from "bignumber.js";

import { zeroAddress } from "../../test/helpers/Utils";

import { BucketStorage } from "../../test/types/Bucket";

export const bucketStorage: BucketStorage = {
  users: MichelsonMap.fromLiteral({}),
  bakers: MichelsonMap.fromLiteral({}),
  users_rewards: MichelsonMap.fromLiteral({}),
  previous_delegated: zeroAddress,
  current_delegated: zeroAddress,
  next_candidate: zeroAddress,
  baker_registry: zeroAddress,
  dex_core: zeroAddress,
  pair_id: new BigNumber(0),
  next_reward: new BigNumber(0),
  total_reward: new BigNumber(0),
  reward_paid: new BigNumber(0),
  reward_per_share: new BigNumber(0),
  reward_per_block: new BigNumber(0),
  last_update_level: new BigNumber(0),
  collecting_period_end: new BigNumber(0),
  voting_period_end: new BigNumber(0),
};
