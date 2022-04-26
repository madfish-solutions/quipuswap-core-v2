
from ast import Constant
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError, micheline_to_michelson
from initial_storage import dex_core_lambdas

class FeesTest(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        text = open("./build/dex_core.json").read()
        code = json.loads(text)

        cls.dex = ContractInterface.from_micheline(code["michelson"])

        storage = cls.dex.storage.dummy()
        storage["dex_core_lambdas"] = dex_core_lambdas
        storage["storage"]["admin"] = admin
        storage["storage"]["auction"] = auction
        storage["storage"]["flash_swaps_proxy"] = flash_swaps_proxy

        cls.init_storage = storage

        code = open("./scenario/flash_loan_lambda.tz", 'r').read()
        # cls.flash_lambda = ContractInterface.from_michelson(code)
        cls.flash_lambda = code
        

    def test_flash_loan(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(pair_ab, 100_000_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin)

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
            "amount_in" : 1_000_000,
            "min_amount_out" : 1,
            "lambda" : self.flash_lambda,
            "receiver" : me,
            "referrer" : alice,
            "deadline" : 1
        }))

        self.assertEqual(len(res.operations), 4)

        transfers = parse_transfers(res)

        self.assertAlmostEqual(transfers[0]["amount"], 981, delta=1)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["type"], "token")
        self.assertEqual(transfers[0]["token_address"], token_b_address)
        
        # lambda invocation
        self.assertAlmostEqual(transfers[1]["amount"], 0)
        self.assertEqual(transfers[1]["destination"], flash_swaps_proxy)
        self.assertEqual(transfers[1]["source"], contract_self_address)
        self.assertEqual(transfers[1]["type"], "tez")

        lambda_call = res.operations[1]
        micheline = lambda_call["parameters"]["value"]
        michelson = micheline_to_michelson(micheline)
        self.assertEqual(michelson, self.flash_lambda)

        # requesting users amount goes last
        self.assertEqual(transfers[2]["amount"], 1_000_000)
        self.assertEqual(transfers[2]["destination"], contract_self_address)
        self.assertEqual(transfers[2]["source"], me)
        self.assertEqual(transfers[2]["type"], "token")
        self.assertEqual(transfers[2]["token_address"], token_a_address)


    def test_tez_flash_loan(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 100_000_000, 1_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=1_000_000)

        res = chain.execute(self.dex.set_fees({
            "swap_fee" : int(0.003 * 1e18),
            "interface_fee" : int(0.003 * 1e18),
            "auction_fee" : int(0.003 * 1e18),
            "withdraw_fee_reward" : int(0.003 * 1e18)
        }), sender=admin)

        # ask for tez
        res = chain.execute(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0,
                    "direction": "b_to_a",
                }
            ],
            "amount_in" : 100_000,
            "min_amount_out" : 1,
            "lambda" : self.flash_lambda,
            "receiver" : me,
            "referrer" : alice,
            "deadline" : 1
        }), amount=0)

        self.assertEqual(len(res.operations), 4)

        transfers = parse_transfers(res)

        self.assertAlmostEqual(transfers[0]["amount"], 9_016_468, delta=1)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["type"], "token")
        self.assertEqual(transfers[0]["token_address"], token_a_address)
        
        # lambda invocation
        self.assertAlmostEqual(transfers[1]["amount"], 0)
        self.assertEqual(transfers[1]["destination"], flash_swaps_proxy)
        self.assertEqual(transfers[1]["source"], contract_self_address)
        self.assertEqual(transfers[1]["type"], "tez")

        lambda_call = res.operations[1]
        micheline = lambda_call["parameters"]["value"]
        michelson = micheline_to_michelson(micheline)
        self.assertEqual(michelson, self.flash_lambda)

        lambda_callback = res.operations[2]
        entrypoint = lambda_callback["parameters"]["entrypoint"]
        self.assertEqual(entrypoint, "flash_swap_callback")

        callbacks = parse_flash_swap_callbacks(res)
        self.assertEqual(len(callbacks), 1)
        callback = callbacks[0]
        self.assertEqual(callback["pair_id"], 0)
        self.assertEqual(callback["prev_tez_balance"], 1_000_000)
        self.assertEqual(callback["amount_in"], 100_000)

    def test_tez_flash_callback(self):
        storage = self.init_storage.copy()
        chain = LocalChain(storage=storage)

        # add a dummy pair
        add_pool = self.dex.launch_exchange(tez_pair, 100_000_000, 1_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=1_000_000)

        chain.storage["storage"]["entered"] = True

        res = chain.execute(self.dex.flash_swap_callback(
            pair_id=0,
            prev_tez_balance=100_000,
            amount_in=100_000
        ), sender=contract_self_address)
            
        chain.balance = 50_000
        with self.assertRaises(MichelsonRuntimeError) as error:
            res = chain.execute(self.dex.flash_swap_callback(
                pair_id=0,
                prev_tez_balance=100_000,
                amount_in=100_000,
            ), sender=contract_self_address)

        self.assertEqual(error.exception.args[-1], Errors.NOT_A_NAT)
