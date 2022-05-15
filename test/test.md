# Test coverage for contracts

## BakerRegistry

1.  `validate`:

    - ✅ should do nothing if baker is registered;
    - ✅ should register a new baker if baker is not registered;
    - ✅ should fail if the baker is not registered and the address to register is not a baker;
    - ✅ should fail if positive TEZ tokens amount were passed.

2.  `register`:

    - ✅ should register a new baker;
    - ✅ should fail if address to register is not a baker;
    - ✅ should fail if positive TEZ tokens amount were passed.

## Bucket

1. `fill`:

   - ✅ should fill - 1;
   - ✅ should fill - 2.

2. `pour_out`:

   - ✅ should fail if not dex core is trying to pour out;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if bucket have not enough TEZ on contract's balance;
   - ✅ should pour out - 1;
   - ✅ should pour out - 2.

3. `pour_over`:

   - ✅ should fail if not dex core is trying to pour over;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if `fill` entrypoint of a receiver not found;
   - ✅ should fail if bucket have not enough TEZ on contract's balance;
   - ✅ should pour over - 1;
   - ✅ should pour over - 2.

4. `withdraw_rewards`:

   - ✅ should fail if not dex core is trying to withdraw rewards;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should withdraw user's rewards - 1;
   - ✅ should withdraw user's rewards - 2;
   - ✅ should update user rewards;
   - ✅ should update global rewards.

5. `ban_baker`:

   - ✅ should fail if not dex core is trying to ban baker;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should ban baker;
   - ✅ should unban baker.

6. `vote`:

   - ✅ should vote for bob, bob must become first current delegated;
   - ✅ should fail if not dex core is trying to vote;
   - ✅ should fail if positive TEZ tokens amount were passed;
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
   - ✅ should change next candidate to the `zero_address` if next candidate is banned;
   - ✅ should remove delegate and set current delegated to the `zero_address` if current delegated is banned;
   - ✅ should vote for next candidate if current delegated is banned and next candidate isn't `zero_address`.

7. `default`:

   - ✅ should update global rewards - 1;
   - ✅ should update global rewards - 2;
   - ✅ should update global rewards - 3;
   - ✅ should update global rewards - 4;
   - ✅ should not update global rewards if pair total supply is 0.

8. `is_banned_baker` [VIEW]:

   - ✅ should return true if baker is banned;
   - ✅ should return false if baker is not banned;
   - ✅ should return false if baker's banning period is finished.

9. `get_tez_balance` [VIEW]:

   - ✅ should return zero balance;
   - ✅ should return positive balance - 1;
   - ✅ should return positive balance - 2.

10. `get_user_candidate` [VIEW]:

    - ✅ should return user's candidate is user have a candidate;
    - ✅ should return current delegated if user does not have a candidate;
    - ✅ should return `zero_key_hash` if contract does not have a delegate.

## FlashSwapsProxy

1.  `call`:

    - ✅ should call default entrypoint by dex core.

## DexCore

1. `launch_exchange`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if action is outdated;
   - ✅ should fail if wrong pair order was passed with TEZ token and TEZ token;
   - ✅ should fail if wrong pair order was passed with FA1.2 token and TEZ token;
   - ✅ should fail if wrong pair order was passed with FA2 token and TEZ token;
   - ✅ should fail if wrong pair order was passed with FA1.2 token and FA1.2 token;
   - ✅ should fail if wrong pair order was passed with FA2 token and FA2 token;
   - ✅ should fail if wrong pair order was passed with FA1.2 token and FA2 token;
   - ✅ should fail if token A zero amount in was passed;
   - ✅ should fail if TEZ token B zero amount in was passed;
   - ✅ should fail if TEZ token B wrong amount in was passed;
   - ✅ should fail if token B zero amount in was passed;
   - ✅ should fail if token B isn't TEZ and positive TEZ tokens amount were passed;
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
   - ✅ should deploy bucket contract with correct initial storage in time of exchange launch with TEZ token;
   - ✅ should vote on bucket contract in time of exchange launch with TEZ token;
   - ✅ should vote on bucket contract if exchange already launched and have 0 liquidity.

