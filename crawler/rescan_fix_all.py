import os
import sys
import json
import time
import pymongo
import logging
import requests
import datetime

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.server_api import ServerApi

from scales_utils import get_owner_id

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', datefmt='%d-%b-%y %H:%M:%S', stream=sys.stdout)


def initialize_new_entry(asset, metadata_path, owner_db):
    try:
        metadata = json.load(open(os.path.join(metadata_path, f"{asset['token_id']}.json")))
    except Exception as e:
        raise ValueError(f"Unable to open metadata file for {asset['token_id']} due to {e}")

    rows = ["A", "B", "C", "D", "E", "F"]
    owner_id = get_owner_id(asset['owner']['address'].lower(), owner_db)

    doc = {
        "token_id": int(asset["token_id"]),
        "name": asset["name"],
        "image_url": asset["image_original_url"],
        "image_thumbnail_url": asset["image_thumbnail_url"],
        "contract_address": asset["asset_contract"]["address"].lower(),
        "painting": metadata["attributes"][0]["value"],
        "position": {
            "name": metadata["Row"] + metadata["Column"],
            "row": rows.index(metadata["Row"]) + 1,
            "col": int(metadata["Column"]),
            "row_count": int(metadata["Parent Painting Row Amount"]),
            "col_count": int(metadata["Parent Painting Column Amount"]),
            "index": (rows.index(metadata["Row"]) * int(metadata["Parent Painting Column Amount"])) + int(metadata["Column"]) - 1,
        },
        "owner": {
            "address": asset["owner"]["address"].lower(),
            "owner_id": owner_id
        },
        "last_updated": {
            "timestamp": datetime.datetime.now()
        }
    }

    return doc


def check_update_asset(db_client, asset, metadata_path):
    mongodb = db_client.scales
    scales_db = mongodb.scales
    owner_db = mongodb.owner

    token_id = int(asset["token_id"])

    doc = scales_db.find_one({"token_id": token_id})

    # Add new entry if it doesn't exist
    if doc is None:
        doc = initialize_new_entry(asset, metadata_path, owner_db)
        scales_db.insert_one(doc)
        return

    # Add image thumbnail URL if not already present    
    if 'image_thumbnail_url' not in doc:
        logging.info(f"Token {token_id} has no image_thumbnail_url, updating!")
        scales_db.update_one({"id": token_id}, {"$set": {"image_thumbnail_url": asset["image_thumbnail_url"]}})

    # Update owner details
    if doc['owner']['address'].lower() != asset['owner']['address'].lower() or 'owner_id' not in doc['owner']:
        logging.info(f"Token {token_id} has incorrect owner details, updating!")
        owner_id = get_owner_id(asset['owner']['address'].lower(), owner_db)

        scales_db.update_one({"token_id": token_id}, {"$set": {
            "owner": {
                "address": asset['owner']['address'].lower(),
                "owner_id": owner_id
            }}})


if __name__ == '__main__':
    # Read environment variables
    load_dotenv()
    CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
    CONTRACT_ABI_PATH = os.getenv("CONTRACT_ABI_PATH")
    MONGODB_USER = os.getenv("MONGODB_USER")
    MONGODB_PASS = os.getenv("MONGODB_PASS")
    MONGODB_HOST = os.getenv("MONGODB_HOST")
    INFURA_URL = os.getenv('INFURA_URL')
    OPENSEA_API_KEY = os.getenv('OPENSEA_API_KEY')
    METADATA_PATH = os.getenv('METADATA_PATH')
    RESCAN_INTERVAL = int(os.getenv('RESCAN_INTERVAL'))

    try:
        db_client = MongoClient(f"mongodb+srv://{MONGODB_USER}:{MONGODB_PASS}@{MONGODB_HOST}/?retryWrites=true&w=majority", server_api=ServerApi('1'))
    except pymongo.errors.PyMongoError as e:
        print(f"Error connecting to MongoDB: {e}")
        sys.exit(1)

    while True:
        url = f"https://api.opensea.io/api/v1/assets?order_direction=desc&asset_contract_address={CONTRACT_ADDRESS}&limit=10&include_orders=false"

        headers = {
            "Accept": "application/json",
            "X-API-KEY": OPENSEA_API_KEY
        }

        response = requests.get(url, headers=headers)
        data = response.json()

        if "assets" in data:
            logging.info(f"Got {len(data['assets'])} assets")
            for asset in data['assets']:
                check_update_asset(db_client, asset, METADATA_PATH)

        if "next" in data:
            while data['next']:
                url = f"https://api.opensea.io/api/v1/assets?order_direction=desc&asset_contract_address={CONTRACT_ADDRESS}&limit=50&include_orders=false&cursor={data['next']}"
                response = requests.get(url, headers=headers)
                data = response.json()
                if "assets" in data:
                    logging.info(f"Got {len(data['assets'])} more assets")
                    for asset in data['assets']:
                        check_update_asset(db_client, asset, METADATA_PATH)

        time.sleep(RESCAN_INTERVAL)
