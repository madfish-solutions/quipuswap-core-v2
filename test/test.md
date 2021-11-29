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

  6. `default`:

     -

  7. `is_banned_baker` [VIEW]:

     - should return true if baker is banned;
     - should return false if baker is not banned;
     - should return false if baker's banning period is finished.

  8. `get_tez_balance` [VIEW]:

     -

  9. `get_user_candidate` [VIEW]:

     -

## FlashSwapsProxy

- 02_flash_swaps_proxy.spec.ts

  1.  `call`:

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

  7. `claim_tok_interface_fee`:

     -

  8. `claim_tez_interface_fee`:

     -

  9. `withdraw_auction_fee`:

     -

  10. `set_admin`:

      - ✅ should fail if not admin is trying to setup new pending admin;
      - ✅ should setup new pending admin by admin.

  11. `confirm_admin`:

      - ✅ should fail if not pending admin is trying to confirm new admin;
      - ✅ should confirm new admin by pending admin.

  12. `set_flash_swaps_proxy`:

      - ✅ should fail if not admin is trying to setup new flash swaps proxy;
      - ✅ should setup new flash swaps proxy.

  13. `set_auction`:

      - ✅ should fail if not admin is trying to setup new auction;
      - ✅ should setup new auction.

  14. `add_managers`:

      - ✅ should fail if not admin is trying to add new manager;
      - ✅ should add one manager;
      - ✅ should remove one manager;
      - ✅ should add a group of managers;
      - ✅ should remove a group of managers;
      - ✅ shoud add/remove some groups of managers.

  15. `set_fees`:

      - ✅ should fail if not admin is trying to set fees;
      - ✅ should update fees.

  16. `set_cycle_duration`:

      - ✅ should fail if not admin is trying to set cycle duration;
      - ✅ should update cycle duration.

  17. `set_voting_period`:

      - ✅ should fail if not admin is trying to setup new voting period;
      - ✅ should setup new voting period.

  18. `set_collecting_period`:

      - ✅ should fail if not admin is trying to setup new collecting period;
      - ✅ should setup new collecting period.

  19. `update_token_metadata`:

      - ✅ should fail if not manager is trying to update token metadata;
      - ✅ should fail if pair not listed;
      - ✅ should update existing fields in token metadata;
      - ✅ should set new fields in token metadata;
      - ✅ should update existing and set new fields in token metadata.

  20. `ban`:

      - ✅ should fail if not admin is trying to ban baker;
      - ✅ should fail if pair not listed;
      - ✅ should fail if tez store not found (not TEZ/TOK pair);
      - ✅ should ban baker;
      - ✅ should unban baker.

  21. `permit`:

      -

  22. `ser_expiry`:

      -

  23. `transfer`:

      -

  24. `update_operators`:

      -

  25. `balance_of`:

      -

  26. `fa12_balance_callback_1`:

      -

  27. `fa2_balance_callback_1`:

      -

  28. `fa12_balance_callback_2`:

      -

  29. `fa2_balance_callback_2`:

      -

  30. `flash_swap_callback`:

      -

  31. `launch_callback`:

      -

  32. `check_is_banned_baker` [VIEW]:

      -

  33. `get_reserves` [VIEW]:

      -

  34. `get_total_supply` [VIEW]:

      -

  35. `get_swap_min_res` [VIEW]:

      -

  36. `get_toks_per_share` [VIEW]:

      -

  37. `get_cumulative_prices` [VIEW]:

      -

  38. `get_voting_period` [VIEW]:

      -

  39. `get_collecting_period` [VIEW]:

      -

  40. `get_cycle_duration` [VIEW]:

      -

## Auction

- 04_auction.spec.ts

  1. `receive_fee`:

     -

  2. `launch_auction`:

     -

  3. `place_bid`:

     -

  4. `claim`:

     -

  5. `set_admin`:

     -

  6. `confirm_admin`:

     -

  7. `set_baker`:

     -

  8. `set_fees`:

     -

  9. `set_auction_duration`:

     -

  10. `set_min_bid`:

      -

  11. `update_whitelist`:

      -

  12. `withdraw_dev_fee`:

      -

  13. `withdraw_public_fee`:

      -

  14. `burn_bid_fee`:

      -
