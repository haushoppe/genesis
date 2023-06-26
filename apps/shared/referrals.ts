export interface Referral {
  code: string,
  bonus: number,
  address: string
}

export const REFERRALS: Referral[] = [
  {
      code: 'HAUS_HOPPE_CUBE_35000',
      bonus: 3500,
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

export function validateCode(code: string | null | undefined): Referral {
  const referral = REFERRALS.find(ref => ref.code === code);
  return referral ? referral : REFERRALS[0];  // default is the first entry
}
