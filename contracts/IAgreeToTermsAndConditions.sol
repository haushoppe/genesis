// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "ITermsAndConditions.sol";

/**
 * @dev Interface to explicitly agree to the terms and conditions.
 *
 * This allows the holder of a token to explicitly confirm that they agree
 * to the terms and conditions. This can be used, for example, to activate
 * additional features.
 *
 * Rules:
 * 1. The minting of a token may be interpreted as an agreement.
 * 2. If a previous holder no longer owns any tokens,
 *    this should be interpreted as a revoke of the agreement.
 * 3. After a token transfer, the new owner has not given his agreement. 
 *    He/She must call the function `agreeOrDisagreeToTermsAndConditions(true)`
 *    to agree to the terms and conditions.
 */
interface IAgreeToTermsAndConditions is ITermsAndConditions {

    /**
     * @notice Call this to agree or disagree to the terms and conditions.
     * @param agreement true: token holder agrees to the terms and conditions | true: token holder does not agree to the terms and conditions
     */
    function agreeOrDisagreeToTermsAndConditions(bool agreement) external;

    /**
     * Returns all agreements to the terms and conditions
     */
    function agreements(address holder) external view returns (bool);
}
