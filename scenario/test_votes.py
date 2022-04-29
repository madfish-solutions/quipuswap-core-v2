
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError
from initial_storage import dex_core_lambdas

class VotingTest(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        text = open("./contracts/compiled/bucket.tz").read()
        cls.ct = ContractInterface.from_michelson(text)

        storage = cls.ct.storage.dummy()
        storage["dex_core"] = dex_core 
        storage["collecting_period_end"] = 10

        cls.init_storage = storage

    def test_farm_vote_candidate_switch(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.vote(alice, carol, True, 50), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], carol) # 50 vs 0

        res = chain.execute(self.ct.vote(bob, dave, True, 60), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], dave) # 50 vs 60

        res = chain.execute(self.ct.vote(alice, carol, True, 100), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], carol) # 100 vs 60

        res = chain.execute(self.ct.vote(bob, dave, True, 70), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(len(votes), 0) # 100 vs 70. Delegate stays the same

        res = chain.execute(self.ct.vote(alice, carol, True, 90), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(len(votes), 0) # 90 vs 70. Delegate stays the same

        res = chain.execute(self.ct.vote(alice, carol, True, 60), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], dave) # 60 vs 70

        # bob changes his mind for carol in the end
        res = chain.execute(self.ct.vote(bob, carol, True, 70), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], carol) # 130 vs 0. Delegate stays the same

    def test_farm_vote_unvote(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.vote(alice, carol, True, 50), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], carol) # 50 vs 0

        res = chain.execute(self.ct.vote(bob, dave, True, 60), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], dave) # 50 vs 60
        
        res = chain.execute(self.ct.vote(bob, dave, True, 0), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], carol) # 50 vs 0

        res = chain.execute(self.ct.vote(alice, carol, True, 0), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(len(votes), 0) # carol stays delegate
    
    def test_ban_baker(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.vote(alice, carol, True, 50), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], carol) # 50 vs 0

        res = chain.execute(self.ct.vote(bob, dave, True, 60), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], dave) # 50 vs 60

        res = chain.execute(self.ct.ban_baker(dave, 300), sender=dex_core)

        res = chain.execute(self.ct.vote(bob, dave, True, 100), sender=dex_core)
        votes = parse_delegations(res)
        self.assertEqual(votes[0], carol) # 50 vs 100 banned