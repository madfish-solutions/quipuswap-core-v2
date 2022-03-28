type action_t           is
| Invest_tez              of invest_tez_t
| Divest_tez              of divest_tez_t
| Withdraw_rewards        of withdraw_rewards_t
| Ban_baker               of ban_baker_t
| Vote                    of vote_t
| Default                 of default_t
