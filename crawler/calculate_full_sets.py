import os
import sys
import logging
import argparse
import pymongo
import numpy as np

from dotenv import load_dotenv
from collections import defaultdict
from pymongo import MongoClient
from pymongo.server_api import ServerApi


def _count_row_sets(arr):
    setcount = 0
    a = arr.copy()
    for row in range(a.shape[0]):
        # Find all valid start positions with at least 3 consecutive cells left in the row
        for start in list(range(arr.shape[1] - 3)):
            if all(
                [a[row, start], a[row, start + 1], a[row, start + 2], a[row, start + 3]]
            ):
                a[row, start : start + 4] = 0
                setcount += 1
    return setcount, a


def _count_column_sets(arr):
    setcount = 0
    a = arr.copy()
    for col in range(a.shape[1]):
        # Find all valid start positions with at least 3 consecutive cells left in the column
        for start in list(range(arr.shape[0] - 3)):
            if all(
                [a[start, col], a[start + 1, col], a[start + 2, col], a[start + 3, col]]
            ):
                a[start : start + 4, col] = 0
                setcount += 1
    return setcount, a


def get_full_set_count(arr):
    """Count the number of full sets in the input array.

    A full set is four consecutive cells in a row or column. In addition, one
    cell cannot be used in two sets simultaneously. For this reason, a copy of
    the input array is updated to remove already-used cells and returned by the
    count function for further processing.

    The main algorithm is to walk each row and count the number of sets, and
    then check if there are any remaining cells that can be used to form
    column-based sets. The returned, modified array is used for that purpose.
    After walking each row, the process starts over by walking column by column
    instead. Any remaining cells are checked for row-based sets.

    Finally, we check which method (row-wise or column-wise) yielded the
    highest number of full sets, and return that number.

    Input validation checks that the provided array is minimum 4x4 in size, as
    the counting functions assume that there are at least 4 consecutive cells.
    Arrays with more or less than two dimentions are not supported.

    Args:
        arr (np.array): Array of cells to check for full sets.
    
    Returns:
        int: Number of full sets in the input array.
    """
    # Input validation
    if len(arr.shape) != 2 or arr.shape[0] < 4 or arr.shape[1] < 4:
        raise ValueError(f"Malformed input array with unsupported shape {arr.shape}")

    # Walk each row first
    setcount1, modified_array1 = _count_row_sets(arr)
    # Check if there are more valid sets after rows have been processed
    setcount1_remaining, _ = _count_column_sets(modified_array1)
    setcount1 += setcount1_remaining

    # Then walk each column to see if that yields better results
    setcount2, modified_array2 = _count_column_sets(arr)
    # Check if there are more valid sets after columns have been processed
    setcount2_remaining, _ = _count_row_sets(modified_array2)
    setcount2 += setcount2_remaining

    return setcount1 if setcount1 > setcount2 else setcount2


def main(db_client):
    scales_db = db_client.scales.scales
    owner_db = db_client.scales.owner

    # Wallet address -> Full set count
    owner_full_set_count = defaultdict(int)

    # For each owner, check if they have 4 or more from one painting, and if so, check for full sets
    for owner in owner_db.find():
        owner_id = owner["_id"]
        owner_scales = scales_db.find({"owner.owner_id": owner_id})
        owner_painting_scales = {}
        for scale in owner_scales:
            painting = scale["painting"]
            if painting not in owner_painting_scales:
                owner_painting_scales[painting] = []
            owner_painting_scales[painting].append(scale)

        for painting in owner_painting_scales:
            if len(owner_painting_scales[painting]) >= 4:
                logging.debug(f"{owner_id} has 4 or more from {painting}")
                for scale in owner_painting_scales[painting]:
                    logging.debug(scale["position"])
                row_count = owner_painting_scales[painting][0]["position"]["row_count"]
                col_count = owner_painting_scales[painting][0]["position"]["col_count"]

                arr = np.zeros((row_count, col_count))
                for scale in owner_painting_scales[painting]:
                    arr[scale["position"]["row"] - 1, scale["position"]["col"] - 1] = 1
                logging.debug(arr)
                full_set_count = get_full_set_count(arr)
                if full_set_count > 0:
                    owner_full_set_count[owner["wallets"][0]] += full_set_count
                    logging.info(
                        f"Wallet {owner['wallets'][0]} has {full_set_count} full sets in {painting}"
                    )

    # Print in CSV format for import into a spreadsheet
    # for wallet, count in owner_full_set_count.items():
    #    print(f"{wallet},{count}")


if __name__ == "__main__":
    # Command-line arguments for extra options while testing, like debug output
    parser = argparse.ArgumentParser()
    parser.add_argument("--debug", action="store_true", help="Enable debug output")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO if not args.debug else logging.DEBUG,
        format="%(asctime)s - %(levelname)s - %(message)s",
        datefmt="%d-%b-%y %H:%M:%S",
        stream=sys.stdout,
    )

    # Load main service configuration from .env
    load_dotenv()
    OPENSEA_API_KEY = os.getenv("OPENSEA_API_KEY")
    COLLECTION_NAME = os.getenv("COLLECTION_NAME")
    CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
    MONGODB_USER = os.getenv("MONGODB_USER")
    MONGODB_PASS = os.getenv("MONGODB_PASS")
    MONGODB_HOST = os.getenv("MONGODB_HOST")

    try:
        db_client = MongoClient(
            f"mongodb+srv://{MONGODB_USER}:{MONGODB_PASS}@{MONGODB_HOST}/?retryWrites=true&w=majority",
            server_api=ServerApi("1"),
        )
    except pymongo.errors.PyMongoError as e:
        logging.error(f"Error connecting to MongoDB: {e}")
        sys.exit(1)

    main(db_client)
