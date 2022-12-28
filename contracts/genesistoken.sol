// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "erc721a-for-lendable/ERC721AForLendable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "ILendable.sol";
import "ITermsAndConditions.sol";
import "IAgreeToTermsAndConditions.sol";

/**
 * @title Genesis token contract
 * @author Johannes from HAUS HOPPE
 * @notice This contract handles minting and loaning of genesis tokens.
 */
contract GenesisToken is ERC721AForLendable, ReentrancyGuard, Ownable, Pausable, ERC2981, ILendable, ITermsAndConditions {
    event Loan(address indexed _from, address indexed to, uint _value);
    event LoanRetrieved(address indexed _from, address indexed to, uint value);

    using ECDSA for bytes32;
    using Strings for uint256;

    string private _baseTokenURI;
    string private _baseTokenURIForMosaic;
    uint256 public price = 0 ether;
    uint256 public maxSupply = 10000;

    // Review our terms and conditions at the following URI
    string public termsAndConditionsURI;

    // Used to validate authorized mint addresses
    // zero address enables/disables minting via allowlist
    address private signerAddress = 0x0000000000000000000000000000000000000000;

    // Used to track number of mints per wallet
    mapping (address => uint256) public totalMintsPerAddress;

    // Lending overview
    mapping (address => uint256) public totalLoanedPerAddress;
    mapping (uint256 => address) public tokenOwnersOnLoan;
    uint256 private currentLoanIndex = 0;

    // State variables
    bool public isSaleActive = false;
    bool public isLendingActive = false;

    // Changeable token name and symbol
    string private _changeableName = "Genesis by HAUS HOPPE";
    string private _changeableSymbol = "GENESIS";

    // Mosaic logic

    // all tokens that are special mosaic token
    mapping (uint256 => bool) public tokenIsMosaic;
    
    // mosaicTokenId to 1st/2nd/3rd/4th tile
    mapping (uint256 => uint256) public tile1;
    mapping (uint256 => uint256) public tile2;
    mapping (uint256 => uint256) public tile3;
    mapping (uint256 => uint256) public tile4;

    // every token can be only used once for a mosaic
    mapping (uint256 => bool) public tokenInMosaic;


    /**
     * @notice Construct a contract instance with predefined name and symbol
     */
    constructor() ERC721AForLendable(_changeableName, _changeableSymbol) {}

    /**
     * @notice Let contract owner update base URI for metadata
     * @param baseURI The URI to use as base URI for metadata
     */
    function setBaseURI(string calldata baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }

    /**
     * @notice Let contract owner update base URI for metadata for the mosaic tokens
     * @param baseURI The URI to use as base URI for metadata
     */
    function setBaseURIForMosaic(string calldata baseURI) public onlyOwner {
        _baseTokenURIForMosaic = baseURI;
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
     * @notice Allow contract owner to enable/disable minting
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
    ) internal whenNotPaused override(ERC721AForLendable) {
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
     * @notice Mint tokens, batch mint possible. Minting also means you agree to our terms and conditions. Please review them at `termsAndConditions`!
     */
    function mint(
        uint256 mintNumber
    ) external payable virtual nonReentrant {
        require(isSaleActive, "Minting is disabled");
        require(signerAddress == address(0), "Minting via allowlist is enabled. Please use the function mintAllowlist!");

        uint256 currentSupply = totalSupply();
        require(currentSupply + mintNumber <= maxSupply, "Max supply exceeded");

        totalMintsPerAddress[msg.sender] += mintNumber;
        _safeMint(msg.sender, mintNumber);

        if (currentSupply + mintNumber >= maxSupply) {
            isSaleActive = false;
        }
    }

    /**
     * @notice Allow for minting of tokens up to the maximum allowed for a given address. Minting also means you agree to our terms and conditions. Please review them at `termsAndConditions`!
     * The address of the sender and the number of mints allowed are hashed and signed
     * with the server's private key and verified here to prove allowlist status.
     */
    function mintAllowlist(
        bytes32 messageHash,
        bytes calldata signature,
        uint256 mintNumber,
        uint256 maximumAllowedMints
    ) external payable virtual nonReentrant {
        require(isSaleActive, "Minting is disabled");
        require(signerAddress != address(0), "Minting via allowlist is disabled. Please use the function mint!");
        require(totalMintsPerAddress[msg.sender] + mintNumber <= maximumAllowedMints, "Maximum allowed mints exceeded");
        require(hashMessage(msg.sender, maximumAllowedMints) == messageHash, "Message invalid");
        require(verifyAddressSigner(messageHash, signature), "Signature validation failed");

        uint256 currentSupply = totalSupply();
        require(currentSupply + mintNumber <= maxSupply, "Max supply exceeded");

        totalMintsPerAddress[msg.sender] += mintNumber;
        _safeMint(msg.sender, mintNumber);

        if (currentSupply + mintNumber >= maxSupply) {
            isSaleActive = false;
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

    /**
     * @notice Allow the owner of 4 tokens to mint a free special token called "mosaic"
     */
    function mintMosaic(uint256 tokenId1, uint256 tokenId2, uint256 tokenId3, uint256 tokenId4) external nonReentrant {
        require(isSaleActive, "Minting is disabled");

        require(ownerOf(tokenId1) == msg.sender, "You must be the owner of the first token!");
        require(ownerOf(tokenId2) == msg.sender, "You must be the owner of the second token!");
        require(ownerOf(tokenId3) == msg.sender, "You must be the owner of the third token!");
        require(ownerOf(tokenId4) == msg.sender, "You must be the owner of the fourth token!");

        require(tokenInMosaic[tokenId1] == false, "The first token is already part of a mosaic!");
        require(tokenInMosaic[tokenId2] == false, "The second token is already part of a mosaic!");
        require(tokenInMosaic[tokenId3] == false, "The third token is already part of a mosaic!");
        require(tokenInMosaic[tokenId4] == false, "The fourth token is already part of a mosaic!");

        uint256 currentSupply = totalSupply();
        require(currentSupply + 1 <= maxSupply, "Max supply exceeded");

        uint256 mosaicTokenId = _nextTokenId();

        // all tokens that are special mosaic token
        tokenIsMosaic[mosaicTokenId] = true;

        // every token can be only used once for a mosaic
        tokenInMosaic[tokenId1] = true;
        tokenInMosaic[tokenId2] = true;
        tokenInMosaic[tokenId3] = true;
        tokenInMosaic[tokenId4] = true;

        // with the help if these 4 mappings we will recover all tiles of the mosaic again
        tile1[mosaicTokenId] = tokenId1;
        tile2[mosaicTokenId] = tokenId2;
        tile3[mosaicTokenId] = tokenId3;
        tile4[mosaicTokenId] = tokenId4;

        totalMintsPerAddress[msg.sender] += 1;
        _safeMint(msg.sender, 1);

        if (currentSupply + 1 >= maxSupply) {
            isSaleActive = false;
        }
    }

    /**
     * @dev Returns the Uniform Resource Identifier (URI) for `tokenId` token.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();

        // normal token
        if (tokenIsMosaic[tokenId] == false) {
            
            return bytes(_baseTokenURI).length != 0 ? string(abi.encodePacked(
                _baseTokenURI, _toString(tokenId)
            )) : '';

        // mosaic token
        } else {

            uint256 tokenId1 = tile1[tokenId];
            uint256 tokenId2 = tile2[tokenId];
            uint256 tokenId3 = tile3[tokenId];
            uint256 tokenId4 = tile4[tokenId];

            return bytes(_baseTokenURIForMosaic).length != 0 ? string(abi.encodePacked(
                _baseTokenURIForMosaic, 
                _toString(tokenId), '/',
                _toString(tokenId1), '/',
                _toString(tokenId2), '/',
                _toString(tokenId3), '/',
                _toString(tokenId4)
            )) : '';
        }
    }

    // Supports the following `interfaceId`s:
    // - IERC165: 0x01ffc9a7
    // - IERC721: 0x80ac58cd
    // - IERC721Metadata: 0x5b5e139f
    // - IERC2981: 0x2a55205a
    // - ILendable: 0xcd36757f
    // - ITermsAndConditions: 0x174fe517
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721AForLendable, ERC2981, IERC165) returns (bool) {
        return 
            ERC721AForLendable.supportsInterface(interfaceId) || 
            ERC2981.supportsInterface(interfaceId) ||
            type(ILendable).interfaceId == interfaceId ||
            type(ITermsAndConditions).interfaceId == interfaceId;
    }

    // ******************** //
    // NFT Royalty Standard //
    // ******************** //

    /**
     * @notice Sets the royalty information that all ids in this contract will default to.
     */
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) public onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    /**
     * @notice Removes default royalty information.
     */
    function deleteDefaultRoyalty() public onlyOwner {
        _deleteDefaultRoyalty();
    }

    /**
     * @notice Sets the royalty information for a specific token id, overriding the global default.
     */
    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator) public onlyOwner {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    /**
     * @notice Resets royalty information for the token id back to the global default.
     */
    function resetTokenRoyalty(uint256 tokenId) public onlyOwner {
        _resetTokenRoyalty(tokenId);
    }

    // ********************* //
    // Lending functionality //
    // ********************* //

    /**
     * @notice Allow contract owner to enable/disable loan functionality
     */
    function setLendingStatus(bool status) public onlyOwner {
        isLendingActive = status;
    }

    /**
     * @notice Allow owner to loan their tokens to other addresses
     */
    function loan(uint256 tokenId, address receiver) external nonReentrant {
        require(isLendingActive, "Token loans are paused");
        require(ownerOf(tokenId) == msg.sender, "Trying to loan not owned token");
        require(receiver != address(0), "Transfer to the zero address");
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
     * @notice Allow original owner to retrieve loaned tokens from borrower
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
        _unsafeTransferFrom(borrowerAddress, msg.sender, tokenId);

        emit LoanRetrieved(borrowerAddress, msg.sender, tokenId);
    }

    /**
     * @notice Allow admin to return a loaned token to original owner
     */
    function retrieveLoanByAdmin(uint256 tokenId) external nonReentrant onlyOwner {
        address borrowerAddress = ownerOf(tokenId);
        
        require(tokenOwnersOnLoan[tokenId] != address(0), "This token is not on loan");

        address owner = tokenOwnersOnLoan[tokenId]; 

        // Remove it from the array of loaned out tokens
        delete tokenOwnersOnLoan[tokenId];

        // Subtract from the owner's loan balance
        uint256 loansByAddress = totalLoanedPerAddress[owner];
        totalLoanedPerAddress[owner] = loansByAddress - 1;
        currentLoanIndex = currentLoanIndex - 1;
        
        // Transfer the token back
        _unsafeTransferFrom(borrowerAddress, owner, tokenId);

        emit LoanRetrieved(borrowerAddress, owner, tokenId);
    }

    /**
     * Returns the total number of loaned tokens
     */
    function totalLoaned() public view returns (uint256) {
        return currentLoanIndex;
    }

    /**
     * Returns all the token ids owned by a given address
     */
    function loanedTokensByAddress(address owner) external view returns (uint256[] memory) {
        require(owner != address(0), "Balance query for the zero address");
        uint256 totalTokensLoaned = totalLoanedPerAddress[owner];
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
     * @notice Let contract owner update the URI to our terms and conditions
     * @param uri The URI to our terms and condtions
     */
    function setTermsAndConditionsURI(string calldata uri) public onlyOwner {
        termsAndConditionsURI = uri;
    }

    // ******************** //
    // Change name / symbol //
    // ******************** //

    /**
     * Returns the token collection name.
     */
    function name() public view virtual override  returns (string memory) {
        return _changeableName;
    }

    /**
     * Returns the token collection symbol.
     */
    function symbol() public view virtual override returns (string memory) {
        return _changeableSymbol;
    }

    /**
     * @notice Change token name
     */
    function setName(string memory newName) external onlyOwner {
        _changeableName = newName;
    }

    /**
     * @notice Change token symbol
     */
    function setSymbol(string memory newSymbol) external onlyOwner {
        _changeableSymbol = newSymbol;
    }
}
