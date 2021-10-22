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

  1. `invest_tez`:

     - ✅ should fail if not dex core is trying to invest tez;
     - ✅ should invest tez for alice;
     - ✅ should invest tez for carol - 1;
     - ✅ should invest tez for carol - 2.

  2. `divest_tez`:

     - ✅ should fail if not dex core is trying to divest tez;
     - ✅ should fail if tez store have not enough TEZ on contract's balance;
     - ✅ should fail if voter have not enough TEZ on his contract's balance;
     - ✅ should divest tez for alice;
     - ✅ should divest tez for carol - 1;
     - ✅ should divest tez for carol - 2.

  3. `ban_baker`:

     - ✅ should fail if not dex core is trying to ban baker;
     - ✅ should ban baker;
     - ✅ should unban baker.

  4. `vote`:

     -

  5. `is_banned_baker`:

     - ✅ should return true if baker is banned;
     - ✅ should return false if baker is not banned;
     - ✅ should return false if baker's banning period is finished.

## DexCore

- 02_dex_core_admin_methods.spec.ts

  1. `launch_exchange`:

     -

  2. `invest_liquidity`:

     -

  3. `divest_liquidity`:

     -

  4. `swap`:

     -

  5. `set_admin`:

     - ✅ should fail if not admin is trying to setup new pending admin;
     - ✅ should setup new pending admin by admin.

  6. `confirm_admin`:

     - ✅ should fail if not pending admin is trying to confirm new admin;
     - ✅ should confirm new admin by pending admin.

  7. `add_managers`:

     - ✅ should fail if not admin is trying to add new manager;
     - ✅ should add one manager;
     - ✅ should remove one manager;
     - ✅ should add a group of managers;
     - ✅ should remove a group of managers;
     - ✅ shoud add/remove some groups of managers.

  8. `set_fees`:

     - ✅ should fail if not admin is trying to set fees;
     - ✅ should update fees.

  9. `set_cycle_duration`:

     - ✅ should fail if not admin is trying to set cycle duration;
     - ✅ should update cycle duration.

  10. `update_token_metadata`:

      - ✅ should fail if not manager is trying to update token metadata;
      - ✅ should fail if pair not listed;
      - ✅ should update existing fields in token metadata;
      - ✅ should set new fields in token metadata;
      - ✅ should update existing and set new fields in token metadata.

  11. `ban`:

      - ✅ should fail if not admin is trying to ban baker;
      - ✅ should fail if pair not listed;
      - ✅ should fail if tez store not found (not TEZ/TOK pair);
      - ✅ should ban baker;
      - ✅ should unban baker.

  12. `permit`:

      -

  13. `ser_expiry`:

      -

  14. `transfer`:

      -

  15. `update_operators`:

      -

  16. `balance_of`:

      -

  17. `get_reserves`:

      -

  18. `get_total_supply`:

      -

  19. `check_is_banned_baker`:

      -
