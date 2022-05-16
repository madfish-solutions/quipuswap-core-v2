
from operator import eq
from unittest import TestCase
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError

class BucketTest(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        text = open("./contracts/compiled/bucket.tz").read()
        cls.ct = ContractInterface.from_michelson(text)

        storage = cls.ct.storage.dummy()
        storage["dex_core"] = dex_core 
        storage["collecting_period_end"] = 10

        cls.init_storage = storage

    def test_full_reward(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.vote(alice, carol, True, 50), sender=dex_core, view_results=vr)
        res = chain.execute(self.ct.vote(bob, carol, True, 50), sender=dex_core, view_results=vr)

        res = chain.execute(self.ct.default(), amount=20_000, view_results=vr)

        chain.advance_blocks(20)

        res = chain.execute(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 10_000)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["type"], "tez")

        
    def test_partial_reward(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.vote(alice, carol, True, 50), sender=dex_core, view_results=vr)
        res = chain.execute(self.ct.vote(bob, carol, True, 50), sender=dex_core, view_results=vr)

        res = chain.execute(self.ct.default(), amount=20_000, view_results=vr)

        chain.advance_blocks(15)

        res = chain.execute(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 5000)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["type"], "tez")

        chain.advance_blocks(5)

        res = chain.execute(self.ct.withdraw_rewards(bob, bob), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 10000)
        self.assertEqual(transfers[0]["destination"], bob)
        self.assertEqual(transfers[0]["type"], "tez")

        res = chain.execute(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 5000)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["type"], "tez")
        

    def test_skipped_period(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.vote(alice, carol, True, 50), sender=dex_core, view_results=vr)
        res = chain.execute(self.ct.vote(bob, carol, True, 50), sender=dex_core, view_results=vr)

        res = chain.execute(self.ct.default(), amount=20_000, view_results=vr)

        chain.advance_blocks(25)

        res = chain.interpret(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 7_500)

        chain.advance_blocks(4)

        res = chain.execute(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertAlmostEqual(transfers[0]["amount"], 9_500)

        res = chain.execute(self.ct.withdraw_rewards(bob, bob), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 9_500)
        self.assertEqual(transfers[0]["destination"], bob)
        self.assertEqual(transfers[0]["type"], "tez")

        chain.advance_blocks(1)
        res = chain.interpret(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 500)

    def test_proper_periods(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.vote(alice, carol, True, 50), sender=dex_core, view_results=vr)
        res = chain.execute(self.ct.vote(bob, carol, True, 50), sender=dex_core, view_results=vr)

        res = chain.execute(self.ct.default(), amount=20_000, view_results=vr)

        chain.advance_blocks(15)

        res = chain.execute(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 5_000)

        res = chain.execute(self.ct.default(), amount=100_000, view_results=vr)

        # block 19. Next reward doesn't affect
        chain.advance_blocks(4)
        res = chain.execute(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertAlmostEqual(transfers[0]["amount"], 4_000)

        chain.advance_blocks(1)
        res = chain.execute(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 1_000)

        # block 25
        chain.advance_blocks(5)
        res = chain.execute(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 25_000)

        # block 25 bob reward
        res = chain.execute(self.ct.withdraw_rewards(bob, bob), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 35_000)
