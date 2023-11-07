import { ReferralCode, REFERRALS } from '../../../../../shared/ordinals/referral-code';
import { validateReferralCode } from './validate-referral-code';

describe('validateReferralCode', () => {
    it('returns the correct referral for a valid code', () => {
        const testCases: ReferralCode[] = [
            REFERRALS[0],
            REFERRALS[1],
            REFERRALS[2]
        ];

        testCases.forEach(testCase => {
            expect(validateReferralCode(testCase.code)).toEqual(testCase);
        });
    });

    it('returns the default referral for an invalid code', () => {
        expect(validateReferralCode('INVALID_CODE')).toEqual(REFERRALS[0]);
    });

    it('returns the default referral for a falsy value', () => {
        expect(validateReferralCode('')).toEqual(REFERRALS[0]);
        expect(validateReferralCode(null)).toEqual(REFERRALS[0]);
        expect(validateReferralCode(undefined)).toEqual(REFERRALS[0]);
    });
});
