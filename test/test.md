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
   - ✅ should invest tez - 1;
   - ✅ should invest tez - 2.

2. `divest_tez`:

   - ✅ should fail if not dex core is trying to divest tez;
   - ✅ should fail if tez store have not enough TEZ on contract's balance;
   - ✅ should divest tez - 1;
   - ✅ should divest tez - 2.

3. `withdraw_rewards`:

   - ❌

4. `ban_baker`:

   - ✅ should fail if not dex core is trying to ban baker;
   - ✅ should ban baker;
   - ✅ should unban baker.

5. `vote`:

   - ✅ should vote for bob, bob must become first current delegated;
   - ✅ should fail if not dex core is trying to vote;
   - ✅ should vote for alice, alice must become next candidate;
   - ✅ should vote for alice, alice must not become current delegated;
   - ✅ should vote for alice, alice must become current delegated;
   - ✅ should vote for bob, bob must become current delegated after alice;
   - ✅ should vote for bob, alice must become current delegated;
   - ✅ should vote for alice, bob must become current delegated;
   - ✅ should vote for bob, bob must remain current delegated;
   - ✅ should transfer tokens from alice to bob, vote, alice must become current delegated;
   - ✅ should transfer tokens from alice to bob, vote, alice must remain current delegated;
   - ✅ should transfer tokens from bob to alice, vote, bob must become current delegated;
   - ✅ should transfer tokens from bob to carol, vote, bob must remain current delegated;
   - ✅ should validate and set a new delegate if voting can be done and current delegated was changed - 1;
   - ✅ should validate and set a new delegate if voting can be done and current delegated was changed - 2;
   - ✅ should change next candidate to the `zero_address` if voting can be done and next candidate is banned;
   - ✅ should update end of voting period if voting can be done;
   - ✅ should remove delegate and set current delegated to the `zero_address` if voting can be done and current delegated is banned;
   - ❌ should update global rewards;
   - ❌ should update user rewards.

6. `default`:

   - ❌

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

    - ❌ should fail if not dex core is trying to call;
    - ❌

## DexCore

1. `launch_exchange`:

   - ✅ should fail if reentrancy;
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
   - ✅ should deploy TEZ store contract with correct initial storage in time of exchange launch with TEZ token;
   - ✅ should vote on TEZ store contract in time of exchange launch with TEZ token;
   - ❌ should vote on TEZ store contract if exchange already launched and have 0 liquidity.

2. `invest_liquidity`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if pair not listed;
   - ✅ should fail if pair does not have liquidity;
   - ✅ should fail if investor expects zero shares amount in result of investment;
   - ✅ should fail if low token A in;
   - ✅ should fail if token B is TEZ and low token B in;
   - ✅ should fail if low token B in;
   - ✅ should invest FA1.2/TEZ liquidity;
   - ✅ should invest FA2/TEZ liquidity;
   - ✅ should invest FA1.2/FA1.2 liquidity;
   - ✅ should invest FA2/FA2 liquidity;
   - ✅ should invest FA1.2/FA2 liquidity;
   - ✅ should transfer FA1.2 tokens and invest TEZ tokens to TEZ store contract in time of FA1.2/TEZ liquidity investment;
   - ✅ should transfer FA2 tokens and invest TEZ tokens to TEZ store contract in time of FA2/TEZ liquidity investment;
   - ✅ should transfer FA1.2 tokens in time of FA1.2/FA1.2 liquidity investment;
   - ✅ should transfer FA2 tokens in time of FA2/FA2 liquidity investment;
   - ✅ should transfer FA1.2 tokens and FA2 tokens in time of FA1.2/FA2 liquidity investment;
   - ✅ should vote for the baker on TEZ store contract in time of FA1.2/TEZ liquidity investment;
   - ✅ should vote for the baker on TEZ store contract in time of FA2/TEZ liquidity investment;
   - ❌ should return the TEZ change to the sender if too many TEZ was send.

