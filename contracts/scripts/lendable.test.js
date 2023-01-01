const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployToken, ZERO_ADDRESS, ONE_ADDRESS, SignatureHelpers } = require("./_utils");

const oneEther = ethers.utils.parseEther("1");
const threeEther = ethers.utils.parseEther("3");
const pointOneEther = ethers.utils.parseEther("0.1");
const aLittleBitGas = ethers.utils.parseEther("0.0001");

['GenesisToken', 'SeaToken', 'ArtToken', 'MosaicToken'].forEach(tokenName => {

  describe(`ILendable: ${tokenName} contract`, () => {

    let owner, addr1, addr2, addr3, token;

    beforeEach(async () => {
      const [_owner, _addr1, _addr2, _addr3] = await ethers.getSigners();
      owner = _owner;
      addr1 = _addr1;
      addr2 = _addr2;
      addr3 = _addr3;
      token = await deployToken(tokenName, owner);
    });

    describe("after deployment", () => {

      it('should have sale and lending disabled', async () => {
        expect(await token.isSaleActive()).to.equal(false);
        expect(await token.isLendingActive()).to.equal(false);
      });

      it('should have 0 supply', async () => {
        expect(await token.totalSupply()).to.equal(0);
        expect(await token.totalLoaned()).to.equal(0);
      });

      it('should support all interfaces', async () => {
        expect(await token.supportsInterface(0x01ffc9a7)).to.equal(true, "Contract should support IERC165: 0x01ffc9a7");
        expect(await token.supportsInterface(0x80ac58cd)).to.equal(true, "Contract should support IERC721: 0x80ac58cd");
        expect(await token.supportsInterface(0x5b5e139f)).to.equal(true, "Contract should support IERC721Metadata: 0x5b5e139f");
        expect(await token.supportsInterface(0xcd36757f)).to.equal(true, "Contract should support ILendable: 0xcd36757f");
      });

      describe("after setup", () => {

        beforeEach(async () => {
          await token.setSaleStatus(true)
          await token.setLendingStatus(true);
        });

        it('should have sale and lending active', async () => {
          expect(await token.isSaleActive()).to.equal(true);
          expect(await token.isLendingActive()).to.equal(true);
        });

        it('should be able to mint tokens', async () => {
          await token.mint(3);

          expect(await token.balanceOf(owner.address)).to.equal(3);
          expect(await token.totalSupply()).to.equal(3);
          expect(await token.totalMintsPerAddress(owner.address)).to.equal(3); // not part of ILendable
        });

        it('should be able to mint via mintAllowlist (hashed+signed message)', async () => {

          const signer = SignatureHelpers.getRandomSigner();
          await token.setSignerAddress(signer.address);

          const sender = owner.address;
          const maximumAllowedMints = 4;

          // Difference to the MA contract:
          // they use `abi.encode`
          // we use `abi.encodePacked`
          // explained in detail here: https://89devs.com/solidity/keccak-hash/
          //
          // It is recommended to encode the data first instead of hashing the raw data input.
          // The difference between abi.encode and abiencodePacked is that the encoded data is packed and therefore its data size is smaller.
          // const message = SignatureHelpers.encodeMessage(sender, maximumAllowedMints);
          const message = SignatureHelpers.encodePackedMessage(sender, maximumAllowedMints);
          const messageHash = SignatureHelpers.hashMessage(message);
          const signature = await SignatureHelpers.signMessage(signer, messageHash);

          await token.mintAllowlist(messageHash, signature, 1, maximumAllowedMints);

          expect(await token.totalSupply()).to.equal(1);
        });

        it('should be able to mint 3 tokens for 3 ETH', async () => {

          const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

          // const contractBalanceBefore = await ethers.provider.getBalance(token.address);
          // console.log('OLD CONTRACT BALANCE ' + format(contractBalanceBefore));
          // console.log('OLD OWNER BALANCE ' + format(ownerBalanceBefore));

          await token.setMintPrice(oneEther);
          expect(await token.price()).to.equal(oneEther);
          await token.mint(3, { value: threeEther });

          const contractBalanceAfter = await ethers.provider.getBalance(token.address);
          const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
          
          // contract has exactly 3 ETH now
          expect(contractBalanceAfter.eq(threeEther)).to.be.true;

          // owner spend a little bit more than 3 ETH (eg. 99 ETH - 95.9 > 3.1) because of the gas
          expect(ownerBalanceBefore.sub(ownerBalanceAfter).gt(threeEther)).to.be.true;

          // console.log('NEW CONTRACT BALANCE ' + format(contractBalanceAfter));
          // console.log('NEW OWNER BALANCE ' + format(ownerBalanceAfter));
        });

        it('should revert mints with lower paid value', async () => {
          await token.setMintPrice(oneEther);
          await expect(token.mint(3, { value: oneEther })).to.be.revertedWith('Invalid paid amount');
        });

        it('should revert mints with higher paid value', async () => {
          await token.setMintPrice(pointOneEther);
          await expect(token.mint(1, { value: oneEther })).to.be.revertedWith('Invalid paid amount');
        });

        it('owner should be able to withdraw the contracts full balance to own address', async () => {

          await token.setMintPrice(oneEther);
          await token.mint(3, { value: threeEther });

          const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
          await token.withdraw();
          const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

          // the owner gets his 3 ETH back, but lost a bit money because of gas
          expect(ownerBalanceAfter.sub(ownerBalanceBefore).add(aLittleBitGas).gt(threeEther)).to.be.true;
        });

        it('owner should be able to gift tokens to multiple addresses', async () => {
          await token.gift([addr1.address, addr2.address], 5);

          expect(await token.balanceOf(addr1.address)).to.equal(5);
          expect(await token.balanceOf(addr2.address)).to.equal(5);
          expect(await token.balanceOf(addr3.address)).to.equal(0); // addr3 got nothing!
          expect(await token.totalSupply()).to.equal(10);
          expect(await token.totalMintsPerAddress(addr1.address)).to.equal(5); // not part of ILendable
          expect(await token.totalMintsPerAddress(addr2.address)).to.equal(5); // not part of ILendable
        });

        it('should be able to mint, lend and retrieve a token', async () => {

          // user mints 3 tokens
          await token.mint(3);

          // loans token0 and token1 to addr1 and token2 to addr2
          await token.loan(0, addr1.address);
          await token.loan(1, addr1.address);
          await token.loan(2, addr2.address);

          // now there are a total of 3 tokens loaned
          expect(await token.totalLoaned()).to.equal(3);

          // orginal owner now owns no tokens anymore
          // addr1 owns 2 tokens now
          // addr2 owns 1 tolen now
          expect(await token.balanceOf(owner.address)).to.equal(0);
          expect(await token.balanceOf(addr1.address)).to.equal(2);
          expect(await token.balanceOf(addr2.address)).to.equal(1);

          // the tokenOwnersOnLoan mapping shows the lender
          expect(await token.tokenOwnersOnLoan(0)).to.equal(owner.address);
          expect(await token.tokenOwnersOnLoan(1)).to.equal(owner.address);
          expect(await token.tokenOwnersOnLoan(2)).to.equal(owner.address);

          // all three tokens of the lender are also shown here...
          var loanedTokens = (await token.loanedTokensByAddress(owner.address)).map(x => x.toString());
          expect(loanedTokens.length).to.equal(3);
          expect(loanedTokens).to.include("0");
          expect(loanedTokens).to.include("1");
          expect(loanedTokens).to.include("2");

          // ...and he loaned a total of 3
          expect(await token.totalLoanedPerAddress(owner.address)).to.equal(3);

          // but the others not (of course)
          expect(await token.totalLoanedPerAddress(addr1.address)).to.equal(0);
          expect(await token.totalLoanedPerAddress(addr2.address)).to.equal(0);

          // now retrieve tokens, but only token1 and token2 (not token0)
          await token.retrieveLoan(1);
          await token.retrieveLoanByAdmin(2);

          // and finally check some numbers again
          expect(await token.totalLoaned()).to.equal(1);
          expect(await token.balanceOf(owner.address)).to.equal(2);
          expect(await token.balanceOf(addr1.address)).to.equal(1);
          expect(await token.balanceOf(addr2.address)).to.equal(0);
          expect(await token.tokenOwnersOnLoan(0)).to.equal(owner.address);

          var loanedTokens2 = (await token.loanedTokensByAddress(owner.address)).map(x => x.toString());
          expect(loanedTokens2.length).to.equal(1);
          expect(loanedTokens2).to.include("0");

          expect(await token.totalLoanedPerAddress(owner.address)).to.equal(1);
        });

        it('should NOT be possible to loan a loaned token', async () => {
          await token.mint(2);
          await token.loan(1, addr1.address);
          await expect(token.loan(1, addr2.address)).to.be.revertedWith('Trying to loan a loaned token');
        });

        it('should NOT be possible to loan not owned token', async () => {
          await token.mint(2);
          //  safeTransferFrom is a overloaded function. In ethers, the syntax to call an overloaded contract function is different from the non-overloaded function
          await token["safeTransferFrom(address,address,uint256)"](owner.address, addr1.address, 1);
          await expect(token.loan(1, addr2.address)).to.be.revertedWith('Trying to loan not owned token');
        });

        it('should NOT be possible to transfer a token on loan by the lender', async () => {
          await token.mint(2);
          await token.loan(1, addr1.address);

          // TransferFromIncorrectOwner : The token must be owned by `from`.
          await expect(token["safeTransferFrom(address,address,uint256)"](owner.address, addr1.address, 1)).to.be.reverted;
        });

        it('should NOT be possible to transfer a token on loan by the borrower', async () => {
          await token.mint(2);
          await token.loan(1, addr1.address);
          await expect(token.connect(addr1)["safeTransferFrom(address,address,uint256)"](addr1.address, addr2.address, 1)).to.be.revertedWith('Cannot transfer token on loan');
        });

        it('should NOT be possible to loan a token to yourself', async () => {
          await token.mint(2);
          await expect(token.loan(1, owner.address)).to.be.revertedWith('Trying to loan a token to the same address');
        });
       
        it('should NOT be possible to loan a token to the zero address', async () => {
          await token.mint(2);
          await expect(token.loan(1, ZERO_ADDRESS)).to.be.revertedWith('Transfer to the zero address');
        });

        it('should be possible to loan/retrieve a token to the one address', async () => {
          await token.mint(2);
          await token.loan(1, ONE_ADDRESS);
          await token.retrieveLoan(1);

          expect(await token.totalLoaned()).to.equal(0);
        });

        // checks for: 
        // TransferToNonERC721ReceiverImplementer: 
        // Cannot safely transfer to a contract that does not implement the ERC721Receiver interface.
        // 
        // ...which should not happen anymore, because we do a very unsafe transfer now
        it('should be possible to loan/retrieve a token to any contract address', async () => {
          await token.mint(2);
          await token.loan(1, token.address);
          await token.retrieveLoan(1);

          expect(await token.totalLoaned()).to.equal(0);
        });
      });
    });
  });
});