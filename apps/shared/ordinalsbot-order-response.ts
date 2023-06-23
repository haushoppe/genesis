import { ChargeStatus } from './ordinalsbot-charge-status'


/*
RESPONSE of POST https://api2.ordinalsbot.com/order
AND
RESPONSE of GET https://api2.ordinalsbot.com/order?id=da418953-225b-4cba-99f9-1c5f826704b0
*/
/*
export const exampleUnpaidResponse = {
    "status": "ok",
    "files": [
        {
            "size": 18,
            "type": "text/html",
            "name": "test.html",
            "dataURL": "data:text/html;base64,PGh0bWw+SGVsbG8gV29ybGQh",
            "url": ""
        }
    ],
    "lowPostage": false,
    "receiveAddress": "",
    "rareSats": "random",
    "fee": 27,
    "referral": "your-referral-code",
    "charge": {
        "id": "da418953-225b-4cba-99f9-1c5f826704b0",
        "description": "ordinalsbot order",
        "desc_hash": false,
        "created_at": 1687354405,
        "status": "unpaid",
        "amount": 34044,
        "callback_url": "",
        "success_url": null,
        "hosted_checkout_url": "https://checkout.opennode.com/da418953-225b-4cba-99f9-1c5f826704b0",
        "order_id": null,
        "currency": "BTC",
        "source_fiat_value": 34044,
        "fiat_value": 9.05,
        "auto_settle": false,
        "notif_email": null,
        "address": "3NSpfNwErQG7hiVRwwTsBwycVHm7BLnT6L",
        "metadata": {},
        "chain_invoice": {
            "address": "3NSpfNwErQG7hiVRwwTsBwycVHm7BLnT6L"
        },
        "uri": "bitcoin:3NSpfNwErQG7hiVRwwTsBwycVHm7BLnT6L?amount=0.00034044&label=ordinalsbot+order&lightning=lnbc340440n1pjf9lpypp5ek9af4pcme042scc0562ajmw77t9hrkwc0kp7czujsgqkkxpcf2sdqudaexg6twv9k8xcn0wssx7unyv4eqcqzzsxqy8ayqsp5tjws7q9ana69wuhsl03vh8snrnzvz4w9j8xpvfetye7kdydrqy3q9qyyssqat47ytufz3299phnvs8pzrn5veylc57ycl5wlxqgy8rq82xgth9yhwk23qnu0f5mtv39fvjc82m2clcr8r4ja8vz7ytk8856ghzhgjcqj0f0g6",
        "ttl": 4320,
        "lightning_invoice": {
            "expires_at": 1687613604,
            "payreq": "lnbc340440n1pjf9lpypp5ek9af4pcme042scc0562ajmw77t9hrkwc0kp7czujsgqkkxpcf2sdqudaexg6twv9k8xcn0wssx7unyv4eqcqzzsxqy8ayqsp5tjws7q9ana69wuhsl03vh8snrnzvz4w9j8xpvfetye7kdydrqy3q9qyyssqat47ytufz3299phnvs8pzrn5veylc57ycl5wlxqgy8rq82xgth9yhwk23qnu0f5mtv39fvjc82m2clcr8r4ja8vz7ytk8856ghzhgjcqj0f0g6"
        }
    },
    "chainFee": 8222,
    "serviceFee": 25822,
    "baseFee": 25000,
    "orderType": "bulk",
    "createdAt": {
        ".sv": "timestamp"
    }
}
*/


// see https://developers.opennode.com/reference/create-charge
// see https://developers.opennode.com/docs/charge-lifecycle

export interface OrderResponse {
  fee: number;   // choosen fee rate in sats/byte
  charge: {

    id: string;      // save this to poll against https://api2.ordinalsbot.com/order?id=XXX

    status: ChargeStatus;
    amount: number;  // amount to pay in satoshis
    hosted_checkout_url: string;

    chain_invoice: {
      address: string // Pay on chain BTC address
    },

    lightning_invoice: {
      "expires_at": number,
      payreq: string
    },
    fiat_value: number; // amount in USD
    ttl: number; // TTL (time to live) in minutes. Min: 10, Max: 1440 (24H), Default: 1440
  }
}

// https://api2.ordinalsbot.com/search?text=haushoppe.art
