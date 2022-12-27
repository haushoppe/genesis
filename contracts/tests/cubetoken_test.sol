// SPDX-License-Identifier: GPL-3.0
        
pragma solidity >=0.4.22 <0.9.0;

// This import is automatically injected by Remix
import "remix_tests.sol"; 

// This import is required to use custom transaction context
// Although it may fail compilation in 'Solidity Compiler' plugin
// But it will work fine in 'Solidity Unit Testing' plugin
import "remix_accounts.sol";

import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "../cubetoken.sol";


contract testSuite {
    CubeToken token;
        
    /// Define variables referring to different accounts
    address acc0; // account at zero index (account-0) is default account, so owner will be acc0
    address acc1;
    address acc2;

    function beforeAll() public {
        token = new CubeToken();
        acc0 = TestsAccounts.getAccount(0); 
        acc1 = TestsAccounts.getAccount(1);
        acc2 = TestsAccounts.getAccount(2);
    }

    /// Test if initial value is set correctly
    function saleAndLendingShouldBeDisabledAfterDeployment() public {
        
        Assert.equal(token.isSaleActive(), false, "sale should be disabled after deployment");
        Assert.equal(token.isLendingActive(), false, "lending should be disabled after deployment");
    }

    function shouldSupportAllInterfaces() public {

        // defines supportsInterface, see https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
        Assert.equal(token.supportsInterface(0x01ffc9a7), true, "Contract should support IERC165: 0x01ffc9a7");

        // the one and only NFT contract
        // see https://docs.openzeppelin.com/contracts/3.x/api/token/erc721#IERC721
        Assert.equal(token.supportsInterface(0x80ac58cd), true, "Contract should support IERC721: 0x80ac58cd");

        // defines: name(), symbol(), tokenURI(tokenId) and more
        // see https://docs.openzeppelin.com/contracts/3.x/api/token/erc721#IERC721Metadata
        Assert.equal(token.supportsInterface(0x5b5e139f), true, "Contract should support IERC721Metadata: 0x5b5e139f");

        // royalty payment information
        // see https://docs.openzeppelin.com/contracts/4.x/api/interfaces#IERC2981
        Assert.equal(token.supportsInterface(0x2a55205a), true, "Contract should support IERC2981: 0x2a55205a");

        // our own ILendable interface
        bytes4 lendableInterfaceId = type(ILendable).interfaceId;
        bytes4 lendableInterfaceId2 = 0x7f509df7;

        Assert.equal(lendableInterfaceId, lendableInterfaceId2, "ILendable should have this interfaceId: 0x7f509df7");
        Assert.equal(token.supportsInterface(0x7f509df7), true, "Contract should support ILendable: 0x7f509df7");


        // our own ITermsAndConditions interface
        bytes4 termsAndConditionsIntefaceId = type(ITermsAndConditions).interfaceId;
        bytes4 termsAndConditionsIntefaceId2 = 0x174fe517;

        Assert.equal(termsAndConditionsIntefaceId, termsAndConditionsIntefaceId2, "ITermsAndConditions should have this interfaceId: 0x174fe517");
        Assert.equal(token.supportsInterface(0x174fe517), true, "Contract should support ITermsAndConditions: 0x174fe517");
    }

    function shouldHaveNoRoyaltiesAfterDeployment() public {

        uint256 salePrice = 1 ether;
        (address receiver, uint256 royaltyAmount) = token.royaltyInfo(0, salePrice);
    
        Assert.equal(receiver, address(0), "Receiver should be zero address after deployment");
        Assert.equal(royaltyAmount, 0, "Royalties should be 0 after deployment");
    }

    function shouldSupportSettingRoyaltyInformation() public {

        // set royalty of all NFTs to 5%
        token.setDefaultRoyalty(acc1, 500);

        uint256 salePrice = 1 ether;
        (address receiver, uint256 royaltyAmount) = token.royaltyInfo(0, salePrice);
        uint256 expectedRoyaltyAmount = 50000000000000000;
    
        Assert.equal(receiver, acc1, "Receiver should be configured account");
        Assert.equal(royaltyAmount, expectedRoyaltyAmount, "Royalties should be 5%");
    }

    function shouldSupportSettingAndGettingTheTermsAndConditionsURI() public {

        // empty string after deployment
        Assert.equal(token.termsAndConditionsURI(), "", "URI should be empty after deployment");

        // change URI
        token.setTermsAndConditionsURI("https://example.org/");

        Assert.equal(token.termsAndConditionsURI(), "https://example.org/", "URI should be changeable");
    }
}
    