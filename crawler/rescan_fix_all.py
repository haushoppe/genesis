import os
import sys
import json
import logging
import requests

from dateutil import parser

import pymongo
from pymongo import MongoClient
from pymongo.server_api import ServerApi

from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', datefmt='%d-%b-%y %H:%M:%S', stream=sys.stdout)


DAO_MEMBERS = [
    # Add lowercased wallet addresses here
]



def check_update_asset(db_client, asset):
    db = db_client.scales
    coll = db.scales

    doc = coll.find_one({"id": asset["token_id"]})
    if doc is None:
        logging.warning(f"Token {asset['token_id']} not found in database, skipped!")
        logging.debug(asset)
        return False
    
    if 'image_thumbnail_url' not in doc:
        logging.info(f"Token {asset['token_id']} has no image_thumbnail_url, updating!")
        coll.update_one({"id": asset["token_id"]}, {"$set": {"image_thumbnail_url": asset["image_thumbnail_url"]}})

    if 'owner' not in doc or doc['owner'].lower() != asset['owner']['address'].lower():
        logging.info(f"Token {asset['token_id']} has incorrect owner details, updating!")
        coll.update_one({"id": asset["token_id"]}, {"$set": {
            "owner": asset["owner"]["address"].lower(),
            "owned_by_us": asset["owner"]["address"].lower() in DAO_MEMBERS,
            "owner_username": asset["owner"]["username"] if "username" in asset["owner"] else None,
            }})


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
    PARSE_FROM_START = True if os.getenv('PARSE_FROM_START') == "true" else False
    CHECK_INTERVAL = int(os.getenv('CHECK_INTERVAL'))

    try:
        db_client = MongoClient(f"mongodb+srv://{MONGODB_USER}:{MONGODB_PASS}@{MONGODB_HOST}/?retryWrites=true&w=majority", server_api=ServerApi('1'))
    except pymongo.errors.PyMongoError as e:
        print(f"Error connecting to MongoDB: {e}")
        sys.exit(1)

    url = f"https://api.opensea.io/api/v1/assets?order_direction=desc&asset_contract_address={CONTRACT_ADDRESS}&limit=20&include_orders=false"

    headers = {
        "Accept": "application/json",
        "X-API-KEY": OPENSEA_API_KEY
    }

    response = requests.get(url, headers=headers)
    data = response.json()

    logging.info(f"Got {len(data['assets'])} assets")
    for asset in data['assets']:
        check_update_asset(db_client, asset)

    while data['next']:
        url = f"https://api.opensea.io/api/v1/assets?order_direction=desc&asset_contract_address={CONTRACT_ADDRESS}&limit=20&include_orders=false&cursor={data['next']}"
        response = requests.get(url, headers=headers)
        data = response.json()
        logging.info(f"Got {len(data['assets'])} more assets")
        for asset in data['assets']:
            check_update_asset(db_client, asset)
