
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError
from initial_storage import dex_core_lambdas

class TezPairTest(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        text = open("./build/dex_core.json").read()
        code = json.loads(text)

        cls.dex = ContractInterface.from_micheline(code["michelson"])

        storage = cls.dex.storage.dummy()
        storage["dex_core_lambdas"] = dex_core_lambdas
        storage["storage"]["admin"] = admin 

        cls.init_storage = storage
    
    def test_interface_fee(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(pair_ab, 100_000_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000)

        res = chain.execute(self.dex.set_fees({
            "swap_fee" : int(0.003 * 1e18),            
            "interface_fee" : int(0.003 * 1e18),      
            "auction_fee" : int(0.003 * 1e18),         
            "withdraw_fee_reward" : int(0.003 * 1e18)
        }), sender=admin)

        res = chain.execute(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "a_to_b",
                }
            ],
            "amount_in" : 100_000,
            "min_amount_out" : 1,
            "receiver" : me,
            "referrer" : alice,
            "deadline" : 1
        }))

        # divest alice's shares
        res = chain.execute(self.dex.claim_interface_fee(token_a_fa2, alice), sender=alice)
        transfers = parse_transfers(res)
        pprint(transfers)
    

        # profits are equal +-1 due to rounding errors
        # self.assertAlmostEqual(alice_profit, bob_profit, delta=1)