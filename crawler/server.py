import os
import sys
import json
import time
import pymongo
import logging

from web3 import Web3
from dateutil import parser
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.server_api import ServerApi

from config import DAO_MEMBERS
from opensea_utils import get_new_events, get_all_events, EVENT_TYPE_TRANSFER

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', datefmt='%d-%b-%y %H:%M:%S', stream=sys.stdout)


def load_metadata(path):
    metadata = dict()
    for f in os.listdir(path):
        if f.endswith(".json"):
            with open(os.path.join(path, f)) as json_file:
                metadata[int(f.split(".")[0])] = json.load(json_file)
    return metadata


def initial_data_load(db_client, metadata):
    db = db_client.scales

    data = []
    for token_id in range(1, 505):
        d = metadata[token_id].copy()

        # Flatten traits and remove the lengthy description
        d['painting'] = [a['value'] for a in d['attributes'] if a['trait_type'] == 'Parent Painting'][0]
        del(d['description'])

        # Get owner details
        try:
            d['owner'] = contract.functions.ownerOf(int(token_id)).call()
            d['owner'] = d['owner'].lower()
        except:
            d['owner'] = ""

        # Check if it is owned by any of the DAO members
        d['owned_by_us'] = d['owner'] in DAO_MEMBERS

        data.append(d)

    #db.scales.insert_many(data)


def process_transfer_events(db_client, events):
    db = db_client.scales
    coll = db.scales
    
    for event in sorted(
        events, key=lambda event: event["transaction"]["timestamp"]
    ):
        # Log to disk for debug purposes
        with open('event_log.json', 'a') as f:
            json.dump(event, f)

        try:
            token_id = event['asset']['token_id']
            to_addr = event['to_account'].get('address', None)
            if event['to_account']['user']:
                to_user = event['to_account']['user'].get('username', None)
        except Exception as e:
            logging.warning(f"Failure to parse event {event['id']} due to: {e}")
            with open('event_failures.json', 'a') as f:
                json.dump(event, f)
            continue

        # Find the document to update
        doc = coll.find_one({'id': token_id})
        if doc is None:
            logging.warning(f"Token {token_id} not found in database, skipped!")
            continue

        if doc['owner'] != to_addr:
            if 'last_updated_block' in doc and doc['last_updated_block'] > int(event['transaction']['block_number']):
                logging.warning(f"Token {token_id} already updated in block {doc['last_updated_block']}, skipping!")
                with open('event_failures.json', 'a') as f:
                    json.dump(event, f)
                continue

            # Update the document
            last_updated_dt = parser.parse(event['transaction']['timestamp'])

            try:
                coll.update_one({'id': token_id}, {"$set":{
                    'owner': to_addr,
                    'owner_username': to_user,
                    'owned_by_us': to_addr in DAO_MEMBERS,
                    'last_updated': last_updated_dt,
                    'last_updated_tx': event['transaction']['transaction_hash'],
                    'last_updated_block': int(event['transaction']['block_number']),
                }})
            except:
                logging.warning(f"Failure to update token {token_id}, skipped!")
        
            logging.info(f"Token {token_id} updated with new owner {to_user} {to_addr}")
        
        if 'image_thumbnail_url' not in doc:
            coll.update_one({'id': token_id}, {"$set":{                
                'image_thumbnail_url': event['asset']['image_thumbnail_url'],
            }})


def main(db_client, contract, metadata, opensea_api_key, parse_from_start=False, check_interval=60):
    last_event_id_seen = 0

    if parse_from_start:
        # Fetch all events from the start of time, as defined here
        start = 1655683200
        new_events = []

        try:
            logging.info(
                f"Querying for all events from {start}"
            )
            new_events, new_last_id = get_all_events(
                opensea_api_key=opensea_api_key,
                event_type=EVENT_TYPE_TRANSFER,
                contract_address=contract.address,
                start_time=start,
                last_event_id_seen=last_event_id_seen,
            )
            last_event_id_seen = new_last_id
        except Exception as e:
            logging.warning(e)
            time.sleep(1)

        if new_events:
            logging.info(f"Got {len(new_events)} transfer events from the start to process")
            process_transfer_events(db_client, new_events)
    
    while True:
        new_events = []
        now = int(time.time())

        try:
            logging.info(
                f"Querying for new events up until {now} filtering for events after {last_event_id_seen}"
            )
            new_events, new_last_id = get_new_events(
                opensea_api_key=opensea_api_key,
                event_type=EVENT_TYPE_TRANSFER,
                contract_address=contract.address,
                start_time=now,
                last_event_id_seen=last_event_id_seen,
            )
            last_event_id_seen = new_last_id
        except Exception as e:
            logging.warning(e)
            time.sleep(1)
            continue

        if new_events:
            logging.info(f"Got {len(new_events)} new transfer events to process")
            process_transfer_events(db_client, new_events)

        time.sleep(check_interval)


if __name__ == "__main__":
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

    # Exit if any of the env variables are not set
    if not CONTRACT_ADDRESS or not MONGODB_USER or not MONGODB_PASS or not MONGODB_HOST or not INFURA_URL or not OPENSEA_API_KEY:
        print("Please set the environment variables and try again")
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(INFURA_URL))
    contract = w3.eth.contract(
        address = Web3.toChecksumAddress(CONTRACT_ADDRESS.lower()),
        abi = json.load(open(CONTRACT_ABI_PATH, 'r'))
    )

    metadata = load_metadata(METADATA_PATH)

    try:
        db_client = MongoClient(f"mongodb+srv://{MONGODB_USER}:{MONGODB_PASS}@{MONGODB_HOST}/?retryWrites=true&w=majority", server_api=ServerApi('1'))
    except pymongo.errors.PyMongoError as e:
        print(f"Error connecting to MongoDB: {e}")
        sys.exit(1)

    main(db_client, contract, metadata, OPENSEA_API_KEY, PARSE_FROM_START, CHECK_INTERVAL)
