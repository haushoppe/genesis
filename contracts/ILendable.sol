// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @dev Interface for Lending NFTs.
 *
 * A (un)standardized way to lend non-fungible tokens (NFTs) to other parties.
 * The has to keep the original owner of a token on  a mapping from uint256
 * to an address called tokenOwnersOnLoan, which guarantees later retrieval.
 * This also blocks any transferring or selling of the token while it is on
 * loan, as only the original owner can authorize transactions. 
 *
 * This is all part of the smart contract for the Meta Angels Collection:
 * https://etherscan.io/address/0xaD265Ab9B99296364F13Ce5b8B3e8d0998778bfb
 *
 * According to their website, they "encourage other projects to integrate
 * the code to help promote access and inclusion in the space".
 * This is what we did with this interface!
 * source: https://www.metaangelsnft.com/benefits/lending
 *
 * The following functions are not identical to the original Meta Angels contract:
 * REMOVED: `loanedBalanceOf` (just use `totalLoanedPerAddress`)
 * RENAMED: `isLendingActive`  (previously `loansPaused`, negated!)
 * NEW: `retrieveLoanByAdmin`
 */
interface ILendable is IERC165 {

    /**
     * @notice Allow owner to loan their tokens to other addresses
     */
    function loan(uint256 tokenId, address receiver) external;

    /**
     * @notice Allow original owner to retrieve loaned tokens from borrower
     */
    function retrieveLoan(uint256 tokenId) external;

    /**
     * @notice Allow admin (usually the contract owner) to return a loaned token to the original owner
     */
    function retrieveLoanByAdmin(uint256 tokenId) external;

    /**
     * Returns true if tokens are currently allowed to be lent, otherwise false.
     */
    function isLendingActive() external view returns (bool);

    /**
     * Returns the amount of tokens an owner has loaned
     */
    function totalLoanedPerAddress(address owner) external view returns (uint256);

    /**
     * Returns the original owner of a token
     */
    function tokenOwnersOnLoan(uint256 tokenId) external view returns (address);

    /**
     * Returns the total number of loaned tokens
     */
    function totalLoaned() external view returns (uint256);

    /**
     * Returns all the token ids owned by a given address
     */
    function loanedTokensByAddress(address owner) external view returns (uint256[] memory);
}