2. `invest_liquidity`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if action is outdated;
   - ✅ should fail if pair not listed;
   - ✅ should fail if pair does not have liquidity;
   - ✅ should fail if investor expects zero shares amount in result of investment;
   - ✅ should fail if TEZ token mismatch;
   - ✅ should fail if low token A in;
   - ✅ should fail if low token B in;
   - ✅ should fail if token B isn't TEZ and positive TEZ tokens amount were passed;
   - ✅ should invest FA1.2/TEZ liquidity;
   - ✅ should invest FA2/TEZ liquidity;
   - ✅ should invest FA1.2/FA1.2 liquidity;
   - ✅ should invest FA2/FA2 liquidity;
   - ✅ should invest FA1.2/FA2 liquidity;
   - ✅ should transfer FA1.2 tokens and fill TEZ tokens to bucket contract in time of FA1.2/TEZ liquidity investment;
   - ✅ should transfer FA2 tokens and fill TEZ tokens to bucket contract in time of FA2/TEZ liquidity investment;
   - ✅ should transfer FA1.2 tokens in time of FA1.2/FA1.2 liquidity investment;
   - ✅ should transfer FA2 tokens in time of FA2/FA2 liquidity investment;
   - ✅ should transfer FA1.2 tokens and FA2 tokens in time of FA1.2/FA2 liquidity investment;
   - ✅ should vote for the baker on bucket contract in time of FA1.2/TEZ liquidity investment;
   - ✅ should vote for the baker on bucket contract in time of FA2/TEZ liquidity investment;
   - ✅ should return the TEZ change to the sender if too many TEZ was send.

3. `divest_liquidity`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if action is outdated;
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
   - ✅ should transfer FA1.2 tokens and pour out TEZ tokens from bucket contract in time of FA1.2/TEZ liquidity divestment;
   - ✅ should transfer FA2 tokens and pour out TEZ tokens from bucket contract in time of FA2/TEZ liquidity divestment;
   - ✅ should transfer FA1.2 tokens in time of FA1.2/FA1.2 liquidity divestment;
   - ✅ should transfer FA2 tokens in time of FA2/FA2 liquidity divestment;
   - ✅ should transfer FA1.2 tokens and FA2 tokens in time of FA1.2/FA2 liquidity divestment;
   - ✅ should vote for the baker on bucket contract in time of FA1.2/TEZ liquidity divestment;
   - ✅ should vote for the baker on bucket contract in time of FA2/TEZ liquidity divestment.

4. `flash_swap`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if action is outdated;
   - ✅ should fail if user is trying to refer himself;
   - ✅ should fail if empty route;
   - ✅ should fail if pair not listed;
   - ✅ should fail if a user expects too high min out;
   - ✅ should fail if user passed zero amount in;
   - ✅ should fail if user put a wrong route;
   - ✅ should fail if from token isn't TEZ and positive TEZ tokens amount were passed;
   - ✅ should fail if pair does not have a liquidity;
   - ✅ should fail if wrong flash swap returns in TEZ token;
   - ✅ should flash swap FA1.2 token and return opposite FA1.2 token;
   - ✅ should flash swap FA1.2 token and return opposite FA2 token;
   - ✅ should flash swap FA1.2 token and return opposite TEZ token;
   - ✅ should flash swap FA2 token and return opposite FA1.2 token;
   - ✅ should flash swap FA2 token and return opposite FA2 token;
   - ✅ should flash swap FA2 token and return opposite TEZ token;
   - ✅ should flash swap TEZ token and return opposite FA1.2 token;
   - ✅ should flash swap TEZ token and return opposite FA2 token;
   - ✅ should properly update TOK fee during flash swap;
   - ✅ should properly update TEZ fee during flash swap;
   - ✅ should flash swap using FA1.2 -> FA2 -> TEZ route.

5. `swap`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if action is outdated;
   - ✅ should fail if user is trying to refer himself;
   - ✅ should fail if empty route;
   - ✅ should fail if pair not listed;
   - ✅ should fail if wrong TEZ amount was sent to swap;
   - ✅ should fail if a user expects too high min out;
   - ✅ should fail if user passed zero amount in;
   - ✅ should fail if user put a wrong route;
   - ✅ should fail if from token isn't TEZ and positive TEZ tokens amount were passed;
   - ✅ should swap FA1.2 token to TEZ;
   - ✅ should swap FA2 token to TEZ;
   - ✅ should swap TEZ to FA1.2 token;
   - ✅ should swap TEZ to FA2 token;
   - ✅ should swap FA1.2 token to FA1.2 token;
   - ✅ should swap FA1.2 token to FA2 token;
   - ✅ should swap FA2 token to FA1.2 token;
   - ✅ should swap FA2 token to FA2 token;
   - ✅ should fail if pair does not have a liquidity;
   - ✅ should swap using FA1.2 -> FA2 -> FA1.2 route;
   - ✅ should swap using FA1.2 -> FA2 -> FA1.2 -> FA2 route;
   - ✅ should swap using TEZ -> FA1.2 -> FA2 -> TEZ route;
   - ✅ should swap using FA1.2 -> TEZ -> FA2 route;
   - ✅ should swap using FA1.2 -> TEZ -> FA2 -> FA1.2 -> TEZ -> FA1.2 route.

6. `withdraw_profit`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if pair not listed;
   - ✅ should fail if pair does not have bucket contract (not TOK/TEZ pair);
   - ✅ should withdraw user's profit - 1;
   - ✅ should withdraw user's profit - 2.