3. `divest_liquidity`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if pair not listed;
   - ✅ should fail if pair does not have liquidity;
   - ✅ should fail if a divestor have an insufficient liquidity balance;
   - ✅ should fail if a divestor expects zero A token amount in result of divestment;
   - ✅ should fail if a divestor expects zero B token amount in result of divestment;
   - ✅ should fail if divested A tokens will be less than min A tokens out;
   - ✅ should fail if divested B tokens will be less than min B tokens out;
   - ✅ should divest FA1.2/TEZ liquidity;
   - ✅ should divest FA2/TEZ liquidity;
   - ✅ should divest FA1.2/FA1.2 liquidity;
   - ✅ should divest FA2/FA2 liquidity;
   - ✅ should divest FA1.2/FA2 liquidity;
   - ✅ should transfer FA1.2 tokens and divest TEZ tokens from TEZ store contract in time of FA1.2/TEZ liquidity divestment;
   - ✅ should transfer FA2 tokens and divest TEZ tokens from TEZ store contract in time of FA2/TEZ liquidity divestment;
   - ✅ should transfer FA1.2 tokens in time of FA1.2/FA1.2 liquidity divestment;
   - ✅ should transfer FA2 tokens in time of FA2/FA2 liquidity divestment;
   - ✅ should transfer FA1.2 tokens and FA2 tokens in time of FA1.2/FA2 liquidity divestment;
   - ✅ should vote for the baker on TEZ store contract in time of FA1.2/TEZ liquidity divestment;
   - ✅ should vote for the baker on TEZ store contract in time of FA2/TEZ liquidity divestment.

4. `flash_swap`:

   - ❌ should fail if reentrancy;
   - ❌

5. `swap`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if user is trying to refer himself;
   - ✅ should fail if empty route;
   - ✅ should fail if pair not listed;
   - ✅ should fail if wrong TEZ amount was sent to swap;
   - ✅ should fail if a user expects too high min out;
   - ✅ should fail if user passed zero amount in;
   - ✅ should fail if user put a wrong route;
   - ✅ should fail if too high price impact;
   - ✅ should swap FA1.2 token to TEZ;
   - ✅ should swap FA2 token to TEZ;
   - ✅ should swap TEZ to FA1.2 token;
   - ✅ should swap TEZ to FA2 token;
   - ✅ should swap FA1.2 token to FA1.2 token;
   - ✅ should swap FA1.2 token to FA2 token;
   - ✅ should swap FA2 token to FA1.2 token;
   - ✅ should swap FA2 token to FA2 token;
   - ✅ should fail if pair does not have a liquidity.

6. `withdraw_profit`:

   - ❌ should fail if reentrancy;
   - ❌

7. `claim_interface_fee`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if insufficient interface fee balance - 1;
   - ✅ should fail if insufficient interface fee balance - 2;
   - ✅ should claim FA1.2 interface fee and transfer it to a receiver - 1;
   - ✅ should claim FA1.2 interface fee and transfer it to a receiver - 2;
   - ✅ should claim FA2 interface fee and transfer it to a receiver - 1;
   - ✅ should claim FA2 interface fee and transfer it to a receiver - 2;
   - ✅ should claim TEZ interface fee and transfer it to a receiver - 1;
   - ✅ should claim TEZ interface fee and transfer it to a receiver - 2.

8. `withdraw_auction_fee`:

   - ✅ should fail if reentrancy;
   - ✅ should withdraw FA1.2 auction fee;
   - ✅ should withdraw FA2 auction fee;
   - ✅ should withdraw TEZ auction fee.

9. `set_admin`:

   - ✅ should fail if not admin is trying to setup new pending admin;
   - ✅ should setup new pending admin by admin.

10. `confirm_admin`:

    - ✅ should fail if not pending admin is trying to confirm new admin;
    - ✅ should confirm new admin by pending admin.

11. `set_flash_swaps_proxy`:

    - ✅ should fail if not admin is trying to setup new flash swaps proxy;
    - ✅ should setup new flash swaps proxy.

