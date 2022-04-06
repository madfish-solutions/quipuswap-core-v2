
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError
from initial_storage import dex_core_lambdas

class StableSwapTest(TestCase):

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

    def test_dex_init_tokens(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.launch_exchange(pair_ab, 1_000_000, 1_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertGreaterEqual(transfers[0]["amount"], 1_000_000) 
        self.assertGreaterEqual(transfers[0]["source"], me) 
        self.assertGreaterEqual(transfers[0]["destination"], contract_self_address) 
        self.assertGreaterEqual(transfers[1]["amount"], 1_000_000)
        self.assertGreaterEqual(transfers[1]["source"], me) 
        self.assertGreaterEqual(transfers[1]["destination"], contract_self_address) 
    
    def test_dex_init_tez(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.launch_exchange(tez_pair, 1_000_000, 1_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=1_000_000)

        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertGreaterEqual(transfers[0]["amount"], 1_000_000) 
        self.assertGreaterEqual(transfers[0]["source"], me) 
        self.assertGreaterEqual(transfers[0]["destination"], contract_self_address) 

        originations = parse_originations(res)
        self.assertEqual(len(originations), 1)
        self.assertGreaterEqual(originations[0]["balance"], 1_000_000) 
    
    def test_dex_swap_and_divest(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.launch_exchange(pair_ab, 100_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin)

        # res = chain.execute(self.dex.set_fees({
        #     "interface_fee" : int(0.003 * 1e18),      
        #     "swap_fee" : int(0.003 * 1e18),            
        #     "auction_fee" : int(0.003 * 1e18),         
        #     "withdraw_fee_reward" : int(0.003 * 1e18)
        # }), sender=admin)

        res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=int(1e18), token_b_in=int(1e18), shares=100_000, shares_receiver=me, candidate=dummy_candidate, deadline=1))
        
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 100_000) 
        self.assertEqual(transfers[0]["source"], me) 
        self.assertEqual(transfers[0]["destination"], contract_self_address) 
        self.assertEqual(transfers[1]["amount"], 100_000)
        self.assertEqual(transfers[1]["source"], me) 
        self.assertEqual(transfers[1]["destination"], contract_self_address)

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
        self.assertEqual(trxs[1]["amount"], 9_523)
        self.assertEqual(trxs[1]["destination"], julian)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=200_001, liquidity_receiver=me, candidate=dummy_candidate, deadline=1))

        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=200_000, liquidity_receiver=me, candidate=dummy_candidate, deadline=1))
        
        transfers = parse_transfers(res)
        # TODO in isn't precise enough
        self.assertGreaterEqual(transfers[0]["amount"], 100_000) 
        self.assertGreaterEqual(transfers[1]["amount"], 100_000)

    def test_cant_init_already_init(self):
        chain = LocalChain(storage=self.init_storage)

        add_pool = self.dex.launch_exchange(pair_ab, 100_000, 100_000, me, dummy_candidate, 1)
        chain.execute(add_pool, sender=admin)
        
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(add_pool, sender=admin)

    def test_propotions(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(pair_ab, 100_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin)
        
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
        }))
        trxs = parse_transfers(res)
        self.assertAlmostEqual(trxs[0]["amount"], trxs[1]["amount"], delta=1)

    def test_two_pairs_dont_interfere(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(pair_ab, 100_000_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin)

        add_pool = self.dex.launch_exchange(pair_bc, 10_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin)

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
        res = chain.interpret(key_swap)
        trxs = parse_transfers(res)
        token_a_out_before = trxs[0]["amount"]
        token_b_out_before = trxs[1]["amount"]

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
        }))

        # ensure first token price in unscathed
        res = chain.interpret(key_swap)
        transfers = parse_transfers(res)
        token_a_out_after = transfers[0]["amount"]
        token_b_out_after = transfers[1]["amount"]

        self.assertEqual(token_a_out_before, token_a_out_after)
        self.assertEqual(token_b_out_before, token_b_out_after)

    def test_fee_even_distribution(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(pair_ab, 100_000_000, 100_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin)

        # invest equally by Alice and Bob
        res = chain.execute(self.dex.invest_liquidity(0, int(1e18), int(1e18), 100_000, alice, dummy_candidate, 1), sender=alice)
        res = chain.execute(self.dex.invest_liquidity(0, int(1e18), int(1e18), 100_000, bob, dummy_candidate, 1), sender=bob)

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
            }))

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

    def test_small_amounts(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(pair_ab, 10, 10, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin)

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
            }))

        transfers = parse_transfers(res)
        token_out = next(v for v in transfers if v["destination"] == me)
        self.assertEqual(token_out["amount"], 1)

    def test_huge_amounts(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(pair_ab, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin)

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
        }))

        transfers = parse_transfers(res)
        self.assertEqual(transfers[1]["amount"], 9_090_909_090)

    def test_multiple_singular_invests(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(pair_ab, 100_000_000_000, 100_000_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin)
        invest = self.dex.invest_liquidity(pair_id=0, token_a_in=int(1e18), token_b_in=int(1e18), shares=1, shares_receiver=alice, candidate=dummy_candidate, deadline=1)
        chain.execute(invest, sender=alice)
        chain.execute(invest, sender=alice)
        chain.execute(invest, sender=alice)

        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=3, liquidity_receiver=me, candidate=dummy_candidate, deadline=1), sender=alice)

        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 3)
        self.assertEqual(transfers[1]["amount"], 3)

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=1, liquidity_receiver=me, candidate=dummy_candidate, deadline=1), sender=alice)

    # TODO
    def test_multiple_small_invests(self):
        ratios = [1, 0.01, 100]

        for ratio in ratios:
            token_b_amount = int(100 * ratio)
            chain = LocalChain(storage=self.init_storage)
            add_pool = self.dex.launch_exchange(pair_ab, 100, token_b_amount, me, dummy_candidate, 1)
            res = chain.execute(add_pool, sender=admin) 

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

    # TODO the same for Tez pair
    def test_reinitialize(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(pair_ab, 10, 10, me, dummy_candidate, 1)
        res = chain.execute(add_pool)

        old_storage = res.storage["storage"]

        # cant add already existing pair
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(add_pool, sender=admin) 

        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=10, liquidity_receiver=me, candidate=dummy_candidate, deadline=1))

        # following fails since pair is considered uninitialized
        with self.assertRaises(MichelsonRuntimeError):
            invest = self.dex.invest_liquidity(pair_id=0, token_a_in=int(1e18), token_b_in=int(1e18), shares=10, shares_receiver=me, candidate=dummy_candidate, deadline=1)
            chain.execute(invest)

        res = chain.execute(add_pool)
        new_storage = res.storage["storage"]
        self.assertDictEqual(old_storage, new_storage)

        # now you can invest normally
        invest = self.dex.invest_liquidity(pair_id=0, token_a_in=int(1e18), token_b_in=int(1e18), shares=10, shares_receiver=me, candidate=dummy_candidate, deadline=1)
        res = chain.execute(invest)

        transfers = parse_transfers(res) 
        self.assertLessEqual(transfers[0]["amount"], 10)
        self.assertLessEqual(transfers[1]["amount"], 10)


    def test_divest_smallest(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(pair_ab, 3, 3, admin, dummy_candidate, 1))

        invest = self.dex.invest_liquidity(pair_id=0, token_a_in=int(1e18), token_b_in=int(1e18), shares=2, shares_receiver=me, candidate=dummy_candidate, deadline=1)
        res = chain.execute(invest)

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
        }))

        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=2, liquidity_receiver=me, candidate=dummy_candidate, deadline=1))
        transfers = parse_transfers(res) 
        self.assertLessEqual(transfers[0]["amount"], 2)
        self.assertLessEqual(transfers[1]["amount"], 2)

    def test_simple_divest_all(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(pair_ab, 42, 777_777_777, me, dummy_candidate, 1))

        all_shares = get_shares(res, 0, me)
        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=10, liquidity_receiver=me, candidate=dummy_candidate, deadline=1))
        
        transfers = parse_transfers(res) 
        self.assertLessEqual(transfers[0]["amount"], 777_777_777)
        self.assertLessEqual(transfers[1]["amount"], 42)

    def test_add_pool_same_coin(self):
        same_token_pair = {
            "token_a" : token_a_fa2,
            "token_b" : token_a_fa2
        }

        chain = LocalChain(storage=self.init_storage)
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.launch_exchange(same_token_pair, 100, 1000, me, dummy_candidate, 1))

        tez_tez_pair = {
            "token_a" : {"tez" : None},
            "token_b" : {"tez" : None}
        }
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.launch_exchange(tez_tez_pair, 100, 1000, me, dummy_candidate, 1))

    def test_divest_big_a_small_b(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.launch_exchange(pair_ab, 100_000_000, 50, alice, julian, 1), sender=alice)
        
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=2_000_000 - 1, token_b_in=1, shares=1, shares_receiver=me, candidate=julian, deadline=1))

        # res = chain.execute(self.dex.invest(pair_id=0, token_a_in=3_600_000, token_b_in=1, shares=1, deadline=100_000))
        res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=2_000_000, token_b_in=1, shares=1, shares_receiver=me, candidate=julian, deadline=1))

        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 1)
        self.assertEqual(transfers[1]["amount"], 2_000_000)

        all_shares = get_shares(res, 0, me)
        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=all_shares, liquidity_receiver=me, candidate=julian, deadline=1))
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 1)
        self.assertEqual(transfers[1]["amount"], 2_000_000)

    def test_divest_small_a_big_b(self):
        chain = LocalChain(storage=self.init_storage)
        chain.execute(self.dex.launch_exchange(pair_ab, 50, 100_000_000, alice, julian, 1), sender=alice)
        
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=1, token_b_in=2_000_000 - 1, shares=1, shares_receiver=me, candidate=julian, deadline=1))

        res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=1, token_b_in=3_600_000, shares=1, shares_receiver=me, candidate=julian, deadline=1))
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 2_000_000)
        self.assertEqual(transfers[1]["amount"], 1)

        all_shares = get_shares(res, 0, me)
        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=all_shares, liquidity_receiver=me, candidate=julian, deadline=1))
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 2_000_000)
        self.assertEqual(transfers[1]["amount"], 1)

    def test_invert_proportion(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(pair_ab, 51, 49, me, julian, 1))

        all_shares = get_shares(res, 0, me)
        self.assertEqual(all_shares, 49)

        # we can invest 1:1 token
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=1, token_b_in=1, shares=1, shares_receiver=me, candidate=julian, deadline=1))

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
        }))

        # there are 48 token A, so no way to divest 1 whole share, since 48 // 49 == 0
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=1, liquidity_receiver=me, candidate=julian, deadline=1))

        # can't invest 1:1 since ratio is slightly biased (48:53)
        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=1, token_b_in=1, shares=1, shares_receiver=me, candidate=julian, deadline=1))

        res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=2, token_b_in=2, shares=1, shares_receiver=me, candidate=julian, deadline=1))
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertLessEqual(transfers[0]["amount"], 2) 
        self.assertLessEqual(transfers[1]["amount"], 2) 

    def test_no_amount_for_non_tez_pair(self):
        chain = LocalChain(storage=self.init_storage)

        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.launch_exchange(pair_ab, 100, 5_000, alice, julian, 1), amount=5_000)


    # TODO
    def test_deadline(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(pair_ab, 50, 50, me, julian, 1))

        chain.advance_blocks(2)

        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=1, token_b_in=1, shares=1, shares_receiver=me, candidate=julian, deadline=1))

        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=1, liquidity_receiver=me, candidate=julian, deadline=1))

        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.dex.swap({
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
    
    def test_vote_unvote(self):
        chain = LocalChain(storage=self.init_storage)
        res = chain.execute(self.dex.launch_exchange(tez_pair, 50, 50, me, julian, 1), amount=50)

        res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=100, token_b_in=100, shares=10, shares_receiver=me, candidate=julian, deadline=1), amount=100)

        votes = parse_votes(res)
        self.assertEqual(votes[0]["amount"], 60)
        self.assertEqual(votes[0]["delegate"], julian)

        res = chain.execute(self.dex.invest_liquidity(pair_id=0, token_a_in=100, token_b_in=100, shares=100, shares_receiver=me, candidate=julian, deadline=1), amount=100)

        votes = parse_votes(res)
        self.assertEqual(votes[0]["amount"], 160)
        self.assertEqual(votes[0]["delegate"], julian)

        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=10, liquidity_receiver=me, candidate=julian, deadline=1))

        votes = parse_votes(res)
        self.assertEqual(votes[0]["amount"], 150)
        self.assertEqual(votes[0]["delegate"], julian)

        res = chain.execute(self.dex.divest_liquidity(pair_id=0, min_token_a_out=1, min_token_b_out=1, shares=150, liquidity_receiver=me, candidate=julian, deadline=1))

        votes = parse_votes(res)
        self.assertEqual(votes[0]["amount"], 0)
        self.assertEqual(votes[0]["delegate"], julian)