7. `claim_interface_fee`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should claim FA1.2 interface fee and transfer it to a receiver;
   - ✅ should claim FA2 interface fee and transfer it to a receiver.

8. `claim_interface_tez_fee`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if pair not listed;
   - ✅ should claim TEZ interface fee and transfer it to a receiver.

9. `withdraw_auction_fee`:

   - ✅ should fail if reentrancy;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if user did not passed pair ID in time of withdrawing TEZ auction fee;
   - ✅ should fail if pair not listed in time of withdrawing TEZ auction fee;
   - ✅ should withdraw FA1.2 auction fee;
   - ✅ should withdraw FA2 auction fee;
   - ✅ should withdraw TEZ auction fee.

10. `vote`:

    - ✅ should fail if reentrancy;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should fail if pair not listed;
    - ✅ should fail if voter balance is negative;
    - ✅ should fail if pair does not have bucket contract (not TOK/TEZ pair);
    - ✅ should vote.

11. `set_admin`:

    - ✅ should fail if not admin is trying to setup new pending admin;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should setup new pending admin by admin.

12. `confirm_admin`:

    - ✅ should fail if pending admin is `None`;
    - ✅ should fail if not pending admin is trying to confirm new admin;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should confirm new admin by pending admin.

13. `set_flash_swaps_proxy`:

    - ✅ should fail if not admin is trying to setup new flash swaps proxy;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should setup new flash swaps proxy.

14. `set_auction`:

    - ✅ should fail if not admin is trying to setup new auction;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should setup new auction.

15. `add_managers`:

    - ✅ should fail if not admin is trying to add new manager;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should add one manager;
    - ✅ should remove one manager;
    - ✅ should add a group of managers;
    - ✅ should remove a group of managers;
    - ✅ shoud add/remove some groups of managers.

16. `set_fees`:

    - ✅ should fail if not admin is trying to set fees;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should update fees.

17. `set_collecting_period`:

    - ✅ should fail if not admin is trying to setup new collecting period;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should setup new collecting period.

18. `update_token_metadata`:

    - ✅ should fail if not manager is trying to update token metadata;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should fail if pair not listed;
    - ✅ should update existing fields in token metadata;
    - ✅ should set new fields in token metadata;
    - ✅ should update existing and set new fields in token metadata.

19. `ban`:

    - ✅ should fail if not admin is trying to ban baker;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should fail if pair not listed;
    - ✅ should fail if bucket not found (not TEZ/TOK pair);
    - ✅ should ban baker;
    - ✅ should unban baker.

20. `permit`:

    - ✅ should fail if positive TEZ tokens amount were passed;
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

    - ✅ should fail if positive TEZ tokens amount were passed;
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
    - ✅ should fail if positive TEZ tokens amount were passed;
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

    - ✅ should fail if positive TEZ tokens amount were passed;
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

25. `flash_swap_callback`:

    - ✅ should fail if not dex core is trying to call it.

26. `launch_callback`:

    - ✅ should fail if not dex core is trying to call launch exchange callback.

27. `close`:

    - ✅ should fail if not dex core is trying to call it;
    - ✅ should close (reentrancy protection).

28. `check_is_banned_baker` [VIEW]:

    - ✅ should fail if pair not listed;
    - ✅ should fail if pair does not have bucket contract (not TOK/TEZ pair);
    - ✅ should return true if baker is banned;
    - ✅ should return false if baker is not banned;
    - ✅ should return false if baker's banning period is finished.

29. `get_reserves` [VIEW]:

    - ✅ should fail if pair not listed;
    - ✅ should fail if one pair from list not listed;
    - ✅ should return proper reserves for pair;
    - ✅ should return proper reserves for all pairs in a list.

30. `get_total_supply` [VIEW]:

    - ✅ should fail if pair not listed;
    - ✅ should fail if one pair from list not listed;
    - ✅ should return proper total supply for pair;
    - ✅ should return proper total supply for all pairs in a list.

31. `get_swap_min_res` [VIEW]:

    - ✅ should fail if empty route;
    - ✅ should fail if pair not listed;
    - ✅ should fail if pair does not have a liquidity;
    - ✅ should fail if user passed zero amount in;
    - ✅ should fail if user put a wrong route;
    - ✅ should return proper min swap result - 1;
    - ✅ should return proper min swap result - 2;
    - ✅ should return proper min swap result - 3.

32. `get_toks_per_share` [VIEW]:

    - ✅ should fail if pair not listed;
    - ✅ should fail if one pair from list not listed;
    - ✅ should fail if pair does not have a liquidity;
    - ✅ should fail if one pair from list does not have a liquidity;
    - ✅ should return proper tokens per shares amount for pair;
    - ✅ should return proper tokens per shares anount for all pairs in a list.

