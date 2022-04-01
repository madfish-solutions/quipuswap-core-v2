
from unittest import TestCase
import json
from pprint import pprint
from constants import *

from helpers import *

from pytezos import ContractInterface, MichelsonRuntimeError
from initial_storage import auction_lambdas

class AuctionTest(TestCase):

    @classmethod
    def setUpClass(cls):
        cls.maxDiff = None

        text = open("./build/auction.json").read()
        code = json.loads(text)

        cls.dex = ContractInterface.from_micheline(code["michelson"])

        storage = cls.dex.storage.dummy()
        storage["auction_lambdas"] = auction_lambdas
        storage["storage"]["admin"] = admin 
        storage["storage"]["dex_core"] = dex_core

        cls.init_storage = storage

    def test_launch_auction(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.dex.receive_fee(token_a_fa2, 10), sender=dex_core)

        res = chain.execute(self.dex.launch_auction(token_a_fa2, 10, 100))

        pprint(res.storage["storage"])
        # votes = parse_votes(res)
        # self.assertEqual(votes[0]["delegate"], carol)
        # self.assertEqual(votes[0]["amount"], 50 + 0)
