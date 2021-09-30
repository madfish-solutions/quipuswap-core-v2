import { MichelsonMap, MichelsonMapKey } from "@taquito/michelson-encoder";

export type BakerRegistryStorage = MichelsonMap<MichelsonMapKey, unknown>;
