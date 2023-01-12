def get_owner_id(address, owner_db):
    """
    Look up wallet in list and return ID of owner. Create if not found.

    Params:
        address (str): Address of wallet to look up
        owner_db (pymongo.collection): Collection of owners

    Returns:
        str: ID of owner
    """
    owner = owner_db.find_one({"wallets": address.lower()})
    if owner:
        owner_id = owner['_id']
    else:
        owner_entry = {
            "wallets": [address.lower()]
        }
        res = owner_db.insert_one(owner_entry)
        owner_id = res.inserted_id

    return owner_id
