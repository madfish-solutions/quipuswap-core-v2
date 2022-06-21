
from asyncio import trsock
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

        cls.ct = ContractInterface.from_micheline(code["michelson"])

        storage = cls.ct.storage.dummy()
        storage["auction_lambdas"] = auction_lambdas
        storage["storage"]["admin"] = admin 
        storage["storage"]["dex_core"] = dex_core
        storage["storage"]["auction_duration"] = 300
        storage["storage"]["min_bid"] = 10
        storage["storage"]["quipu_token"] = {
            "token" : quipu_token,
            "id" : 0,
        }

        cls.init_storage = storage

    def test_launch_auction(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.receive_fee(token_a_fa2, 10), sender=dex_core)

        res = chain.execute(self.ct.launch_auction(token_a_fa2, 10, 100), sender=alice)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 100)
        self.assertEqual(transfers[0]["destination"], contract_self_address)
        self.assertEqual(transfers[0]["source"], alice)
        self.assertEqual(transfers[0]["token_address"], quipu_token)
        self.assertEqual(transfers[0]["token_id"], 0)

        res = chain.execute(self.ct.place_bid(0, 107), sender=bob)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 100)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["token_address"], quipu_token)
        self.assertEqual(transfers[0]["token_id"], 0)

        self.assertEqual(transfers[1]["amount"], 107)
        self.assertEqual(transfers[1]["destination"], contract_self_address)
        self.assertEqual(transfers[1]["source"], bob)
        self.assertEqual(transfers[1]["token_address"], quipu_token)
        self.assertEqual(transfers[1]["token_id"], 0)

        chain.advance_blocks(10)

        res = chain.execute(self.ct.claim(0))
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 10)
        self.assertEqual(transfers[0]["destination"], bob)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["token_address"], token_a_address)
        self.assertEqual(transfers[0]["token_id"], 0)

        with self.assertRaises(MichelsonRuntimeError) as error:
            chain.execute(self.ct.place_bid(0, 150), sender=bob)
        self.assertEqual(error.exception.args[-1], Errors.AUCTION_FINISHED)


    def test_cant_launch(self):
        chain = LocalChain(storage=self.init_storage)

        with self.assertRaises(MichelsonRuntimeError) as error:
            chain.execute(self.ct.launch_auction(token_a_fa2, 10, 100))
        self.assertEqual(error.exception.args[-1], Errors.AUCTION_INSUFFICIENT_BALANCE)

        chain.execute(self.ct.receive_fee(token_a_fa2, 10), sender=dex_core)

        chain.execute(self.ct.set_min_bid(35), sender=admin)

        with self.assertRaises(MichelsonRuntimeError) as error:
            chain.execute(self.ct.launch_auction(token_a_fa2, 10, 34))
        self.assertEqual(error.exception.args[-1], Errors.MIN_BID)

        with self.assertRaises(MichelsonRuntimeError) as error:
            chain.execute(self.ct.launch_auction(token_a_fa2, 0, 42))
        self.assertEqual(error.exception.args[-1], Errors.AUCTIONED_AMOUNT_LOW)
   
    def test_dev_fee(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.set_fees({
            "bid_fee_f" : 0,
            "dev_fee_f" : int(0.03 * 1e18)
        }), sender=admin)

        res = chain.execute(self.ct.receive_fee(token_a_fa2, 10), sender=dex_core)

        res = chain.execute(self.ct.withdraw_dev_fee(token_a_fa2, alice), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)
        # self.assertEqual(transfers[0]["amount"], 0)

        res = chain.execute(self.ct.receive_fee(token_a_fa2, 3_000), sender=dex_core)
        res = chain.execute(self.ct.receive_fee(token_a_fa2, 7_000), sender=dex_core)
        res = chain.execute(self.ct.withdraw_dev_fee(token_a_fa2, alice), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 300)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["token_address"], token_a_address)
        self.assertEqual(transfers[0]["token_id"], 0)

        res = chain.execute(self.ct.withdraw_dev_fee(token_a_fa2, alice), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(parse_transfers(res)), 0)


    def test_bid_fee_zero(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.set_fees({
            "bid_fee_f" : 0,
            "dev_fee_f" : int(0.03 * 1e18)
        }), sender=admin)

        res = chain.execute(self.ct.set_min_bid(0), sender=admin)

        res = chain.execute(self.ct.receive_fee(token_a_fa2, 999), sender=dex_core)

        res = chain.execute(self.ct.launch_auction(token_a_fa2, 199, 0), sender=alice)

        res = chain.execute(self.ct.place_bid(0, 100), sender=bob)
        transfers = parse_transfers(res)
        self.assertEqual(transfers[0]["amount"], 0)

        res = chain.interpret(self.ct.burn_bid_fee(), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

    # TODO
    def test_bid_fee(self):
        chain = LocalChain(storage=self.init_storage)

        res = chain.execute(self.ct.set_fees({
            "bid_fee_f" : int(0.02 * 1e18),
            "dev_fee_f" : 0,
        }), sender=admin)

        res = chain.execute(self.ct.set_min_bid(1), sender=admin)

        res = chain.execute(self.ct.receive_fee(token_a_fa2, 10), sender=dex_core)

        res = chain.execute(self.ct.launch_auction(token_a_fa2, 10, 1), sender=alice)

        res = chain.execute(self.ct.place_bid(0, 100), sender=bob)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 0)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["token_address"], quipu_token)
        self.assertEqual(transfers[0]["token_id"], 0)

        self.assertEqual(transfers[1]["amount"], 100)
        self.assertEqual(transfers[1]["destination"], contract_self_address)
        self.assertEqual(transfers[1]["source"], bob)
        self.assertEqual(transfers[1]["token_address"], quipu_token)
        self.assertEqual(transfers[1]["token_id"], 0)

        # no fee to burn due to small amounts
        res = chain.interpret(self.ct.burn_bid_fee(), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

        res = chain.execute(self.ct.place_bid(0, 1_000), sender=alice)

        res = chain.execute(self.ct.place_bid(0, 10_000), sender=bob)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 2)
        self.assertEqual(transfers[0]["amount"], 980)
        self.assertEqual(transfers[0]["destination"], alice)
        self.assertEqual(transfers[0]["source"], contract_self_address)
        self.assertEqual(transfers[0]["token_address"], quipu_token)
        self.assertEqual(transfers[0]["token_id"], 0)

        self.assertEqual(transfers[1]["amount"], 10_000)
        self.assertEqual(transfers[1]["destination"], contract_self_address)
        self.assertEqual(transfers[1]["source"], bob)
        self.assertEqual(transfers[1]["token_address"], quipu_token)
        self.assertEqual(transfers[1]["token_id"], 0)

        res = chain.execute(self.ct.burn_bid_fee(), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 1)
        self.assertEqual(transfers[0]["amount"], 22)
        self.assertEqual(transfers[0]["destination"], burn)
        self.assertEqual(transfers[0]["source"], contract_self_address)

        # no more feee left to burn
        res = chain.execute(self.ct.burn_bid_fee(), sender=admin)
        transfers = parse_transfers(res)
        self.assertEqual(len(transfers), 0)

    def test_set_auction_duration(self):
        chain = LocalChain(storage=self.init_storage)

        chain.execute(self.ct.receive_fee(token_a_fa2, 55), sender=dex_core)

        chain.execute(self.ct.launch_auction(token_a_fa2, 55, 1_000), sender=alice)

        chain.advance_blocks(7)

        # pid still can be placed
        chain.execute(self.ct.place_bid(0, 2_000), sender=bob)

        res = chain.execute(self.ct.set_auction_duration(150), sender=admin)
        self.assertEqual(res.operations, [])

        chain.advance_blocks(3)

        with self.assertRaises(MichelsonRuntimeError) as error:
            chain.execute(self.ct.place_bid(0, 3_000), sender=bob)
        self.assertEqual(error.exception.args[-1], Errors.AUCTION_FINISHED)

        # another auction
        chain.execute(self.ct.receive_fee(token_b_fa2, 420_420), sender=dex_core)
        chain.execute(self.ct.launch_auction(token_b_fa2, 420_420, 1_000), sender=alice)

        # 90 seconds since auction start
        chain.advance_blocks(3)
        chain.execute(self.ct.place_bid(1, 2_000), sender=bob)

        # 180 seconds since auction start
        chain.advance_blocks(3)
        with self.assertRaises(MichelsonRuntimeError) as error:
            chain.execute(self.ct.place_bid(1, 3_000), sender=bob)
        self.assertEqual(error.exception.args[-1], Errors.AUCTION_FINISHED)

    def test_auction_cant_change_already_set_lambdas(self):
        no_lambdas_storage = self.ct.storage.dummy()
        no_lambdas_storage["storage"]["admin"] = admin 

        chain = LocalChain(storage=no_lambdas_storage)
        
        with self.assertRaises(MichelsonRuntimeError) as error: 
            chain.execute(self.ct.setup_func(0, auction_lambdas[0]), sender=alice)
        self.assertEqual(Errors.ERR_NOT_ADMIN, error.exception.args[-1])

        chain.execute(self.ct.setup_func(0, auction_lambdas[0]), sender=admin)

        with self.assertRaises(MichelsonRuntimeError) as error:
            chain.execute(self.ct.setup_func(0, auction_lambdas[0]), sender=admin)
        self.assertEqual(Errors.AUCTION_FUNC_ALREADY_SET, error.exception.args[-1])

        chain.execute(self.ct.setup_func(13, auction_lambdas[8]), sender=admin)

        with self.assertRaises(MichelsonRuntimeError) as error:
            chain.execute(self.ct.setup_func(14, auction_lambdas[8]), sender=admin)
        self.assertEqual(Errors.AUCTION_EXCEEDS_MAX_LAMBDA_INDEX, error.exception.args[-1])

        






