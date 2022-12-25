// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
// not used??
// import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// not used??
// import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/**
 * @title Artist token contract
 * @author Ethspresso and Johannes
 * @notice This contract handles minting and loaning of artist tokens. It allows artists to agree to our terms and conditions on-chain.
 * Visit https://cube.haushoppe.art for more information
 */
contract ArtistToken is ERC721A, ReentrancyGuard, Ownable, Pausable {
    event Loan(address indexed _from, address indexed to, uint _value);
    event LoanRetrieved(address indexed _from, address indexed to, uint value);
    event Agreement(address indexed _from, bool _value);

    using ECDSA for bytes32;
    using Strings for uint256;

    string private _baseTokenURI;
    uint256 public price = 0 ether;
    uint256 public maxSupply = 10000;

    // Used to validate authorized mint addresses
    // zero address enables/disables minting via allowlist
    address private signerAddress = 0x0000000000000000000000000000000000000000;

    // Used to track number of mints per wallet
    mapping (address => uint256) public totalMintsPerAddress;

    // Lending overview
    mapping (address => uint256) public totalLoanedPerAddress;
    mapping (uint256 => address) public tokenOwnersOnLoan;
    uint256 private currentLoanIndex = 0;

    // Agreements to our terms and conditions
    // Please review them here: https://cube.haushoppe.art/toc
    mapping (address => bool) public agreements;

    // State variables
    bool public isSaleActive = false;
    bool public isLendingActive = false;

    /**
     * @notice Construct a contract instance with predefined name and symbol
     */
    constructor() ERC721A("Artist Token for Collectors Cube", "ARTIST") {}

    /**
     * @dev Used by ERC721A.tokenURI to return the full Uniform Resource Identifier (URI) for a token.
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Let contract owner update base URI for metadata
     * @param baseURI The URI to use as base URI for metadata
     */
    function setBaseURI(string calldata baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Let contract owner update the max supply
     * @param newMaxSupply New max supply available for minting
     */
    function setMaxSupply(uint256 newMaxSupply) public onlyOwner {
        // New value must be different from current value
        require(maxSupply != newMaxSupply, "Same value");
        // New max supply must be equal or higher than total minted tokens
        require(newMaxSupply >= totalSupply(), "Supply too small");
        maxSupply = newMaxSupply;
    }

    /**
     * @notice Let contract owner update the mint price
     */
    function setMintPrice(uint256 newMintPrice) public onlyOwner {
        // New value must be different from current value
        require(price != newMintPrice, "Same value");
        price = newMintPrice;
    }

    /**
     * @notice Allows contract owner to enable/disable minting
     */
    function setSaleStatus(bool status) public onlyOwner {
        isSaleActive = status;
    }

    /**
     * @notice Allow contract owner to update the authorized signer address
     */
    function setSignerAddress(address _signerAddress) external onlyOwner {
        signerAddress = _signerAddress;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
    
    /**
     * When the contract is paused, all token transfers are prevented in case of emergency.
     */
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 tokenId,
        uint256 quantity
    ) internal whenNotPaused override(ERC721A) {
        super._beforeTokenTransfers(from, to, tokenId, quantity);

        // Cannot transfer token on loan
        require(tokenOwnersOnLoan[tokenId] == address(0), "Token on loan");
    }

    /**
     * An empty balance also means that the former owner no longer gives his consent.
     */
    function _afterTokenTransfers(
        address from,
        address to,
        uint256 tokenId,
        uint256 quantity
    ) internal override(ERC721A) {
        super._afterTokenTransfers(from, to, tokenId, quantity);

        // also called while minting, so we have to check for the zero address, too
        if (from != address(0) && 
            balanceOf(from) == 0 && 
            agreements[from] == true) {

            delete agreements[from];
            emit Agreement(from, false);
        }
    }

    function verifyAddressSigner(bytes32 messageHash, bytes memory signature) private view returns (bool) {
        return signerAddress == messageHash.toEthSignedMessageHash().recover(signature);
    }

    function hashMessage(address sender, uint256 maximumAllowedMints) private pure returns (bytes32) {
        return keccak256(abi.encode(sender, maximumAllowedMints));
    }

    /**
     * @notice Mint tokens, batch mint possible - use this function if minting via allowlist is disabled
     * Minting also means you agree to our terms and conditions. Please review them here: https://cube.haushoppe.art/toc
     */
    function mint(
        uint256 mintNumber
    ) external payable virtual nonReentrant {
        // Minting is disabled
        require(isSaleActive, "Mint disabled");
        // Minting via allowlist is enabled. Please use the function mintAllowlist!
        require(signerAddress == address(0), "Use mintAllowlist");

        uint256 currentSupply = totalSupply();
        require(currentSupply + mintNumber <= maxSupply, "Max supply exceeded");

        totalMintsPerAddress[msg.sender] += mintNumber;
        _safeMint(msg.sender, mintNumber);

        if (currentSupply + mintNumber >= maxSupply) {
            isSaleActive = false;
        }

        // minting also means the minter agrees to our TOC
        if (agreements[msg.sender] == false) {
            agreements[msg.sender] = true;
            
            // extra gast costs should be acceptable
            // without: execution cost 152104 gas == 2.6016 USD (if ETH is at 1221.74 USD)
            // with: execution cost 153681 gas == 2.6286 USD (if ETH is at 1221.74 USD)
            // according to https://www.cryptoneur.xyz/gas-fees-calculator
            emit Agreement(msg.sender, true);
        }
    }

    /**
     * @notice Allow for minting of tokens up to the maximum allowed for a given address.
     * The address of the sender and the number of mints allowed are hashed and signed
     * with the server's private key and verified here to prove allowlist status.
     * Minting also means you agree to our terms and conditions. Please review them here: https://cube.haushoppe.art/toc
     */
    function mintAllowlist(
        bytes32 messageHash,
        bytes calldata signature,
        uint256 mintNumber,
        uint256 maximumAllowedMints
    ) external payable virtual nonReentrant {
        // Minting is disabled
        require(isSaleActive, "Mint disabled");
        // Minting via allowlist is disabled. Please use the function mint!
        require(signerAddress != address(0), "Use mint");
        // Maximum allowed mints exceeded"
        require(totalMintsPerAddress[msg.sender] + mintNumber <= maximumAllowedMints, "Max mints exceeded");
        require(hashMessage(msg.sender, maximumAllowedMints) == messageHash, "Message invalid");
        // Signature validation failed
        require(verifyAddressSigner(messageHash, signature), "Validation failed");

        uint256 currentSupply = totalSupply();
        require(currentSupply + mintNumber <= maxSupply, "Max supply exceeded");

        totalMintsPerAddress[msg.sender] += mintNumber;
        _safeMint(msg.sender, mintNumber);

        if (currentSupply + mintNumber >= maxSupply) {
            isSaleActive = false;
        }
        
        // minting also means the minter agrees to our TOC
        if (agreements[msg.sender] == false) {
            agreements[msg.sender] = true;
            // extra gast costs should be acceptable
            emit Agreement(msg.sender, true);
        }
    }
    
    /**
     * @notice Allow owner to send `mintNumber` tokens without cost to multiple addresses
     */
    function gift(address[] calldata receivers, uint256 mintNumber) external onlyOwner {
        require((totalSupply() + receivers.length * mintNumber) <= maxSupply, "Max supply exceeded");

        for (uint256 i = 0; i < receivers.length; i++) {
            totalMintsPerAddress[receivers[i]] += mintNumber;
            _safeMint(receivers[i], mintNumber);
        }
    }

    // ********************* //
    // Lending functionality //
    // ********************* //

    /**
     * @notice Allows contract owner to enable/disable loan functionality
     */
    function setLendingStatus(bool status) public onlyOwner {
        isLendingActive = status;
    }

    /**
     * @notice Allow owner to loan their tokens to other addresses
     */
    function loan(uint256 tokenId, address receiver) external nonReentrant {
        // Token loans are paused
        require(isLendingActive == true, "Loans paused");
        // Trying to loan not owned token
        require(ownerOf(tokenId) == msg.sender, "Not owned");
        // ERC721: transfer to the zero address
        require(receiver != address(0), "Transfer to 0x0");
        // Trying to loan a loaned token
        require(tokenOwnersOnLoan[tokenId] == address(0), "Loan a loaned token");

        // Transfer the token
        safeTransferFrom(msg.sender, receiver, tokenId);

        // Add it to the mapping of originally loaned tokens
        tokenOwnersOnLoan[tokenId] = msg.sender;

        // Add to the owner's loan balance
        uint256 loansByAddress = totalLoanedPerAddress[msg.sender];
        totalLoanedPerAddress[msg.sender] = loansByAddress + 1;
        currentLoanIndex = currentLoanIndex + 1;

        emit Loan(msg.sender, receiver, tokenId);
    }

    /**
     * @notice Allow owner to retrieve loaned tokens from borrower
     */
    function retrieveLoan(uint256 tokenId) external nonReentrant {
        address borrowerAddress = ownerOf(tokenId);
        // Trying to retrieve their owned loaned token
        require(borrowerAddress != msg.sender, "Retrieve owned loaned token");
        // Trying to retrieve token not on loan
        require(tokenOwnersOnLoan[tokenId] == msg.sender, "Not on loan");

        // Remove it from the array of loaned out tokens
        delete tokenOwnersOnLoan[tokenId];

        // Subtract from the owner's loan balance
        uint256 loansByAddress = totalLoanedPerAddress[msg.sender];
        totalLoanedPerAddress[msg.sender] = loansByAddress - 1;
        currentLoanIndex = currentLoanIndex - 1;
        
        // Transfer the token back
        safeTransferFrom(borrowerAddress, msg.sender, tokenId);

        emit LoanRetrieved(borrowerAddress, msg.sender, tokenId);
    }

    /**
     * @notice Allow admin to return a loaned token to owner
     */
    function retrieveLoanAdmin(uint256 tokenId, address owner) external nonReentrant onlyOwner {
        address borrowerAddress = ownerOf(tokenId);
        // This token is not on loan
        require(tokenOwnersOnLoan[tokenId] != address(0), "Not on loan");
        // Trying to return token to the wrong wallet
        require(tokenOwnersOnLoan[tokenId] == owner, "Wrong wallet");

        // Remove it from the array of loaned out tokens
        delete tokenOwnersOnLoan[tokenId];

        // Subtract from the owner's loan balance
        uint256 loansByAddress = totalLoanedPerAddress[owner];
        totalLoanedPerAddress[owner] = loansByAddress - 1;
        currentLoanIndex = currentLoanIndex - 1;
        
        // Transfer the token back
        safeTransferFrom(borrowerAddress, owner, tokenId);

        emit LoanRetrieved(borrowerAddress, owner, tokenId);
    }

    /**
     * Returns the total number of loaned tokens
     */
    function totalLoaned() public view returns (uint256) {
        return currentLoanIndex;
    }

    /**
     * Returns the loaned balance of an address
     */
    function loanedBalanceOf(address owner) public view returns (uint256) {
        // Balance query for the zero address
        require(owner != address(0), "Balance query for 0x0");
        return totalLoanedPerAddress[owner];
    }

    /**
     * Returns all the token ids owned by a given address
     */
    function loanedTokensByAddress(address owner) external view returns (uint256[] memory) {
        // Balance query for the zero address
        require(owner != address(0), "Balance query for 0x0");
        uint256 totalTokensLoaned = loanedBalanceOf(owner);
        uint256 mintedSoFar = totalSupply();
        uint256 tokenIdsIdx = 0;

        uint256[] memory allTokenIds = new uint256[](totalTokensLoaned);
        for (uint256 i = 0; i < mintedSoFar && tokenIdsIdx != totalTokensLoaned; i++) {
            if (tokenOwnersOnLoan[i] == owner) {
                allTokenIds[tokenIdsIdx] = i;
                tokenIdsIdx++;
            }
        }

        return allTokenIds;
    }

    /**
     * @notice Allow contract owner to withdraw funds to its own account.
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // ******************** //
    // Terms and Conditions //
    // ******************** //

    /**
     * @notice Call this function to agree to our terms and conditions. Please review them here: https://cube.haushoppe.art/toc
     */
    function iAgreeToTheTermsAndConditions() external {
        // You already agreed to our terms and conditions!
        require(agreements[msg.sender] == false, "Already agreed");
        // You can only agree to our terms and conditions if you hold a token!
        require(balanceOf(msg.sender) > 0, "Not holder of token");

        agreements[msg.sender] = true;
        emit Agreement(msg.sender, true);
    }

    /**
     * @notice Call this function to revoke your agreement to our terms and conditions.
     */
    function iDoNotAgreeToTheTermsAndConditions() external {
        // You have no agreement that could be revoked. 
        require(agreements[msg.sender] == true, "No agreement");

        delete agreements[msg.sender];
        emit Agreement(msg.sender, false);
    }

    // Contract code size exceeds 24576 byte
    // /**
    //  * Returns the agreement status of an address
    //  */
    // function agreementsStatus(address addr) public view returns (bool) {
    //     // Query for the zero address
    //     require(addr != address(0), "Query for 0x0");
    //     return agreements[addr];
    // }

    // ******************** //
    // Change name / symbol //
    // ******************** //

    function _setStringAtStorageSlot(string memory value, uint256 storageSlot) private {
        assembly {
            let stringLength := mload(value)

            switch gt(stringLength, 0x1F)
            case 0 {
                sstore(storageSlot, or(mload(add(value, 0x20)), mul(stringLength, 2)))
            }
            default {
                sstore(storageSlot, add(mul(stringLength, 2), 1))
                mstore(0x00, storageSlot)
                let dataSlot := keccak256(0x00, 0x20)
                for { let i := 0 } lt(mul(i, 0x20), stringLength) { i := add(i, 0x01) } {
                    sstore(add(dataSlot, i), mload(add(value, mul(add(i, 1), 0x20))))
                }
            }
        }
    }

    /**
     * @notice Change token name
     */
    function setName(string memory value) external onlyOwner {
        _setStringAtStorageSlot(value, 2);
    }

    /**
     * @notice Change token symbol
     */
    function setSymbol(string memory value) external onlyOwner {
        _setStringAtStorageSlot(value, 3);
    }
}
