# Test coverage for contracts

## BakerRegistry

1.  `validate`:

    - ✅ should do nothing if baker is registered;
    - ✅ should register a new baker if baker is not registered;
    - ✅ should fail if the baker is not registered and the address to register is not a baker.

2.  `register`:

    - ✅ should register a new baker;
    - ✅ should fail if address to register is not a baker.

## TezStore

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

   - ✅ should fail if not dex core is trying to vote;
   -

6. `default`:

   -

7. `is_banned_baker` [VIEW]:

   - ✅ should return true if baker is banned;
   - ✅ should return false if baker is not banned;
   - ✅ should return false if baker's banning period is finished.

8. `get_tez_balance` [VIEW]:

   - ✅ should return zero balance;
   - ✅ should return positive balance - 1;
   - ✅ should return positive balance - 2.

9. `get_user_candidate` [VIEW]:

   - ✅ should return user's candidate is user have a candidate;
   - ✅ should return current delegated if user does not have a candidate;
   - ✅ should return `zero_key_hash` if contract does not have a delegate.

## FlashSwapsProxy

1.  `call`:

    - should fail if not dex core is trying to call;
    -

## DexCore

1. `launch_exchange`:

   - ✅ should fail if wrong pair order was passed with TEZ token and TEZ token;
   - ✅ should fail if wrong pair order was passed with FA1.2 token and TEZ token;
   - ✅ should fail if wrong pair order was passed with FA2 token and TEZ token;
   - ✅ should fail if wrong pair order was passed with FA1.2 token and FA1.2 token;
   - ✅ should fail if wrong pair order was passed with FA2 token and FA2 token;
   - ✅ should fail if wrong pair order was passed with FA1.2 token and FA2 token;
   - ✅ should fail if token A zero amount in was passed;
   - ✅ should fail if TEZ token B zero amount in was passed;
   - ✅ should fail if token B zero amount in was passed;
   - ✅ should launch FA1.2/TEZ exchange;
   - ✅ should fail if pair already listed;
   - ✅ should launch FA2/TEZ exchange;
   - ✅ should launch FA1.2/FA1.2 exchange;
   - ✅ should launch FA2/FA2 exchange;
   - ✅ should launch FA1.2/FA2 exchange;
   - ✅ should setup correct default metadata in time of exchange launch;
   - ✅ should transfer FA1.2 tokens and TEZ tokens in time of FA1.2/TEZ exchange launch;
   - ✅ should transfer FA2 tokens and TEZ tokens in time of FA2/TEZ exchange launch;
   - ✅ should transfer FA1.2 tokens in time of FA1.2/FA1.2 exchange launch;
   - ✅ should transfer FA2 tokens in time of FA2/FA2 exchange launch;
   - ✅ should transfer FA1.2 tokens and FA2 tokens in time of FA1.2/FA2 exchange launch;
   - ✅ should not calculate cumulative prices and should update last block timestamp in time of any exchange launch.
   - ✅ should deploy TEZ store contract with correct initial storage in time of exchange launch with TEZ token;
   - ✅ should vote on TEZ store contract in time of exchange launch with TEZ token;

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

    - ✅ should fail if not dex core is trying to call launch exchange callback.

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

41. `integration_tests`:

    - should launch exchange, invest liquidity, swap, divest all liquidity and call launch exchange one more time successfully;
    -

## Auction

1. `receive_fee`:

   - ✅ should fail if not dex core is trying to send fees;
   - ✅ should receive TEZ tokens as fee and correctly update dev and public fee balances;
   - ✅ should receive FA1.2 tokens as fee and correctly update dev and public fee balances;
   - ✅ should receive FA2 tokens as fee and correctly update dev and public fee balances.

2. `launch_auction`:

   - ✅ should fail if token for auction is whitelisted;
   - ✅ should fail if token public fee balance is less than the number of tokens that are put up for auction;
   - ✅ should fail if the first bid is less than min bid;
   - ✅ should start TEZ auction and transfer QUIPU tokens as the first bid;
   - ✅ should start FA1.2 auction and transfer QUIPU tokens as the first bid;
   - ✅ should start FA2 auction and transfer QUIPU tokens as the first bid.

3. `place_bid`:

   - ✅ should fail if auction not found;
   - ✅ should fail if auction is finished;
   - ✅ should fail if a new bid is less than or equal to current bid;
   - ✅ should make a new bid for TEZ tokens auction;
   - ✅ should make a new bid for FA1.2 tokens auction;
   - ✅ should make a new bid for FA2 tokens auction;
   - should charge a bid fee from a previous bidder and refund QUIPU tokens without bid fee to him;
   - should charge a new bid from a new bidder.

4. `claim`:

   -

5. `set_admin`:

   - ✅ should fail if not admin is trying to setup a new pending admin;
   - ✅ should setup a new pending admin by an admin.

6. `confirm_admin`:

   - ✅ should fail if not pending admin is trying to confirm a new admin;
   - ✅ should confirm a new admin by pending admin.

7. `set_baker`:

   - ✅ should fail if not admin is trying to setup a new baker;
   - ✅ should setup a new baker and delegate for him;
   - ✅ should do nothing if a new baker is the same as the old one;
   - ✅ should remove a delegate if `zero_key_hash` was passed by an admin.

8. `set_fees`:

   - ✅ should fail if not admin is trying to setup a new fees;
   - ✅ should setup a new fees by an admin.

9. `set_auction_duration`:

   - ✅ should fail if not admin is trying to setup a new auction duration;
   - ✅ should setup a new auction duration by an admin.

10. `set_min_bid`:

    - ✅ should fail if not admin is trying to setup a new min bid;
    - ✅ should setup a new min bid by an admin.

11. `update_whitelist`:

    - ✅ should fail if not admin is trying to update the whitelist for tokens;
    - ✅ should add a new TEZ token to the whitelist by an admin;
    - ✅ should add a new FA1.2 token to the whitelist by an admin;
    - ✅ should add a new FA2 token to the whitelist by an admin;
    - ✅ should remove TEZ token from the whitelist by an admin;
    - ✅ should remove FA1.2 token from the whitelist by an admin;
    - ✅ should remove FA2 token from the whitelist by an admin.

12. `withdraw_dev_fee`:

    -

13. `withdraw_public_fee`:

    -

14. `burn_bid_fee`:

    -
