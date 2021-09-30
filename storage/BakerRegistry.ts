import { MichelsonMap } from "@taquito/michelson-encoder";

import { BakerRegistryStorage } from "../test/types/BakerRegistry";

export const bakerRegistryStorage: BakerRegistryStorage =
  MichelsonMap.fromLiteral({});
