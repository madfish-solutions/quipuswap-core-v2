import { FlashSwapAgentStorage } from "../../test/types/FlashSwapAgent";

import { zeroAddress } from "../../test/helpers/Utils";

import { BigNumber } from "bignumber.js";

export const flashSwapAgentStorage: FlashSwapAgentStorage = {
  dex_core: zeroAddress,
  val: new BigNumber(0),
};
