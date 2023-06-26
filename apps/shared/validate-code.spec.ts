import { REFERRALS, Referral, validateCode } from "./referrals";

describe('validateCode', () => {
    it('returns the correct referral for a valid code', () => {
        const testCases: Referral[] = [
            REFERRALS[0],
            REFERRALS[1],
            REFERRALS[2]
        ];

        testCases.forEach(testCase => {
            expect(validateCode(testCase.code)).toEqual(testCase);
        });
    });

    it('returns the default referral for an invalid code', () => {
        expect(validateCode('INVALID_CODE')).toEqual(REFERRALS[0]);
    });

    it('returns the default referral for a falsy value', () => {
        expect(validateCode('')).toEqual(REFERRALS[0]);
        expect(validateCode(null)).toEqual(REFERRALS[0]);
        expect(validateCode(undefined)).toEqual(REFERRALS[0]);
    });
});
