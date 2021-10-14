type send_t             is michelson_pair(
                          address, "from",
                          michelson_pair(address, "to", nat, "value"), ""
                        )

type fa12_transfer_t    is FA12_transfer of send_t
