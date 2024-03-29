
from operator import eq
from unittest import TestCase, skip
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

    @skip("delta 1 problem. 19 instead of 20 blocks work fine")
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


    def test_reward_deposit_in_the_middle(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.vote(alice, carol, True, 100_000), sender=dex_core, view_results=vr)

        res = chain.execute(self.ct.default(), amount=20_000, view_results=vr)
        
        chain.advance_blocks(12)

        res = chain.execute(self.ct.vote(bob, carol, True, 100_000_000_000), sender=dex_core, view_results=vr)

        chain.advance_blocks(5)

        res = chain.execute(self.ct.withdraw_rewards(alice, alice), view_results=vr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 4_000) # still gets two blocks reward no matter what
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

    def test_bucket_claim(self):
        chain = LocalChain(storage=self.init_storage)

        lvr = vr.copy()
        lvr[f"{dex_core}%get_baker_rate"] = int(1e18 * 0.01)

        res = chain.execute(self.ct.vote(alice, carol, True, 50), sender=dex_core, view_results=lvr)
        res = chain.execute(self.ct.vote(bob, carol, True, 50), sender=dex_core, view_results=lvr)

        res = chain.execute(self.ct.default(), amount=20_000, view_results=lvr)

        chain.advance_blocks(15)

        res = chain.execute(self.ct.withdraw_rewards(alice, alice), view_results=lvr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 4_950)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["type"], "tez")

        res = chain.execute(self.ct.withdraw_rewards(bob, bob), view_results=lvr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 4_950)
        self.assertEqual(transfers[0]["destination"], bob)
        self.assertEqual(transfers[0]["type"], "tez")

        with self.assertRaises(MichelsonRuntimeError):
            res = chain.execute(self.ct.claim_baker_fund(admin), view_results=lvr, sender=bob)

        res = chain.execute(self.ct.claim_baker_fund(admin), view_results=lvr, sender=dex_core)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 200)
        self.assertEqual(transfers[0]["destination"], admin)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["type"], "tez")

        # can't claim 0 tez
        with self.assertRaises(MichelsonRuntimeError):
            chain.execute(self.ct.claim_baker_fund(admin), view_results=lvr, sender=dex_core)



