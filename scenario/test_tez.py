
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
    
    def test_tez_dex_swap_and_divest(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.launch_exchange(tez_pair, 100_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000)

        res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=100_000, token_b_in=100_000, shares=100_000, shares_receiver=me, candidate=dummy_candidate, deadline=1), amount=100_000)
        
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 100_000) 
        self.assertEqual(transfers[0]["source"], me) 
        self.assertEqual(transfers[0]["destination"], contract_self_address) 

        res = chain.execute(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "a_to_b",
                }
            ],
            "amount_in" : 10_000,
            "min_amount_out" : 1,
            "receiver" : julian,
            "referrer" : burn,
            "deadline" : 1
        }))

        trxs = parse_transfers(res)
        self.assertEqual(trxs[0]["amount"], 10_000)
        self.assertEqual(trxs[0]["destination"], contract_self_address)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=200_001, liquidity_receiver=me, candidate=dummy_candidate, deadline=1))

        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=200_000, liquidity_receiver=me, candidate=dummy_candidate, deadline=1))

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertAlmostEqual(transfers[0]["amount"], 200_000, delta=10_000) 
        self.assertAlmostEqual(transfers[0]["amount"], 200_000, delta=10_000) 

    def test_tez_cant_init_already_init(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.launch_exchange(tez_pair, 100_000, 100_000, me, dummy_candidate, 1)
        chain.execute(add_pool, sender=admin, amount=100_000)
        
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(add_pool, sender=admin, amount=100_000)

    def test_tez_propotions(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 100_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000)
        
        res = chain.execute(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "a_to_b",
                }
            ],
            "amount_in" : 100,
            "min_amount_out" : 1,
            "receiver" : me,
            "referrer" : burn,
            "deadline" : 1
        }))
        trxs = parse_transfers(res)
        self.assertAlmostEqual(trxs[0]["amount"], trxs[1]["amount"], delta=1)
        
        res = chain.execute(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "b_to_a",
                }
            ],
            "amount_in" : 100,
            "min_amount_out" : 1,
            "receiver" : me,
            "referrer" : burn,
            "deadline" : 1
        }), amount=100)
        trxs = parse_transfers(res)
        self.assertEqual(trxs[0]["amount"], 100)    

    def test_tez_two_pairs_dont_interfere(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 100_000_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000)

        add_pool = self.dex.launch_exchange(tez_pair_b, 10_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000)

        key_swap = self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "b_to_a",
                }
            ],
            "amount_in" : 100,
            "min_amount_out" : 1,
            "receiver" : me,
            "referrer" : burn,
            "deadline" : 1
        })
        res = chain.interpret(key_swap, amount=100)
        trxs = parse_transfers(res)
        token_a_out_before = trxs[0]["amount"]
        # token_b_out_before = trxs[1]["amount"]

        # perform a swap on the second pair
        res = chain.execute(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 1, 
                    "direction": "a_to_b",
                }
            ],
            "amount_in" : 1_000,
            "min_amount_out" : 1,
            "receiver" : me,
            "referrer" : burn,
            "deadline" : 1
        }))
        res = chain.execute(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 1, 
                    "direction": "b_to_a",
                }
            ],
            "amount_in" : 100,
            "min_amount_out" : 1,
            "receiver" : me,
            "referrer" : burn,
            "deadline" : 1
        }), amount=100)

        # ensure first token price in unscathed
        res = chain.interpret(key_swap, amount=100)
        transfers = parse_transfers(res)
        token_a_out_after = transfers[0]["amount"]
        # token_b_out_after = transfers[1]["amount"]

        self.assertEqual(token_a_out_before, token_a_out_after)
        # self.assertEqual(token_b_out_before, token_b_out_after)

    def test_tez_fee_even_distribution(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 100_000_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000)

        res = chain.execute(self.dex.set_fees({
            "swap_fee" : int(0.003 * 1e18),            
            "interface_fee" : 0,      
            "auction_fee" : 0,         
            "withdraw_fee_reward" : 0
        }), sender=admin)

        # invest equally by Alice and Bob
        res = chain.execute(self.dex.invest_liquidity(0, int(1e18), int(1e18), 100_000, alice, dummy_candidate, 1), sender=alice, amount=int(1e18))
        res = chain.execute(self.dex.invest_liquidity(0, int(1e18), int(1e18), 100_000, bob, dummy_candidate, 1), sender=bob, amount=int(1e18))

        # perform a few back and forth swaps
        for i in range(0, 5):
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
                "referrer" : burn,
                "deadline" : 1
            }))
            transfers = parse_transfers(res)
            amount_bought = transfers[1]["amount"]
            res = chain.execute(self.dex.swap({
                "swaps" : [
                    {
                        "pair_id": 0, 
                        "direction": "b_to_a",
                    }
                ],
                "amount_in" : amount_bought,
                "min_amount_out" : 1,
                "receiver" : me,
                "referrer" : burn,
                "deadline" : 1
            }), amount=amount_bought)

        # divest alice's shares
        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=100_000, liquidity_receiver=alice, candidate=dummy_candidate, deadline=1), sender=alice)
        alice_trxs = parse_transfers(res)
        alice_profit = alice_trxs[1]["amount"] - 100_000
    
        # divest bob's shares
        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=100_000, liquidity_receiver=bob, candidate=dummy_candidate, deadline=1), sender=bob)
        bob_trxs = parse_transfers(res)
        bob_profit = bob_trxs[1]["amount"] - 100_000

        # profits are equal +-1 due to rounding errors
        self.assertAlmostEqual(alice_profit, bob_profit, delta=1)

    def test_tez_small_amounts(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 10, 10, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=10)

        res = chain.execute(self.dex.swap({
                "swaps" : [
                    {
                        "pair_id": 0, 
                        "direction": "b_to_a",
                    }
                ],
                "amount_in" : 2,
                "min_amount_out" : 1,
                "receiver" : me,
                "referrer" : burn,
                "deadline" : 1
            }), amount=2)

        transfers = parse_transfers(res)
        token_out = next(v for v in transfers if v["destination"] == me)
        self.assertEqual(token_out["amount"], 1)

    def test_tez_huge_amounts(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000_000_000)

        res = chain.execute(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "b_to_a",
                }
            ],
            "amount_in" : 10_000_000_000,
            "min_amount_out" : 1,
            "receiver" : me,
            "referrer" : burn,
            "deadline" : 1
        }), amount=10_000_000_000)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 9_090_909_090)

    def test_tez_multiple_singular_invests(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000_000_000)
        invest = self.dex.invest_liquidity(pair_id=0, token_a_in=int(1e18), token_b_in=int(1e18), shares=1, shares_receiver=alice, candidate=dummy_candidate, deadline=1)
        chain.execute(invest, sender=alice, amount=int(1e18))
        chain.execute(invest, sender=alice, amount=int(1e18))
        chain.execute(invest, sender=alice, amount=int(1e18))

        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=3, liquidity_receiver=me, candidate=dummy_candidate, deadline=1), sender=alice)

        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 3)
        self.assertEqual(transfers[1]["amount"], 3)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=1, liquidity_receiver=me, candidate=dummy_candidate, deadline=1), sender=alice)

    # TODO
    def test_tez_multiple_small_invests(self):
        ratios = [1, 0.01, 100]

        for ratio in ratios:
            tez_amount = int(100 * ratio)
            chain = LocalChain(storage=self.init_storage)
            add_pool = self.dex.launch_exchange(tez_pair, 100, tez_amount, me, dummy_candidate, 1)
            res = chain.execute(add_pool, sender=admin, amount=tez_amount) 

            invest = self.dex.invest_liquidity(pair_id=0, token_a_in=int(1e18), token_b_in=int(1e18), shares=1, shares_receiver=alice, candidate=dummy_candidate, deadline=1)

            for i in range(3):
                res = chain.execute(invest, sender=alice)            

            all_shares = get_shares(res, 0, me)
            print("all shares", all_shares)

            res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=3, liquidity_receiver=me, candidate=dummy_candidate, deadline=1), sender=alice)
    
            transfers = parse_transfers(res)
            pprint(transfers)
            continue
            self.assertAlmostEqual(transfers[0]["amount"], int(300 * ratio), delta=1)
            self.assertAlmostEqual(transfers[1]["amount"], 300, delta=1)

    def test_tez_reinitialize(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 10, 10, me, dummy_candidate, 1)
        res = chain.execute(add_pool, amount=10)

        old_storage = res.storage["storage"]

        # cant add already existing pair
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(add_pool, sender=admin, amount=10) 

        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=10, liquidity_receiver=me, candidate=dummy_candidate, deadline=1))

        # following fails since pair is considered uninitialized
        with self.assertRaises(MichelsonRuntimeError) as error:
            invest = self.dex.invest_liquidity(pair_id=0, token_a_in=10, token_b_in=10, shares=10, shares_receiver=me, candidate=dummy_candidate, deadline=1)
            chain.execute(invest, amount=10)
        self.assertEqual(Errors.DRAINED_PAIR, error.exception.args[-1])

        res = chain.execute(add_pool, amount=10)
        new_storage = res.storage["storage"]
        self.assertDictEqual(old_storage, new_storage)

        # now you can invest normally
        invest = self.dex.invest_liquidity(pair_id=0, token_a_in=10, token_b_in=10, shares=10, shares_receiver=me, candidate=dummy_candidate, deadline=1)
        res = chain.execute(invest, amount=10)

        transfers = parse_transfers(res) 
        self.assertEqual(transfers[0]["amount"], 10)
        self.assertEqual(transfers[0]["source"], me)
        self.assertEqual(transfers[0]["destination"], contract_self_address)
        self.assertEqual(transfers[0]["token_address"], token_a_address)

    def test_divest_smallest(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(tez_pair, 3, 3, admin, dummy_candidate, 1), amount=3)

        invest = self.dex.invest_liquidity(pair_id=0, token_a_in=2, token_b_in=2, shares=2, shares_receiver=me, candidate=dummy_candidate, deadline=1)
        res = chain.execute(invest, amount=2)

        res = chain.execute(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "b_to_a",
                }
            ],
            "amount_in" : 2,
            "min_amount_out" : 1,
            "receiver" : me,
            "referrer" : burn,
            "deadline" : 1
        }), amount=2)

        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=2, liquidity_receiver=me, candidate=dummy_candidate, deadline=1))
        transfers = parse_transfers(res) 
        self.assertLessEqual(transfers[0]["amount"], 2)
        self.assertLessEqual(transfers[1]["amount"], 2)

    def test_tez_divest_big_a_small_b(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.launch_exchange(tez_pair, 100_000_000, 50, alice, julian, 1), sender=alice, amount=50)
        
        with self.assertRaises(MichelsonRuntimeError) as error:
            res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=2_000_000 - 1, token_b_in=1, shares=1, shares_receiver=me, candidate=julian, deadline=1), amount=1)
        self.assertEqual(Errors.LOW_TOKEN_A_IN, error.exception.args[-1])

        # res = chain.execute(self.dex.invest(pair_id=0, token_a_in=3_600_000, token_b_in=1, shares=1, deadline=100_000))
        res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=2_000_000, token_b_in=1, shares=1, shares_receiver=me, candidate=julian, deadline=1), amount=1)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 2_000_000)

        all_shares = get_shares(res, 0, me)
        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=all_shares, liquidity_receiver=me, candidate=julian, deadline=1))
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 1)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["type"], "tez")
        self.assertEqual(transfers[1]["amount"], 2_000_000)
        self.assertEqual(transfers[1]["destination"], me)
        self.assertEqual(transfers[1]["type"], "token")


    def test_tez_divest_small_a_big_b(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.launch_exchange(tez_pair, 50, 100_000_000, alice, julian, 1), sender=alice, amount=100_000_000)
        
        with self.assertRaises(MichelsonRuntimeError) as error:
            tez_amount = 2_000_000 - 1
            res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=1, token_b_in=tez_amount, shares=1, shares_receiver=me, candidate=julian, deadline=1), amount=tez_amount)
        self.assertEqual(Errors.LOW_TOKEN_B_IN, error.exception.args[-1])
        
        res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=1, token_b_in=3_600_000, shares=1, shares_receiver=me, candidate=julian, deadline=1), amount=3_600_000)
        transfers = parse_transfers(res)
        change = transfers[0]["amount"]
        token_in = transfers[1]["amount"]
        self.assertEqual(change, 1_600_000)
        self.assertEqual(token_in, 1)

        all_shares = get_shares(res, 0, me)
        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=all_shares, liquidity_receiver=me, candidate=julian, deadline=1))
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 2_000_000)
        self.assertEqual(transfers[0]["destination"], me)
        self.assertEqual(transfers[0]["type"], "tez")
        self.assertEqual(transfers[1]["amount"], 1)
        self.assertEqual(transfers[1]["destination"], me)
        self.assertEqual(transfers[1]["type"], "token")

    def test_tez_invert_proportion(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(tez_pair, 51, 49, me, julian, 1), amount=49)

        all_shares = get_shares(res, 0, me)
        self.assertEqual(all_shares, 49)

        # we can't invest 1:1 token
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=1, token_b_in=1, shares=1, shares_receiver=me, candidate=julian, deadline=1), amount=1)

        res = chain.execute(self.dex.swap({
            "swaps" : [
                {
                    "pair_id": 0, 
                    "direction": "b_to_a",
                }
            ],
            "amount_in" : 4,
            "min_amount_out" : 1,
            "receiver" : alice,
            "referrer" : burn,
            "deadline" : 1
        }), amount=4)

        # there are 48 token A, so no way to divest 1 whole share, since 48 // 49 == 0
        with self.assertRaises(MichelsonRuntimeError) as error:
            res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=1, liquidity_receiver=me, candidate=julian, deadline=1))
        
        self.assertEqual(error.exception.args[-1], Errors.HIGH_MIN_OUT)

        # can't invest 1:1 since ratio is slightly biased (48:53)
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=1, token_b_in=1, shares=1, shares_receiver=me, candidate=julian, deadline=1))
        
        # the same true for 2:2
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=2, token_b_in=2, shares=2, shares_receiver=me, candidate=julian, deadline=1))

        res = chain.interpret(self.dex.invest_liquidity(pair_id=0, token_a_in=2, token_b_in=2, shares=1, shares_receiver=me, candidate=julian, deadline=1), amount=2)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertLessEqual(transfers[0]["amount"], 2)

        res = chain.interpret(self.dex.invest_liquidity(pair_id=0, token_a_in=2, token_b_in=4, shares=2, shares_receiver=me, candidate=julian, deadline=1), amount=4)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 1) # tez change
        self.assertEqual(transfers[0]["type"], "tez")
        self.assertEqual(transfers[0]["destination"], me)

        self.assertEqual(transfers[1]["amount"], 2) # tokens taken``
        self.assertEqual(transfers[1]["type"], "token")
        self.assertEqual(transfers[1]["destination"], contract_self_address)

    def test_close_is_last_operation(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(tez_pair, 10_000, 10_000, alice, julian, 1), sender=alice, amount=10_000)

        self.assertEqual(res.operations[-1]["parameters"]["entrypoint"], "close")

        # invest with change
        res = chain.execute(self.dex.invest_liquidity(0, 10, 100, 2, me, julian, 1), amount=100)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2) # ensure it has the change
        votes = parse_votes(res)
        self.assertEqual(len(votes), 1)

        self.assertEqual(res.operations[-1]["parameters"]["entrypoint"], "close")

        res = chain.execute(self.dex.swap({
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
            "amount_in" : 1_000,
            "min_amount_out" : 1,
            "receiver" : julian,
            "referrer" : burn,
            "deadline" : 1
        }), amount=1_000)

        self.assertEqual(res.operations[-1]["parameters"]["entrypoint"], "close")
