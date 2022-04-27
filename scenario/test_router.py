import json

from unittest import TestCase
from pytezos import ContractInterface, MichelsonRuntimeError

from helpers import *
from constants import *

from initial_storage import dex_core_lambdas

class TokenToTokenRouterTest(TestCase):

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
    
    def test_tt_token_to_token_router(self):

        amount_in=10_000

        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(pair_ab, 100_000, 300_000, me, dummy_candidate, 1))
        res = chain.execute(self.dex.launch_exchange(pair_bc, 500_000, 700_000, me, dummy_candidate, 1))

        res = chain.execute(self.dex.set_fees({
            "interface_fee" : int(0.001 * 1e18),      
            "swap_fee" : int(0.002 * 1e18),            
            "auction_fee" : int(0.001 * 1e18),         
            "withdraw_fee_reward" : 0
        }), sender=admin)

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
        }))

        transfers = parse_transfers(res)
        contract_in = next(v for v in transfers if v["destination"] == contract_self_address)
        self.assertEqual(contract_in["token_address"], token_a_address)
        self.assertEqual(contract_in["amount"], 10_000)

        routed_out = next(v for v in transfers if v["destination"] == julian)
        self.assertEqual(routed_out["token_address"], token_c_address)

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

        res = chain.interpret(self.dex.swap(
             swaps=[{
                "pair_id": 1,
                "direction": "b_to_a",
            }],
            amount_in=token_b_out["amount"],
            min_amount_out=1,
            receiver=julian,
            referrer=burn,
            deadline=100_000,
        ))
        transfers = parse_transfers(res)
        token_c_out = next(v for v in transfers if v["destination"] == julian)
        self.assertEqual(routed_out["amount"], token_c_out["amount"])
 
    def test_tt_router_triangle(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(pair_ab, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1))
        res = chain.execute(self.dex.launch_exchange(pair_bc, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1))
        res = chain.execute(self.dex.launch_exchange(pair_ac, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1))

        res = chain.execute(self.dex.set_fees({
            "interface_fee" : 0,      
            "swap_fee" : int(0.003 * 1e18),            
            "auction_fee" : 0,         
            "withdraw_fee_reward" : 0
        }), sender=admin)

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
                },
                {
                    "pair_id": 2, 
                    "direction": "a_to_b",
                }
            ],
            "amount_in" : 10_000,
            "min_amount_out" : 1,
            "lambda" : None, 
            "receiver" : julian,
            "referrer" : burn,
            "deadline": 100_000
        }))
        transfers = parse_transfers(res)
        
        token_c_out = next(v for v in transfers if v["destination"] == julian)
        self.assertEqual(token_c_out["amount"], 9909) # ~ 9910 by compound interest formula
        
    def test_tt_router_ab_ba(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(pair_ab, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1))
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
            "amount_in" : 1_000_000,
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

    def test_tt_router_impossible_path(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.launch_exchange(pair_ab, 1111, 3333, me, dummy_candidate, 1))
        chain.execute(self.dex.launch_exchange(pair_cd, 5555, 7777, me, dummy_candidate, 1))

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


    def test_tt_router_cant_overbuy(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(pair_ab, 100_000, 100_000, me, dummy_candidate, 1))
        res = chain.execute(self.dex.launch_exchange(pair_bc, 10_000, 10_000, me, dummy_candidate, 1))
        res = chain.execute(self.dex.launch_exchange(pair_ac, 1_000_000, 1_000_000, me, dummy_candidate, 1))

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