33. `get_cumulative_prices` [VIEW]:

    - ✅ should fail if pair not listed;
    - ✅ should fail if one pair from list not listed;
    - ✅ should return proper cumulative prices for pair;
    - ✅ should return proper cumulative prices for all pairs in a list.

34. `get_collecting_period` [VIEW]:

    - ✅ should return proper collecting period.

35. `oracle_part`:

    - ✅ should not calculate cumulative prices and should update last block timestamp in time of any exchange launch;
    - ✅ should calculate cumulative prices and update last block timestamp in time of liquidity investment;
    - ✅ should calculate cumulative prices and update last block timestamp in time of swap - 1;
    - ✅ should calculate cumulative prices and update last block timestamp in time of liquidity divestment;
    - ✅ should calculate cumulative prices and update last block timestamp in time of swap - 2;
    - ✅ should calculate cumulative prices and update last block timestamp in time of flash swap.

## Auction

1. `receive_fee`:

   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if not dex core is trying to send fees;
   - ✅ should receive TEZ tokens as fee and correctly update dev and public fee balances;
   - ✅ should receive FA1.2 tokens as fee and correctly update dev and public fee balances;
   - ✅ should receive FA2 tokens as fee and correctly update dev and public fee balances.

2. `launch_auction`:

   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if token for auction is whitelisted;
   - ✅ should fail if token public fee balance is less than the number of tokens that are put up for auction;
   - ✅ should fail if the first bid is less than min bid;
   - ✅ should start TEZ auction and transfer QUIPU tokens as the first bid;
   - ✅ should start FA1.2 auction and transfer QUIPU tokens as the first bid;
   - ✅ should start FA2 auction and transfer QUIPU tokens as the first bid.

3. `place_bid`:

   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if auction not found;
   - ✅ should fail if auction is finished;
   - ✅ should fail if a new bid is less than or equal to current bid;
   - ✅ should make a new bid for TEZ tokens auction;
   - ✅ should make a new bid for FA1.2 tokens auction;
   - ✅ should make a new bid for FA2 tokens auction;
   - ✅ should charge a bid fee from a previous bidder and refund QUIPU tokens without bid fee to him;
   - ✅ should charge a new bid from a new bidder.

4. `claim`:

   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if auction not found;
   - ✅ should fail if auction is not finished;
   - ✅ should burn current bid, transfer claimed tokens to user and change auction status to `finished`;
   - ✅ should fail if auction status is `finished`.

5. `set_admin`:

   - ✅ should fail if not admin is trying to setup a new pending admin;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should setup a new pending admin by an admin.

6. `confirm_admin`:

   - ✅ should fail if pending admin is `None`;
   - ✅ should fail if not pending admin is trying to confirm a new admin;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should confirm a new admin by pending admin.

7. `set_baker`:

   - ✅ should fail if not admin is trying to setup a new baker;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should setup a new baker and delegate for him;
   - ✅ should do nothing if a new baker is the same as the old one;
   - ✅ should remove a delegate if `None` was passed by an admin.

8. `set_fees`:

   - ✅ should fail if not admin is trying to setup a new fees;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should setup a new fees by an admin.

9. `set_auction_duration`:

   - ✅ should fail if not admin is trying to setup a new auction duration;
   - ✅ should fail if positive TEZ tokens amount were passed;
   - ✅ should fail if admin is trying to set a negative auction duration;
   - ✅ should setup a new auction duration by an admin.

10. `set_min_bid`:

    - ✅ should fail if not admin is trying to setup a new min bid;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should setup a new min bid by an admin.

11. `update_whitelist`:

    - ✅ should fail if not admin is trying to update the whitelist for tokens;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should add a new TEZ token to the whitelist by an admin;
    - ✅ should add a new FA1.2 token to the whitelist by an admin;
    - ✅ should add a new FA2 token to the whitelist by an admin;
    - ✅ should remove TEZ token from the whitelist by an admin;
    - ✅ should remove FA1.2 token from the whitelist by an admin;
    - ✅ should remove FA2 token from the whitelist by an admin.

12. `withdraw_dev_fee`:

    - ✅ should fail if not admin is trying to withdraw dev fee;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should withdraw TEZ dev fee by admin;
    - ✅ should withdraw FA1.2 dev fee by admin;
    - ✅ should withdraw FA2 dev fee by admin.

13. `withdraw_public_fee`:

    - ✅ should fail if not admin is trying to withdraw public fee;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should fail if admin is trying to withdraw not whitelisted token;
    - ✅ should withdraw TEZ public fee by admin;
    - ✅ should withdraw FA1.2 public fee by admin;
    - ✅ should withdraw FA2 public fee by admin.

14. `burn_bid_fee`:

    - ✅ should fail if not admin is trying to burn bid fee;
    - ✅ should fail if positive TEZ tokens amount were passed;
    - ✅ should burn bid fee by admin.
