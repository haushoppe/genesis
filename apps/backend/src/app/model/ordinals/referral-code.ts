export interface ReferralCode {
  code: string,
  bonus: number,
  address: string
}

export const REFERRALS: ReferralCode[] = [
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
  },
];
