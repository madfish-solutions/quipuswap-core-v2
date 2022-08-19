type action_t           is
| Fill                    of fill_t
| Pour_out                of pour_out_t
| Pour_over               of pour_over_t
| Withdraw_rewards        of withdraw_rewards_t
| Ban_baker               of ban_baker_t
| Claim_baker_fund        of address
| Vote                    of vote_t
| Default                 of default_t
