# Quipuswap Core V2

The second version ot the Quipuswap DEX.

This version will support both TOKEN/TOKEN and TOKEN/TEZ pools, implement more
essential view methods, flash loans, referral and QUIPU buyback fees, better
mechanics for voting and baker rewards distribution, time-weighted average price
for oracles etc.

# Contracts

BakerRegistry: KT1LEetjBZK1mWBrzNQJASbd8JDzXs5UVrYy
DexCore: KT1AsS9E8qs3z9JtYRxHtmvFFoaWGVYapLHN
AuctionMock: KT1GD7oB2hrqGypHPEsyU1Xnv9CRX7qQi6J8
FlashSwapsProxy: KT1JCGdMMYnAH9crDPftXhpmLh5uqVKwnMHZ

# Requiremets

- Installed [NodeJS](https://nodejs.org/en/) (tested with NodeJS v17+);
- Installed
  [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable);
- Installed node modules:

  ```shell
    yarn install
  ```

# Compiling

Compilation is splitted into a few steps.

To compile all contracts (without lambdas) run the next command:

```shell
  yarn compile
```

To just compile lambdas run the next command:

```shell
  yarn compile-lambdas
```

As well, you can separate compile lambdas for `DexCore` or `Auction` contracts.
For this purpose run one of the next commands:

```shell
yarn compile-dex-core-lambdas
yarn compile-auction-lambdas
```

Also, you can pre compile `Bucket` contract separately (in `.tz` format, needed
for deploying from the `DexCore`). For this purpose run the next command:

```shell
  yarn pre-compile
```

Full compilation of contracts and all lambdas can be done with the following
command:

```shell
  yarn full-compile
```

# Testing

To run all the tests execute the next command:

```shell
  yarn start-sandbox && yarn test
```

# Deploy

To deploy the contracts you should run the following command:

```shell
  yarn migrate
```

By default, the contracts will be deployed to the `development` network (in the
Docker container).

Also, you can specify the network for deploying (possible networks: `ithacanet`,
`mainnet`):

```shell
  yarn migrate -n [network_name]
```

Or just execute one of this commands:

```shell
  yarn migrate-ithacanet
  yarn migrate-mainnet
```
