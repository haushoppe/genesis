export interface ReferralCode {
  code: string,
  bonus: number,
  address: string
}

// first code is always the default!
export const REFERRALS: ReferralCode[] = [
  {
    code: 'HAUS_HOPPE_CUBE_20000',
    bonus: 20000,
    address: '???'
  },
  {
    code: 'HAUS_HOPPE_CUBE_35000',
    bonus: 35000,
    address: '???'
  },
  {
    code: 'HAUS_HOPPE_CUBE_ZENECA_0',
    bonus: 0,
    address: '???'
  },
  {
    code: 'HAUS_HOPPE_CUBE_ANGELS_0',
    bonus: 0,
    address: '???'
  }
];


// More codes:

// https://api.ordinalsbot.com/referrals?referral=???&address=???



// Check balances:

// https://www.blockchain.com/explorer/addresses/btc/???
// https://www.blockchain.com/explorer/addresses/btc/???
// https://www.blockchain.com/explorer/addresses/btc/???
