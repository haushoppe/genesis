const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployToken } = require("./_utils");

['GenesisToken', 'SeaToken', 'ArtToken'].forEach(tokenName => {

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

          // owner mints 3 tokens
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

        it('should not be possible to loan a not owned token', async () => {
          await token.mint(2);
          await token.loan(1, addr1.address);
          await expect(token.loan(1, addr2.address)).to.be.revertedWith('Trying to loan not owned token');
        });

        it('should not be possible to loan a token to yourself', async () => {
          await token.mint(2);
          await expect(token.loan(1, owner.address)).to.be.revertedWith('Trying to loan a token to the same address');
        });
      });
    });
  });
});