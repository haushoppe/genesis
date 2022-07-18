import os
import sys
import json
import logging
import datetime

from web3 import Web3
from dotenv import load_dotenv

from config import DAO_MEMBERS

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', datefmt='%d-%b-%y %H:%M:%S', stream=sys.stdout)


def load_metadata(path):
    metadata = dict()
    for f in os.listdir(path):
        if f.endswith(".json"):
            with open(os.path.join(path, f)) as json_file:
                metadata[int(f.split(".")[0])] = json.load(json_file)
    return metadata


def main(contract, metadata, block_number):
    data = []
    for token_id in range(1, 505):
        d = metadata[token_id].copy()

        # Get owner details
        try:
            d['owner'] = contract.functions.ownerOf(int(token_id)).call(block_identifier=block_number)
            d['owner'] = d['owner'].lower()
            d['owned_by_us'] = True if d['owner'] in DAO_MEMBERS else False
        except:
            d['owner'] = ""

        data.append(d)

    with open(f"snapshot-{datetime.datetime.today().strftime('%Y-%m-%dT%H%M')}-{block_number}.json", "w") as f:
        json.dump(data, f)


if __name__ == "__main__":
    # Read environment variables
    load_dotenv()
    CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
    CONTRACT_ABI_PATH = os.getenv("CONTRACT_ABI_PATH")
    INFURA_URL = os.getenv('INFURA_URL')
    METADATA_PATH = os.getenv('METADATA_PATH')
    BLOCK_NUMBER = os.getenv('BLOCK_NUMBER')
    if BLOCK_NUMBER != 'latest':
        BLOCK_NUMBER = int(BLOCK_NUMBER)

    # Exit if any of the env variables are not set
    if not CONTRACT_ADDRESS or not INFURA_URL:
        print("Please set the environment variables and try again")
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(INFURA_URL))
    contract = w3.eth.contract(
        address = Web3.toChecksumAddress(CONTRACT_ADDRESS.lower()),
        abi = json.load(open(CONTRACT_ABI_PATH, 'r'))
    )

    metadata = load_metadata(METADATA_PATH)

    main(contract, metadata, BLOCK_NUMBER)
