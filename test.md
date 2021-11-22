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
     - ✅ should fail if user have not enough TEZ on his contract's balance;
     - ✅ should divest tez for alice;
     - ✅ should divest tez for carol - 1;
     - ✅ should divest tez for carol - 2.

  3. `withdraw_rewards`:

     -

  4. `ban_baker`:

     - ✅ should fail if not dex core is trying to ban baker;
     - ✅ should ban baker;
     - ✅ should unban baker.

  5. `vote`:

     -

  6. `is_banned_baker` [VIEW]:

     - ✅ should return true if baker is banned;
     - ✅ should return false if baker is not banned;
     - ✅ should return false if baker's banning period is finished.

  7. `get_tez_balance` [VIEW]:

     -

## FlashSwapsProxy

- 02_flash_swaps_proxy.spec.ts

  1.  `quipuswap_v2_call`:

      -

## DexCore

- 03_dex_core_admin_methods.spec.ts

  1. `launch_exchange`:

     -

  2. `invest_liquidity`:

     -

  3. `divest_liquidity`:

     -

  4. `flash_swap`:

     -

  5. `swap`:

     -

  6. `withdraw_profit`:

     -

  7. `set_admin`:

     - ✅ should fail if not admin is trying to setup new pending admin;
     - ✅ should setup new pending admin by admin.

  8. `confirm_admin`:

     - ✅ should fail if not pending admin is trying to confirm new admin;
     - ✅ should confirm new admin by pending admin.

  9. `set_flash_swaps_proxy`:

     -

  10. `add_managers`:

      - ✅ should fail if not admin is trying to add new manager;
      - ✅ should add one manager;
      - ✅ should remove one manager;
      - ✅ should add a group of managers;
      - ✅ should remove a group of managers;
      - ✅ shoud add/remove some groups of managers.

  11. `set_fees`:

      - ✅ should fail if not admin is trying to set fees;
      - ✅ should update fees.

  12. `set_cycle_duration`:

      - ✅ should fail if not admin is trying to set cycle duration;
      - ✅ should update cycle duration.

  13. `set_voting_period`:

      -

  14. `set_collecting_period`:

      -

  15. `update_token_metadata`:

      - ✅ should fail if not manager is trying to update token metadata;
      - ✅ should fail if pair not listed;
      - ✅ should update existing fields in token metadata;
      - ✅ should set new fields in token metadata;
      - ✅ should update existing and set new fields in token metadata.

  16. `ban`:

      - ✅ should fail if not admin is trying to ban baker;
      - ✅ should fail if pair not listed;
      - ✅ should fail if tez store not found (not TEZ/TOK pair);
      - ✅ should ban baker;
      - ✅ should unban baker.

  17. `permit`:

      -

  18. `ser_expiry`:

      -

  19. `transfer`:

      -

  20. `update_operators`:

      -

  21. `balance_of`:

      -

  22. `fa12_balance_callback_1`:

      -

  23. `fa2_balance_callback_1`:

      -

  24. `fa12_balance_callback_2`:

      -

  25. `fa2_balance_callback_2`:

      -

  26. `flash_swap_callback`:

      -

  27. `check_is_banned_baker` [VIEW]:

      -

  28. `get_reserves` [VIEW]:

      -

  29. `get_total_supply` [VIEW]:

      -

  30. `get_swap_min_res` [VIEW]:

      -

  31. `get_toks_per_share` [VIEW]:

      -

  32. `get_cumulative_prices` [VIEW]:

      -

  33. `get_voting_period` [VIEW]:

      -

  34. `get_collecting_period` [VIEW]:

      -

  35. `get_cycle_duration` [VIEW]:

      -
