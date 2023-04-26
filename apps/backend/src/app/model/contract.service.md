# MINT EXAMPLE (ethers v6 with support for BigInt)

This is how a mint looks like:

```js
EventLog {
  provider: JsonRpcProvider {},
  transactionHash: '0xf245bc6b75cce5a45a4743aeac632c9c244e535091f7bbf50bdb1d27620c5fc9',
  blockHash: '0xf26787235b4356a823aa835493594bcae1758bff11083d023a1c0df57ba64f64',
  blockNumber: 10,
  removed: false,
  address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  data: '0x',
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    '0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  ],
  index: 0,
  transactionIndex: 0,
  interface: Interface {
    fragments: [Array],
    deploy: [ConstructorFragment],
    fallback: null,
    receive: false
  },
  fragment: EventFragment {
    type: 'event',
    inputs: [Array],
    name: 'Transfer',
    anonymous: false
  },
  args: Result(3) [
    '0x0000000000000000000000000000000000000000',
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    0n
  ]
}
```
