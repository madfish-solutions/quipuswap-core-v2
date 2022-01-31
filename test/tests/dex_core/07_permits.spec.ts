// import { TezosToolkit } from "@taquito/taquito";
// import { hex2buf } from "@taquito/utils";

// import { DexCore as DexCoreErrors } from "../../helpers/Errors";
// import { BakerRegistry } from "../../helpers/BakerRegistry";
// import { Auction } from "../../helpers/Auction";
// import { DexCore } from "../../helpers/DexCore";
// import { FA12 } from "../../helpers/FA12";
// import { FA2 } from "../../helpers/FA2";
// import { defaultCollectingPeriod, Utils } from "../../helpers/Utils";

// import { rejects } from "assert";

// import chai, { expect } from "chai";

// import { BigNumber } from "bignumber.js";

// import accounts from "../../../scripts/sandbox/accounts";

// import { bakerRegistryStorage } from "../../../storage/BakerRegistry";
// import { auctionStorage } from "../../../storage/Auction";
// import { dexCoreStorage } from "../../../storage/DexCore";
// import { fa12Storage } from "../../../storage/test/FA12";
// import { fa2Storage } from "../../../storage/test/FA2";

// import { DexCoreStorage, LaunchExchange } from "test/types/DexCore";
// import { SBAccount } from "test/types/Common";

// import blake from "blakejs";

// chai.use(require("chai-bignumber")(BigNumber));

// describe.only("DexCore (permits)", async () => {
//   var utils: Utils;
//   var bakerRegistry: BakerRegistry;
//   var auction: Auction;
//   var dexCore: DexCore;
//   var fa12Token1: FA12;
//   var fa12Token2: FA12;
//   var fa12Token3: FA12;
//   var fa2Token1: FA2;
//   var fa2Token2: FA2;
//   var fa2Token3: FA2;

//   var alice: SBAccount = accounts.alice;
//   var bob: SBAccount = accounts.bob;

//   before("setup", async () => {
//     utils = new Utils();

//     await utils.init(alice.sk);

//     bakerRegistry = await BakerRegistry.originate(
//       utils.tezos,
//       bakerRegistryStorage
//     );

//     dexCoreStorage.storage.admin = alice.pkh;
//     dexCoreStorage.storage.collecting_period = defaultCollectingPeriod;
//     dexCoreStorage.storage.baker_registry = bakerRegistry.contract.address;

//     dexCore = await DexCore.originate(utils.tezos, dexCoreStorage);

//     await dexCore.setLambdas();

//     fa12Token1 = await FA12.originate(utils.tezos, fa12Storage);
//     fa12Token2 = await FA12.originate(utils.tezos, fa12Storage);
//     fa12Token3 = await FA12.originate(utils.tezos, fa12Storage);
//     fa2Token1 = await FA2.originate(utils.tezos, fa2Storage);
//     fa2Token2 = await FA2.originate(utils.tezos, fa2Storage);
//     fa2Token3 = await FA2.originate(utils.tezos, fa2Storage);

//     auctionStorage.storage.admin = alice.pkh;
//     auctionStorage.storage.dex_core = dexCore.contract.address;
//     auctionStorage.storage.quipu_token = fa2Token1.contract.address;

//     auction = await Auction.originate(utils.tezos, auctionStorage);

//     await auction.setLambdas();
//   });

//   function getBytesToSignFromErrors(errors): string {
//     const errors_with: string[] = errors
//       .filter((x) => x.with !== undefined)
//       .map((x) => x.with);

//     if (errors_with.length != 1) {
//       throw [
//         'errors_to_missigned_bytes: expected one error to fail "with" michelson, but found:',
//         errors_with,
//       ];
//     }

//     const error_with = errors_with[0];

//     if (error_with.prim !== "Pair") {
//       throw [
//         'errors_to_missigned_bytes: expected a "Pair", but found:',
//         error_with.prim,
//       ];
//     }

//     const error_with_args = error_with.args;

//     if (error_with_args.length !== 2) {
//       throw [
//         'errors_to_missigned_bytes: expected two arguments to "Pair", but found:',
//         error_with_args,
//       ];
//     }

//     if (error_with_args[0].string.toLowerCase() !== "missigned") {
//       throw [
//         'errors_to_missigned_bytes: expected a "missigned" annotation, but found:',
//         error_with_args[0],
//       ];
//     }

//     if (typeof error_with_args[1].bytes !== "string") {
//       throw [
//         "errors_to_missigned_bytes: expected bytes, but found:",
//         error_with_args[1],
//       ];
//     }

//     return error_with_args[1].bytes;
//   }

//   async function permitParamHash(tz, contract, entrypoint, parameter) {
//     const raw_packed = await tz.rpc.packData({
//       data: contract.parameterSchema.Encode(entrypoint, parameter),
//       type: contract.parameterSchema.root.typeWithoutAnnotations(),
//     });
//     console.log(`PACKED PARAM: ${raw_packed.packed}`);
//     return blake.blake2bHex(hex2buf(raw_packed.packed), null, 32);
//   }

