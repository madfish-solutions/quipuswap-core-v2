type send_t             is michelson_pair(address, "from", michelson_pair(address, "to", nat, "value"), "")

type fa12_transfer_t    is FA12_transfer of send_t

type get_balance_t      is michelson_pair(address, "owner", contract(nat), "")

type fa12_balance_of_t  is FA12_balance_of of get_balance_t
