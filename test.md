# Test coverage for contracts

## BakerRegistry

- 00_baker_registry.spec.ts

  1.  `validate`:

      - ✅ should do nothing if baker is registered;
      - ✅ should register a new baker if baker is not registered;
      - ✅ should fail if the baker is not registered and the address to register is not a baker.

  2.  `register`:

      - ✅ should register a new baker;
      - ✅ should fail if address to register is not a baker.

## TezStore

- 01_tez_store.spec.ts

  1. `ban_baker`:

     - ✅ should fail if not dex core is trying to ban baker;
     - ✅ should ban baker;
     - ✅ should unban baker.

## DexCore

- 02_dex_core_admin_methods.spec.ts

  1.  `set_admin`:

      - ✅ should fail if not admin is trying to setup new pending admin;
      - ✅ should setup new pending admin by admin.

  2.  `confirm_admin`:

      - ✅ should fail if not pending admin is trying to confirm new admin;
      - ✅ should confirm new admin by pending admin.

  3.  `add_managers`:

      - ✅ should fail if not admin is trying to add new manager;
      - ✅ should add one manager;
      - ✅ should remove one manager;
      - ✅ should add a group of managers;
      - ✅ should remove a group of managers;
      - ✅ shoud add/remove some groups of managers.

  4.  `set_fees`:

      - ✅ should fail if not admin is trying to set fees;
      - ✅ should update fees.

  5.  `set_cycle_duration`:

      - ✅ should fail if not admin is trying to set cycle duration;
      - ✅ should update cycle duration.

  6.  `update_token_metadata`:

      - ✅ should fail if not manager is trying to update token metadata;
      - ✅ should fail if pair not listed;
      - ✅ should update existing fields in token metadata;
      - ✅ should set new fields in token metadata;
      - ✅ should update existing and set new fields in token metadata.

  7.  `ban`:

      - ✅ should fail if not admin is trying to ban baker;
      - ✅ should fail if pair not listed;
      - ✅ should fail if tez store not found (not TEZ/TOK pair);
      - ✅ should ban baker;
      - ✅ should unban baker.