//   async function createPermitPayload(
//     tezos: TezosToolkit,
//     contract,
//     entrypoint,
//     params
//   ) {
//     const signer_key: string = await tezos.signer.publicKey();
//     const dummy_sig: string = await tezos.signer
//       .sign("abcd")
//       .then((s) => s.prefixSig);
//     const param_hash: string = await permitParamHash(
//       tezos,
//       contract,
//       entrypoint,
//       params
//     );
//     const transfer_params = contract.methods
//       .permit(signer_key, dummy_sig, param_hash)
//       .toTransferParams();
//     const bytesToSign = await tezos.estimate
//       .transfer(transfer_params)
//       .catch((e) => getBytesToSignFromErrors(e.errors));

//     console.log(`param hash ${param_hash}`);
//     console.log(`bytes to sign ${bytesToSign}`);

//     const sig = await tezos.signer.sign(bytesToSign).then((s) => s.prefixSig);

//     return [signer_key, sig, param_hash];
//   }

//   it("bob generates permit payload, alice submits it to contract", async () => {
//     const transferParams = [
//       {
//         from_: bob.pkh,
//         txs: [{ to_: alice.pkh, token_id: 0, amount: 10 }],
//       },
//     ];

//     utils.setProvider(alice.sk);

//     let permitContractAlice = await utils.tezos.contract.at(
//       dexCore.contract.address
//     );

//     utils.setProvider(bob.sk);

//     let [bobsKey, bobsSig, permitHash] = await createPermitPayload(
//       utils.tezos,
//       dexCore.contract,
//       "transfer",
//       transferParams
//     );
//     let op = await permitContractAlice.methods
//       .permit(bobsKey, bobsSig, permitHash)
//       .send();
//     console.log(1);

//     await op.confirmation();

//     let storage: DexCoreStorage = await permitContractAlice.storage();
// let permitValue = storage.storage.permits
//   .get(bob.pkh)
//   .then((bobs_permits) => bobs_permits.permits);

// console.log(permitValue.has(permitHash));
// });

// it("carol calls contract entrypoint on bob's behalf", async () => {
//   let transferParams2 = [
//     {
//       from_: bob.pkh,
//       txs: [{ to_: alice.pkh, token_id: 0, amount: 10 }],
//     },
//   ];

//   let permitContractCarol = await tzCarol.contract.at(contractAddress);
//   let op = await permitContractCarol.methods.transfer(transferParams2).send();
//   await op.confirmation();
// });

// it("carol can't use bob's transfer anymore", async () => {
//   let permitContractCarol = await tzCarol.contract.at(contractAddress);
//   try {
//     let transferParams2 = [
//       {
//         from_: bob.pkh,
//         txs: [{ to_: alice.pkh, token_id: 0, amount: 10 }],
//       },
//     ];

//     let op = await permitContractCarol.methods
//       .transfer(transferParams2)
//       .send();
//     await op.confirmation();
//   } catch (e) {
//     console.log("Error message");
//   }
// });

// it("bob generates permit, alice submits it, bob sets expiry", async () => {
//   let transferParams = [
//     {
//       from_: bob.pkh,
//       txs: [{ to_: alice.pkh, token_id: 0, amount: 11 }],
//     },
//   ];

//   let permitContractAlice = await tzAlice.contract.at(contractAddress);
//   let [bobsKey, bobsSig, permitHash] = await createPermitPayload(
//     tzBob,
//     fa2.contract,
//     "transfer",
//     transferParams
//   );
//   let op = await permitContractAlice.methods
//     .permit(bobsKey, bobsSig, permitHash)
//     .send();
//   await op.confirmation();

//   const permitContractBob = await tzBob.contract.at(contractAddress);
//   op = await permitContractBob.methods
//     .set_expiry(bob.pkh, 60, permitHash)
//     .send();
//   await op.confirmation();

//   let storage = await permitContractAlice.storage();
//   let permitValue = await storage.permits
//     .get(bob.pkh)
//     .then((bobs_permits) => bobs_permits.permits);
//   console.log(permitValue.has(permitHash));

//   console.log("permit value", permitValue);

//   let permitExpiry = await storage.permits
//     .get(bob.pkh)
//     .then((bobs_permits) => bobs_permits.expiry);

//   let permit = await permitValue.get(permitHash);
//   strictEqual(permit.expiry.toNumber(), 60);
// });

// it("carol calls entrypoint on bob's behalf, but its too late", async () => {
//   let transferParams2 = [
//     {
//       from_: bob.pkh,
//       txs: [{ to_: alice.pkh, token_id: 0, amount: 11 }],
//     },
//   ];

//   let permitContractCarol = await tzCarol.contract.at(contractAddress);

//   rejects(await permitContractCarol.methods.transfer(transferParams2).send());
// });
// });
