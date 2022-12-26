// SPDX-License-Identifier: GPL-3.0
        
pragma solidity >=0.4.22 <0.9.0;

// This import is automatically injected by Remix
import "remix_tests.sol"; 

// This import is required to use custom transaction context
// Although it may fail compilation in 'Solidity Compiler' plugin
// But it will work fine in 'Solidity Unit Testing' plugin
import "remix_accounts.sol";

import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "../artisttoken.sol";


contract testSuite {
    ArtistToken token;
        
    /// Define variables referring to different accounts
    address acc0; // account at zero index (account-0) is default account, so owner will be acc0
    address acc1;
    address acc2;

    function beforeAll() public {
        token = new ArtistToken();
        acc0 = TestsAccounts.getAccount(0); 
        acc1 = TestsAccounts.getAccount(1);
        acc2 = TestsAccounts.getAccount(2);

        Assert.equal(token.isLendingActive(), false, "lending should be disabled after deployment");

        token.setSaleStatus(true);
        token.setLendingStatus(true);
    }

    /// #sender: account-0
    /// #value: 100000000
    function aLoanedTokenMustBeRetrievableByFormerOwner() public payable {

       try  token.mint(2) {
            Assert.ok(false, 'method execution should fail');
        } catch Error(string memory reason) {
            // Compare failure reason, check if it is as expected
            Assert.equal(reason, 'Invalid class', 'failed with unexpected reason');
        } catch (bytes memory /*lowLevelData*/) {
            Assert.ok(false, 'failed unexpected');
        }
    }

}
    