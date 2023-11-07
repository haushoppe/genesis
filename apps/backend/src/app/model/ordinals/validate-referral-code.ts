import { REFERRALS, ReferralCode } from "../../../../../shared/ordinals/referral-code";

/**
 * Validates the provided referral code.
 * @param {string} code - The referral code.
 * @returns {ReferralCode} - The referral corresponding to the provided code,
 * or the default referral if the provided code does not correspond to any referral.
 */
export function validateReferralCode(code: string): ReferralCode {
  const referral = REFERRALS.find(ref => ref.code === code);
  return referral ? referral : REFERRALS[0];  // default is the first entry
}