12. `set_auction`:

    - ✅ should fail if not admin is trying to setup new auction;
    - ✅ should setup new auction.

13. `add_managers`:

    - ✅ should fail if not admin is trying to add new manager;
    - ✅ should add one manager;
    - ✅ should remove one manager;
    - ✅ should add a group of managers;
    - ✅ should remove a group of managers;
    - ✅ shoud add/remove some groups of managers.

14. `set_fees`:

    - ✅ should fail if not admin is trying to set fees;
    - ✅ should update fees.

15. `set_cycle_duration`:

    - ✅ should fail if not admin is trying to set cycle duration;
    - ✅ should update cycle duration.

16. `set_voting_period`:

    - ✅ should fail if not admin is trying to setup new voting period;
    - ✅ should setup new voting period.

17. `set_collecting_period`:

    - ✅ should fail if not admin is trying to setup new collecting period;
    - ✅ should setup new collecting period.

18. `update_token_metadata`:

    - ✅ should fail if not manager is trying to update token metadata;
    - ✅ should fail if pair not listed;
    - ✅ should update existing fields in token metadata;
    - ✅ should set new fields in token metadata;
    - ✅ should update existing and set new fields in token metadata.

19. `ban`:

    - ✅ should fail if not admin is trying to ban baker;
    - ✅ should fail if pair not listed;
    - ✅ should fail if tez store not found (not TEZ/TOK pair);
    - ✅ should ban baker;
    - ✅ should unban baker.

20. `permit`:

    - ✅ should generate permit payload and submit it to the contract by alice - 1;
    - ✅ should generate permit payload and submit it to the contract by alice - 2;
    - ✅ should generate permit payload and submit it to the contract by bob;
    - ✅ should fail if bob is trying to submit duplicate permit;
    - ✅ should generate permit payload by alice and submit it to the contract by bob;
    - ✅ should fail if permit was missigned;
    - ✅ should fail if permit was expired;
    - ✅ should delete expired permits in time of submitting a new permit;
    - ✅ should call permit by carol on bob's behalf;
    - ✅ should fail if anyone is trying to use already used permit.

21. `ser_expiry`:

    - ✅ should fail if not issuer is trying to set expiry - 1;
    - ✅ should fail if not issuer is trying to set expiry - 2;
    - ✅ should fail if not issuer is trying to set expiry - 3;
    - ✅ should set default expiry for a user with permits;
    - ✅ should set default expiry for a user without permits;
    - ✅ should fail if user is trying to set default expiry that is bigger than max expiry;
    - ✅ should fail if user is trying to set expiry that is bigger than max expiry for a specified permit;
    - ✅ should not set an expiry for a specified permit if permit is already expired;
    - ✅ should set an expiry for a specified permit;
    - ✅ should set a 0 expiry for a specified permit.

22. `transfer`:

    - ✅ should fail if reentrancy;
    - ✅ should fail if token ID from request not found;
    - ✅ should fail if one token ID from list of requests not found;
    - ✅ should fail if not operator is trying to transfer tokens;
    - ✅ should fail if one from list of parameters is not an operator and is trying to transfer tokens;
    - ✅ should fail if a sender has an insufficient balance of tokens;
    - ✅ should fail if a sender has an insufficient balance of tokens in one parameter from the list of parameters;
    - ✅ should make one transfer from one account;
    - ✅ should make a group of transfers from one account;
    - ✅ should make self to self transfer;
    - ✅ should make transfer using allowance;
    - ✅ should make a group of transfers using allowances;
    - ✅ should make a group of transfers from one account and using allowances;
    - ✅ should vote in time of transfer.

23. `update_operators`:

    - ✅ should fail if token ID from request not found;
    - ✅ should fail if one token ID from list of requests not found;
    - ✅ should fail if not owner of tokens is trying to update operator;
    - ✅ should fail if one from list of parameters is not an owner of tokens and is trying to update operator;
    - ✅ should add one operator;
    - ✅ should remove one operator;
    - ✅ should add a group of operators;
    - ✅ should remove a group of operators;
    - ✅ should add/remove operators per one request.

