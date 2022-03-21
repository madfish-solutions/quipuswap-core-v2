type action_t           is
| Deposit                 of deposit_t
| Withdraw                of withdraw_t
| Forward                 of forward_t
| Withdraw_rewards        of withdraw_rewards_t
| Ban_baker               of ban_baker_t
| Vote                    of vote_t
| Default                 of default_t
