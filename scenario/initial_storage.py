import json

def parse_lambdas(path):
    lambdas = {}
    entries = json.load(open(path))
    for i in range(len(entries)):
        entry = entries[i]
        lambdas[i] = entry

    return lambdas

auction_lambdas = parse_lambdas("./build/lambdas/auction_lambdas.json")
dex_core_lambdas = parse_lambdas("./build/lambdas/dex_core_lambdas.json")