24. `balance_of`:

    - ✅ should fail if token ID from request not found;
    - ✅ should fail if one token ID from list of requests not found;
    - ✅ should return positive balance for one account;
    - ✅ should return positive balance for group of accounts;
    - ✅ should return the same balance for the same account 2 times in one request;
    - ✅ should return 0 if an account does not have tokens.

25. `fa12_balance_callback_1`:

    - ❌ should fail if pair not listed;
    - ❌

26. `fa2_balance_callback_1`:

    - ❌ should fail if pair not listed;
    - ❌

27. `fa12_balance_callback_2`:

    - ❌ should fail if pair not listed;
    - ❌

28. `fa2_balance_callback_2`:

    - ❌ should fail if pair not listed;
    - ❌

29. `flash_swap_callback_1`:

    - ❌ should fail if not dex core is trying to call it;
    - ❌

30. `flash_swap_callback_2`:

    - ❌ should fail if not dex core is trying to call it;
    - ❌

31. `launch_callback`:

    - ✅ should fail if not dex core is trying to call launch exchange callback.

32. `close`:

    - ✅ should fail if not dex core is trying to call it;
    - ✅ should close (reentrancy protection).

33. `check_is_banned_baker` [VIEW]:

    - ✅ should fail if pair not listed;
    - ✅ should fail if pair does not have TEZ store contract (not TOK/TEZ pair);
    - ✅ should return true if baker is banned;
    - ✅ should return false if baker is not banned;
    - ✅ should return false if baker's banning period is finished.

34. `get_reserves` [VIEW]:

    - ✅ should fail if pair not listed;
    - ✅ should fail if one pair from list not listed;
    - ✅ should return proper reserves for pair;
    - ✅ should return proper reserves for all pairs in a list.

35. `get_total_supply` [VIEW]:

    - ✅ should fail if pair not listed;
    - ✅ should fail if one pair from list not listed;
    - ✅ should return proper total supply for pair;
    - ✅ should return proper total supply for all pairs in a list.

36. `get_swap_min_res` [VIEW]:

    - ❌

37. `get_toks_per_share` [VIEW]:

    - ✅ should fail if pair not listed;
    - ✅ should fail if one pair from list not listed;
    - ✅ should return proper tokens per shares amount for pair;
    - ✅ should return proper tokens per shares anount for all pairs in a list.

38. `get_cumulative_prices` [VIEW]:

    - ❌

39. `get_voting_period` [VIEW]:

    - ✅ should return proper voting period.

40. `get_collecting_period` [VIEW]:

    - ✅ should return proper collecting period.

41. `get_cycle_duration` [VIEW]:

    - ✅ should return proper cycle duration.

42. `oracle_part`:

    - ✅ should not calculate cumulative prices and should update last block timestamp in time of any exchange launch;
    - ✅ should calculate cumulative prices and update last block timestamp in time of liquidity investment;
    - ✅ should calculate cumulative prices and update last block timestamp in time of swap - 1;
    - ✅ should calculate cumulative prices and update last block timestamp in time of liquidity divestment;
    - ✅ should calculate cumulative prices and update last block timestamp in time of swap - 2.

43. `integration_tests`:

    - ❌ should launch exchange, invest liquidity, swap, divest all liquidity and call launch exchange one more time successfully;
    - ❌ should not deploy a new TEZ store in time of a second launch of an TOK/TEZ exchange;
    - ❌ should launch exchange, swap and invest in correct proportion;
    - ❌ should divest all liquidity, invest one more time and vote;
    - ❌

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
   - ❌ should charge a bid fee from a previous bidder and refund QUIPU tokens without bid fee to him;
   - ❌ should charge a new bid from a new bidder.

4. `claim`:

   - ❌

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

    - ❌

13. `withdraw_public_fee`:

    - ❌

14. `burn_bid_fee`:

    - ❌
