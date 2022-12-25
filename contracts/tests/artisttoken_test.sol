// SPDX-License-Identifier: GPL-3.0
        
pragma solidity >=0.4.22 <0.9.0;

// This import is automatically injected by Remix
import "remix_tests.sol"; 

// This import is required to use custom transaction context
// Although it may fail compilation in 'Solidity Compiler' plugin
// But it will work fine in 'Solidity Unit Testing' plugin
import "remix_accounts.sol";
import "../artisttoken.sol";

contract testSuite {
    ArtistToken token;

    function beforeAll() public {
        token = new ArtistToken();
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

    }




    // function checkSuccess() public {
    //     // Use 'Assert' methods: https://remix-ide.readthedocs.io/en/latest/assert_library.html
    //     Assert.ok(2 == 2, 'should be true');
    //     Assert.greaterThan(uint(2), uint(1), "2 should be greater than to 1");
    //     Assert.lesserThan(uint(2), uint(3), "2 should be lesser than to 3");
    // }

    // function checkSuccess2() public pure returns (bool) {
    //     // Use the return value (true or false) to test the contract
    //     return true;
    // }
    
    // function checkFailure() public {
    //     Assert.notEqual(uint(1), uint(1), "1 should not be equal to 1");
    // }

    // /// Custom Transaction Context: https://remix-ide.readthedocs.io/en/latest/unittesting.html#customization
    // /// #sender: account-1
    // /// #value: 100
    // function checkSenderAndValue() public payable {
    //     // account index varies 0-9, value is in wei
    //     Assert.equal(msg.sender, TestsAccounts.getAccount(1), "Invalid sender");
    //     Assert.equal(msg.value, 100, "Invalid value");
    // }
}
    