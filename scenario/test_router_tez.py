import json

from unittest import TestCase
from pytezos import ContractInterface, MichelsonRuntimeError

from helpers import *
from constants import *
from pprint import pprint

from initial_storage import dex_core_lambdas

class TokenToTezRouterTest(TestCase):

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
    
    def test_ttez_token_to_token_router(self):

        amount_in=10_000

        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(tez_pair, 100_000, 300_000, me, dummy_candidate, 1), amount=300_000)
        res = chain.execute(self.dex.launch_exchange(tez_pair_b, 500_000, 700_000, me, dummy_candidate, 1), amount=700_000)

        

        # interpret the call without applying it
        res = chain.interpret(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "a_to_b",
                },
                {
                    "pair_id": 1, 
                    "direction": "b_to_a",
                }
            ],
            "amount_in" : amount_in,
            "min_amount_out" : 1, 
            "lambda" : None,
            "receiver" : julian,
            "referrer" : burn,
            "deadline": 100_000
        }), amount=amount_in)

        transfers = parse_transfers(res)
        contract_in = next(v for v in transfers if v["destination"] == contract_self_address)

        routed_out = next(v for v in transfers if v["destination"] == julian)
        self.assertEqual(routed_out["token_address"], token_b_address)

        # same swap but one by one
        res = chain.interpret(self.dex.swap(
            swaps=[{
                "pair_id": 0,
                "direction": "a_to_b",
            }],
            amount_in=amount_in,
            min_amount_out=1,
            receiver=julian,
            referrer=burn,
            deadline=100_000
        ))
        transfers = parse_transfers(res)
        token_b_out = next(v for v in transfers if v["destination"] == julian)
        out_amount = token_b_out["amount"]

        res = chain.interpret(self.dex.swap(
             swaps=[{
                "pair_id": 1,
                "direction": "b_to_a",
            }],
            amount_in=out_amount,
            min_amount_out=1,
            receiver=julian,
            referrer=burn,
            deadline=100_000,
        ), amount=out_amount)
        transfers = parse_transfers(res)
        token_c_out = next(v for v in transfers if v["destination"] == julian)
        self.assertEqual(routed_out["amount"], token_c_out["amount"])
 
    # @skip
    # def test_ttez_router_triangle(self):
    #     chain = LocalChain(storage=self.init_storage)
    #     res = chain.execute(self.dex.launch_exchange(tez_pair, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1), amount=100_000_000_000)
    #     res = chain.execute(self.dex.launch_exchange(tez_pair_b, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1), amount=100_000_000_000)
    #     res = chain.execute(self.dex.launch_exchange(tez_pair_c, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1), amount=100_000_000_000)

    #     res = chain.execute(self.dex.set_fees({
    #         "interface_fee" : 0,      
    #         "swap_fee" : int(0.003 * 1e18),            
    #         "auction_fee" : 0,         
    #         "withdraw_fee_reward" : 0
    #     }), sender=admin)

    #     # interpret the call without applying it
    #     res = chain.interpret(self.dex.swap({
    #         "swaps" : [
    #             {
    #                 "pair_id": 0, 
    #                 "direction": "a_to_b",
    #             },
    #             {
    #                 "pair_id": 1, 
    #                 "direction": "b_to_a",
    #             },
    #             {
    #                 "pair_id": 2, 
    #                 "direction": "a_to_b",
    #             }
    #         ],
    #         "amount_in" : 10_000,
    #         "min_amount_out" : 1, 
    #         "lambda" : None,
    #         "receiver" : julian,
    #         "referrer" : burn,
    #         "deadline": 100_000
    #     }))
    #     transfers = parse_transfers(res)
        
    #     token_c_out = next(v for v in transfers if v["destination"] == julian)
    #     self.assertEqual(token_c_out["amount"], 9909) # ~ 9910 by compound interest formula
        
    def test_ttez_router_ab_ba(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(tez_pair, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1), amount=100_000_000_000)

        # HACK

        res = chain.execute(self.dex.set_fees({
            "interface_fee" : 0,      
            "swap_fee" : int(0.003 * 1e18),            
            "auction_fee" : 0,         
            "withdraw_fee_reward" : 0
        }), sender=admin)
        res = chain.interpret(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "a_to_b",
                },
                {
                    "pair_id": 0, 
                    "direction": "b_to_a",
                }
            ],
            "amount_in" : 10_000,
            "min_amount_out" : 1, 
            "lambda" : None,
            "lambda" : None, 
            "receiver" : julian,
            "referrer" : burn,
            "deadline": 100_000
        }))
        transfers = parse_transfers(res)
        token_out = next(v for v in transfers if v["destination"] == julian)
        self.assertEqual(token_out["amount"], 9939)

        pour_overs = parse_pour_overs(res)
        self.assertEqual(len(pour_overs), 1)
        self.assertEqual(pour_overs[0]["amount"], 9969)
        self.assertEqual(pour_overs[0]["destination"], bucket)
        self.assertEqual(pour_overs[0]["source"], bucket)


    def test_ttez_router_ba_ab(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(tez_pair, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1), amount=100_000_000_000)
        res = chain.execute(self.dex.set_fees({
            "interface_fee" : 0,      
            "swap_fee" : int(0.003 * 1e18),            
            "auction_fee" : 0,         
            "withdraw_fee_reward" : 0
        }), sender=admin)
        res = chain.interpret(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "b_to_a",
                },
                {
                    "pair_id": 0, 
                    "direction": "a_to_b",
                }
            ],
            "amount_in" : 10_000,
            "min_amount_out" : 1,
            "lambda" : None,
            "receiver" : julian,
            "referrer" : burn,
            "deadline": 100_000
        }), amount=1_000_000)
        transfers = parse_transfers(res)
        token_out = next(v for v in transfers if v["destination"] == julian)
        self.assertEqual(token_out["amount"], 9939)

    

    def test_ttez_router_impossible_path(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.launch_exchange(tez_pair, 1111, 3333, me, dummy_candidate, 1), amount=3333)
        chain.execute(self.dex.launch_exchange(tez_pair_b, 5555, 7777, me, dummy_candidate, 1), amount=7777)

        # can't find path
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.interpret(self.dex.swap({
                "swaps" : [
                    {
                        "pair_id": 0, 
                        "direction": "a_to_b",
                    },
                    {
                        "pair_id": 1, 
                        "direction": "a_to_b",
                    }
                ],
                "amount_in" : 334,
                "min_amount_out" : 1, 
                "lambda" : None,
                "receiver" : julian,
                "referrer" : burn,
                "deadline": 100_000
            }))

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.interpret(self.dex.swap({
                "swaps" : [
                    {
                        "pair_id": 0, 
                        "direction": "a_to_b",
                    },
                    {
                        "pair_id": 0, 
                        "direction": "a_to_b",
                    }
                ],
                "amount_in" : 334,
                "min_amount_out" : 1, 
                "lambda" : None,
                "receiver" : julian,
                "referrer" : burn,
                "deadline": 100_000
            }))


    def test_ttez_router_cant_overbuy(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(tez_pair, 100_000, 100_000, me, dummy_candidate, 1), amount=100_000)
        res = chain.execute(self.dex.launch_exchange(tez_pair_b, 10_000, 10_000, me, dummy_candidate, 1), amount=10_000)
        res = chain.execute(self.dex.launch_exchange(tez_pair_c, 1_000_000, 1_000_000, me, dummy_candidate, 1), amount=1_000_000)

        # overbuy at the very beginning
        res = chain.interpret(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "a_to_b",
                }
            ],
            "amount_in" : 100_000_000_000,
            "min_amount_out" : 1, 
            "lambda" : None,
            "receiver" : julian,
            "referrer" : burn,
            "deadline": 100_000
        }))

        transfers = parse_transfers(res)
        token_out = next(v for v in transfers if v["destination"] == julian)
        self.assertEqual(token_out["amount"], 99_999)

        # overbuy at the end
        res = chain.interpret(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "a_to_b",
                },
                {
                    "pair_id": 1, 
                    "direction": "b_to_a",
                }
            ],
            "amount_in" : 100_000_000,
            "min_amount_out" : 1, 
            "lambda" : None,
            "receiver" : julian,
            "referrer" : burn,
            "deadline": 100_000
        }))
        
        transfers = parse_transfers(res)
        token_out = next(v for v in transfers if v["destination"] == julian)
        self.assertLess(token_out["amount"], 9_999)
    
        # overbuy in the middle
        res = chain.interpret(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "a_to_b",
                },
                {
                    "pair_id": 1, 
                    "direction": "b_to_a",
                },
                {
                    "pair_id": 2, 
                    "direction": "a_to_b",
                }
            ],
            "amount_in" : 10_000_000_000,
            "min_amount_out" : 1, 
            "lambda" : None,
            "receiver" : julian,
            "referrer" : burn,
            "deadline": 100_000
        }))

        transfers = parse_transfers(res)
        token_out = next(v for v in transfers if v["destination"] == julian)
        self.assertLess(token_out["amount"], 9_999)

    def test_ttez_router_amount_equals_amount_in(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.launch_exchange(tez_pair, 100_000, 10, me, dummy_candidate, 1), amount=10)

        # wrong amount
        with self.assertRaises(MichelsonRuntimeError) as error:
            chain.interpret(self.dex.swap({
                "swaps" : [
                    {
                        "pair_id": 0, 
                        "direction": "b_to_a",
                    },
                ],
                "amount_in" : 10,
                "min_amount_out" : 1, 
                "lambda" : None,
                "receiver" : julian,
                "referrer" : burn,
                "deadline": 100_000
            }), amount=5)
        self.assertEqual(error.exception.args[-1], Errors.WRONG_TEZ_AMOUNT)

        # amount is zero
        with self.assertRaises(MichelsonRuntimeError) as error:
            chain.interpret(self.dex.swap({
                "swaps" : [
                    {
                        "pair_id": 0, 
                        "direction": "b_to_a",
                    },
                ],
                "amount_in" : 10,
                "min_amount_out" : 1, 
                "lambda" : None,
                "receiver" : julian,
                "referrer" : burn,
                "deadline": 100_000
            }), amount=0)
        self.assertEqual(error.exception.args[-1], Errors.WRONG_TEZ_AMOUNT)

        # works okay if amount is equal
        chain.interpret(self.dex.swap({
                "swaps" : [
                    {
                        "pair_id": 0, 
                        "direction": "b_to_a",
                    },
                ],
                "amount_in" : 10,
                "min_amount_out" : 1, 
                "lambda" : None,
                "receiver" : julian,
                "referrer" : burn,
                "deadline": 100_000
            }), amount=10)