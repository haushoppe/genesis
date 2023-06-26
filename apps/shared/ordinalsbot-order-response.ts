import { ChargeStatus } from './ordinalsbot-charge-status'


/*
RESPONSE of POST https://api2.ordinalsbot.com/order
AND
RESPONSE of GET https://api2.ordinalsbot.com/order?id=da418953-225b-4cba-99f9-1c5f826704b0
*/

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

export const examplePaidResponse = {
  "baseFee": 15546,
  "chainFee": 26355,
  "charge": {
      "address": "3QQom6T5HdtM2PRU95VHAGAPoBppiB8huN",
      "amount": 43745,
      "auto_settle": false,
      "callback_url": "",
      "chain_invoice": {
          "address": "3QQom6T5HdtM2PRU95VHAGAPoBppiB8huN"
      },
      "created_at": 1687524553,
      "currency": "BTC",
      "desc_hash": false,
      "description": "ordinalsbot order",
      "fiat_value": 12.09,
      "hosted_checkout_url": "https://checkout.opennode.com/baab1eb7-f814-4164-9004-0a5bf6b11c61",
      "id": "baab1eb7-f814-4164-9004-0a5bf6b11c61",
      "lightning_invoice": {
          "expires_at": 1687783752,
          "payreq": "lnbc437450n1pjft9xgpp56ajmeymq4uw0u29w42d2pak4ynssesv4zjuur67k7g8esell88psdqudaexg6twv9k8xcn0wssx7unyv4eqcqzzsxqy8ayqsp5hywa77xw7gwvwvnsv04q3mcrpkmup6xdxq97wvl4k0al6f08qa0q9qyyssq8mnf53lur2ljljf9f3kzd4yg7fggw72u8rkxxp0e2r0e8cvsmz0zn4apq268yuvln90h6qf4f409pc36wxksz0uz5qzg5280u54nrhcqgdxdje"
      },
      "source_fiat_value": 43745,
      "status": "unpaid",
      "ttl": 4320,
      "uri": "bitcoin:3QQom6T5HdtM2PRU95VHAGAPoBppiB8huN?amount=0.00043745&label=ordinalsbot+order&lightning=lnbc437450n1pjft9xgpp56ajmeymq4uw0u29w42d2pak4ynssesv4zjuur67k7g8esell88psdqudaexg6twv9k8xcn0wssx7unyv4eqcqzzsxqy8ayqsp5hywa77xw7gwvwvnsv04q3mcrpkmup6xdxq97wvl4k0al6f08qa0q9qyyssq8mnf53lur2ljljf9f3kzd4yg7fggw72u8rkxxp0e2r0e8cvsmz0zn4apq268yuvln90h6qf4f409pc36wxksz0uz5qzg5280u54nrhcqgdxdje"
  },
  "createdAt": 1687524552819,
  "fee": "60",
  "files": [
      {
          "completed": true,
          "dataURL": "data:text/html;base64,PGh0bWw+PCEtLWN1YmVzLmhhdXNob3BwZS5hcnQtLT48Ym9keT48c2NyaXB0PnQ9J2FiMmY0ZTlkY2UwNTgzMjY0MDc4NDI4YTkxYWE5MDM3ZGEwZTc1ZjkwZGM3N2ZlM2NiYTdjZjUzMjBhZDAwM2RpMHxkZGE3NDcwYjZkNWJiZWVhNjU2MGExNjdmNTZhMDQ4YWEyOWNlNzFmNTdlZGM3YjcxY2Y1ZGYzNjVkZGJkZGFlaTB8ZGRhNzQ3MGI2ZDViYmVlYTY1NjBhMTY3ZjU2YTA0OGFhMjljZTcxZjU3ZWRjN2I3MWNmNWRmMzY1ZGRiZGRhZWkwfGRkYTc0NzBiNmQ1YmJlZWE2NTYwYTE2N2Y1NmEwNDhhYTI5Y2U3MWY1N2VkYzdiNzFjZjVkZjM2NWRkYmRkYWVpMHxkZGE3NDcwYjZkNWJiZWVhNjU2MGExNjdmNTZhMDQ4YWEyOWNlNzFmNTdlZGM3YjcxY2Y1ZGYzNjVkZGJkZGFlaTB8ZGRhNzQ3MGI2ZDViYmVlYTY1NjBhMTY3ZjU2YTA0OGFhMjljZTcxZjU3ZWRjN2I3MWNmNWRmMzY1ZGRiZGRhZWkwJzwvc2NyaXB0PjxzY3JpcHQgc3JjPS9jb250ZW50Lzk0NzVhYThkZjU1OWQ1NjlmNzI4NGNlNTllOTcwMTRmMjhiZTc1OGU4MzJlMjEyZmRiYmEwMjAyNjk5ZGQwMzVpMD48L3NjcmlwdD4=",
          "iqueued": true,
          "iqueuedAt": 1687526256069,
          "name": "cube1.html",
          "processing": false,
          "sent": "f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451f",
          "size": 557,
          "tx": {
              "commit": "f7cd6426a3636cc1a36e0b4926e36a69508bfca74ad26c7e29e500e7493934b8",
              "fees": 25920,
              "inscription": "f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451fi0",
              "reveal": "f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451f"
          },
          "type": "text/html",
          "url": "",
          "vm": 1
      }
  ],
  "inscribedCount": 1,
  "lowPostage": true,
  "orderType": "bulk",
  "paid": true,
  "paidAt": 1687526255442,
  "processing": true,
  "rareSats": "random",
  "receiveAddress": "???",
  "referral": "your-referral-code",
  "serviceFee": 17390,
  "status": "ok"
}



// see https://developers.opennode.com/reference/create-charge
// see https://developers.opennode.com/docs/charge-lifecycle

export interface InscriptionFile {
  completed?: boolean;
  sent?: string;
  tx?: {
    commit: string;
    fees: number;
    inscription: string;
    reveal: string;
  }
}

export interface OrderResponse {
  // fee: number | string;   // choosen fee rate in sats/byte
  charge: {

    id: string;      // save this to poll against https://api2.ordinalsbot.com/order?id=XXX

    // status: ChargeStatus; // IS ALWAYS "UNPAID!!! :-()
    amount: number;  // amount to pay in satoshis
    hosted_checkout_url: string;

    chain_invoice: {
      address: string // Pay on chain BTC address
    };

    lightning_invoice: {
      "expires_at": number;
      payreq: string;
    };
    fiat_value: number; // amount in USD
    // ttl: number; // TTL (time to live) in minutes. Min: 10, Max: 1440 (24H), Default: 1440
  },
  files: InscriptionFile[];
  referral: string;
}

export interface InscriptionOrder {
  id: string;      // save this to poll against https://api2.ordinalsbot.com/order?id=XXX
  // fee: number | string;   // choosen fee rate in sats/byte
  charge: {

    // status: ChargeStatus; // IS ALWAYS "UNPAID!!! :-()
    amount: number;  // amount to pay in satoshis
    hosted_checkout_url: string;

    chain_invoice: {
      address: string // Pay on chain BTC address
    },

    lightning_invoice: {
      "expires_at": number;
      payreq: string;
    },
    fiat_value: number; // amount in USD
    // ttl: number; // TTL (time to live) in minutes. Min: 10, Max: 1440 (24H), Default: 1440
  },
  files: InscriptionFile[];
  code?: string;
}

