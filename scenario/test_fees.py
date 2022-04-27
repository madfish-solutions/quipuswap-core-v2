
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError
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

        cls.init_storage = storage

    def test_interface_fee(self):
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
            "amount_in" : 100_000,
            "min_amount_out" : 1,
            "lambda" : None,
            "receiver" : me,
            "referrer" : alice,
            "deadline" : 1
        }))

        res = chain.execute(self.dex.claim_interface_tez_fee(0, alice), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.dex.claim_interface_fee(token_a_fa2, alice), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 300)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["source"], contract_self_address)

    def test_tez_interface_fee(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 100_000_000, 100_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000_000)

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
                    "direction": "b_to_a",
                },
                {
                    "pair_id": 0,
                    "direction": "a_to_b",
                },
            ],
            "amount_in" : 1_000_000,
            "min_amount_out" : 1,
            "lambda" : None,
            "receiver" : me,
            "referrer" : alice,
            "deadline" : 1
        }), amount=1_000_000)

        res = chain.execute(self.dex.claim_interface_tez_fee(0, alice), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 3_000)
        self.assertEqual(transfers[0]["destination"], alice)
        # self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["type"], "tez")

        res = chain.execute(self.dex.claim_interface_fee(token_a_fa2, alice), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 2_943)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["token_address"], token_a_address)

        res = chain.execute(self.dex.claim_interface_tez_fee(0, alice), sender=alice)
        self.assertEqual(len(parse_transfers(res)), 0)

        res = chain.execute(self.dex.claim_interface_fee(token_a_fa2, alice), sender=alice)
        self.assertEqual(len(parse_transfers(res)), 0)


    def test_auction_fee(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 100_000_000, 100_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000_000)

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
                    "direction": "b_to_a",
                },
                {
                    "pair_id": 0,
                    "direction": "a_to_b",
                },
            ],
            "amount_in" : 1_000_000,
            "min_amount_out" : 1,
            "lambda" : None,
            "receiver" : me,
            "referrer" : alice,
            "deadline" : 1
        }), amount=1_000_000)

        res = chain.execute(self.dex.withdraw_auction_fee(0, {"tez": None}), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 9)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["type"], "tez")

        self.assertEqual(transfers[1]["amount"], 2_991)
        self.assertEqual(transfers[1]["destination"], auction)
        self.assertEqual(transfers[1]["type"], "tez")

        auction_receive_ops = parse_auction_ops(res)
        self.assertEqual(len(auction_receive_ops), 1)
        self.assertEqual(auction_receive_ops[0]["fee"], 2991)
        self.assertEqual(auction_receive_ops[0]["destination"], auction)

        res = chain.execute(self.dex.withdraw_auction_fee(None, token_a_fa2), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 8)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["token_address"], token_a_address)

        self.assertEqual(transfers[1]["amount"], 2_935)
        self.assertEqual(transfers[1]["destination"], auction)
        self.assertEqual(transfers[1]["source"], contract_self_address)
        self.assertEqual(transfers[1]["token_address"], token_a_address)

        # can't withdraw anymore
        res = chain.execute(self.dex.withdraw_auction_fee(0, {"tez": None}), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 0)
        self.assertEqual(transfers[1]["amount"], 0)

        res = chain.execute(self.dex.withdraw_auction_fee(None, token_a_fa2), sender=alice)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 0)
        self.assertEqual(transfers[1]["amount"], 0)


    def test_smallest_fees(self):
        chain = LocalChain(storage=self.init_storage)
        add_pool = self.dex.launch_exchange(tez_pair, 100_000_000, 100_000_000, me, dummy_candidate, 1)
        res = chain.execute(add_pool, sender=admin, amount=100_000_000)

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
                    "direction": "b_to_a",
                },
            ],
            "amount_in" : 2,
            "min_amount_out" : 1,
            "lambda" : None,
            "receiver" : me,
            "referrer" : alice,
            "deadline" : 1
        }), amount=2)

        res = chain.execute(self.dex.withdraw_auction_fee(0, {"tez": None}), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(sum(trxs["amount"] for trxs in transfers), 0)

        res = chain.execute(self.dex.withdraw_auction_fee(None, token_a_fa2), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(sum(trxs["amount"] for trxs in transfers), 0)

        res = chain.execute(self.dex.claim_interface_fee(token_a_fa2, alice), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(sum(trxs["amount"] for trxs in transfers), 0)

        res = chain.execute(self.dex.claim_interface_tez_fee(0, alice), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(sum(trxs["amount"] for trxs in transfers), 0)