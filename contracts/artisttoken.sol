// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/**
 * @title Artist token contract
 * @author Ethspresso (https://twitter.com/ethspresso)
 * @notice This contract handles minting and loaning of artist tokens.
 */
contract ArtistToken is ERC721A, ReentrancyGuard, Ownable, Pausable {
    event Loan(address indexed _from, address indexed to, uint _value);
    event LoanRetrieved(address indexed _from, address indexed to, uint value);

    using ECDSA for bytes32;
    using Strings for uint256;

    string private _baseTokenURI;
    // Price is not used and not checked in mint function
    uint256 public price = 0 ether;
    uint256 public maxSupply;
    uint256 public maxMintPerAddress = 1;

    // Used to validate authorized mint addresses
    address private signerAddress = 0x5eEEFC29B93D14697d93bD115F0191aB161bD098;

    // Used to track number of mints per wallet
    mapping (address => uint256) public totalMintsPerAddress;

    // Lending overview
    mapping (address => uint256) public totalLoanedPerAddress;
    mapping (uint256 => address) public tokenOwnersOnLoan;
    uint256 private currentLoanIndex = 0;

    // State variables
    bool public isSaleActive = false;
    bool public isLendingActive = false;

    /**
     * @notice Construct a contract instance with predefined name and symbol
     */
    constructor() ERC721A("Artist Token", "ARTIST") {}

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
        require(maxSupply != newMaxSupply, "New value must be different from current value");
        require(newMaxSupply >= totalSupply(), "New max supply must be equal or higher than total minted tokens");
        maxSupply = newMaxSupply;
    }

    /**
     * @notice Let contract owner update the mint price
     */
    function setMintPrice(uint256 newMintPrice) public onlyOwner {
        require(price != newMintPrice, "New value must be different from current value");
        price = newMintPrice;
    }

    /**
     * @notice Allow contract owner to enable mint
     */
    function enableSale() public onlyOwner {
        require(isSaleActive == false, "Sale is already enabled");
        isSaleActive = true;
    }

    /**
     * @notice Allow contract owner to disable mint
     */
    function disableSale() public onlyOwner {
        require(isSaleActive == true, "Sale is already disabled");
        isSaleActive = false;
    }

    /**
     * @notice Allow contract owner to update the authorized signer address
     */
    function setSignerAddress(address _signerAddress) external onlyOwner {
        require(_signerAddress != address(0));
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

        require(tokenOwnersOnLoan[tokenId] == address(0), "Cannot transfer token on loan");
    }

    function verifyAddressSigner(bytes32 messageHash, bytes memory signature) private view returns (bool) {
        return signerAddress == messageHash.toEthSignedMessageHash().recover(signature);
    }

    function hashMessage(address sender, uint256 maximumAllowedMints) private pure returns (bytes32) {
        return keccak256(abi.encode(sender, maximumAllowedMints));
    }

    /**
     * @notice Mint tokens, one at a time
     */
    function mint() external payable virtual nonReentrant {
        require(isSaleActive, "Mint is disabled");
        require(totalMintsPerAddress[msg.sender] + 1 <= maxMintPerAddress, "Already minted maximum number of tokens");

        uint256 currentSupply = totalSupply();
        require(currentSupply + 1 <= maxSupply, "Max supply exceeded");

        totalMintsPerAddress[msg.sender] += 1;
        _safeMint(msg.sender, 1);

        if (currentSupply + 1 >= maxSupply) {
            isSaleActive = false;
        }
    }
    
    /**
     * @notice Allow owner to send 1 token for free to each of multiple addresses
     */
    function gift(address[] calldata receivers) external onlyOwner {
        require((totalSupply() + receivers.length) <= maxSupply, "Max supply exceeded");

        for (uint256 i = 0; i < receivers.length; i++) {
            totalMintsPerAddress[receivers[i]] += 1;
            _safeMint(receivers[i], 1);
        }
    }

    // ********************* //
    // Lending functionality //
    // ********************* //

    /**
     * To be updated by contract owner to allow for the loan functionality to be toggled
     */
    function enableLending() public onlyOwner {
        require(isLendingActive != true, "Lending is already enabled");
        isLendingActive = true;
    }

    /**
     * To be updated by contract owner to allow for the loan functionality to be toggled
     */
    function disableLending() public onlyOwner {
        require(isLendingActive != false, "Lending is already disabled");
        isLendingActive = false;
    }

    /**
     * @notice Allow owner to loan their tokens to other addresses
     */
    function loan(uint256 tokenId, address receiver) external nonReentrant {
        require(isLendingActive == true, "Token loans are paused");
        require(ownerOf(tokenId) == msg.sender, "Trying to loan not owned token");
        require(receiver != address(0), "ERC721: transfer to the zero address");
        require(tokenOwnersOnLoan[tokenId] == address(0), "Trying to loan a loaned token");

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
        require(borrowerAddress != msg.sender, "Trying to retrieve their owned loaned token");
        require(tokenOwnersOnLoan[tokenId] == msg.sender, "Trying to retrieve token not on loan");

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
        require(tokenOwnersOnLoan[tokenId] != address(0), "This token is not on loan");
        require(tokenOwnersOnLoan[tokenId] == owner, "Trying to return token to the wrong wallet");

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
        require(owner != address(0), "Balance query for the zero address");
        return totalLoanedPerAddress[owner];
    }

    /**
     * Get all the token ids owned by a given address
     */
    function loanedTokensByAddress(address owner) external view returns (uint256[] memory) {
        require(owner != address(0), "Balance query for the zero address");
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
}
