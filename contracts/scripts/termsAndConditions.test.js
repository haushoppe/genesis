const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployToken } = require("./_utils");

const oneEther = ethers.utils.parseEther("1");
const twoEther = ethers.utils.parseEther("2");

['ArtistToken'].forEach(tokenName => {

  describe(`IAgreeToTermsAndConditions: ${tokenName} contract`, () => {

    let owner, addr1, addr2, addr3, token;

    beforeEach(async () => {
      const [_owner, _addr1, _addr2, _addr3] = await ethers.getSigners();
      owner = _owner;
      addr1 = _addr1;
      addr2 = _addr2;
      addr3 = _addr3;
      token = await deployToken(tokenName, owner);

      await token.setSaleStatus(true);
      await token.setMintPrice(oneEther);
    });

    it('should support all interfaces', async () => {
      expect(await token.supportsInterface(0x174fe517)).to.equal(true, "Contract should support ITermsAndConditions: 0x174fe517");
      expect(await token.supportsInterface(0x14477c1f)).to.equal(true, "Contract should support IAgreeToTermsAndConditions: 0x14477c1f");
    });

    it('you can only agree if you hold a token', async () => {
      await expect(token.agreeOrDisagreeToTermsAndConditions(true)).to.be.revertedWith('You can only agree to our terms and conditions if you hold a token!');
      await expect(token.agreeOrDisagreeToTermsAndConditions(false)).to.be.revertedWith('You have no agreement that could be revoked.');
    });

    it('owner should be able change the terms and conditions URI', async () => {
      expect(await token.termsAndConditionsURI()).to.equal('', 'URI should be empty after deployment');
      await token.setTermsAndConditionsURI("https://example.org/");
      expect(await token.termsAndConditionsURI()).to.equal('https://example.org/', 'URI should be changeable');
    });

    it('the minting of a token should be interpreted as an agreement with event', async () => {
      await expect(token.mint(1, { value: oneEther }))
        .to.emit(token, 'Agreement')
        .withArgs(owner.address, true);

      expect(await token.agreements(owner.address)).to.be.true;
    });

    it('if a previous holder no longer owns any tokens, this should be interpreted as a revoke of the agreement with event', async () => {
      await token.mint(1, { value: oneEther });

      await expect(token["safeTransferFrom(address,address,uint256)"](owner.address, addr1.address, 0))
        .to.emit(token, 'Agreement')
        .withArgs(owner.address, false);

      expect(await token.agreements(owner.address)).to.be.false;
    });

    it('if a previous holder still owns a token, this should be NOT interpreted as a revoke of the agreement', async () => {
      await token.mint(2, { value: twoEther });

      await expect(token["safeTransferFrom(address,address,uint256)"](owner.address, addr1.address, 0))
        .to.not.emit(token, 'Agreement');

      expect(await token.agreements(owner.address)).to.be.true;
    });

    it('after a token transfer, the new owner should not have given his agreement', async () => {
      await token.mint(1, { value: oneEther });
      await token["safeTransferFrom(address,address,uint256)"](owner.address, addr1.address, 0);

      expect(await token.agreements(addr1.address)).to.be.false;

      // he/she must call the function `agreeOrDisagreeToTermsAndConditions(true)` to agree
      await expect(token.connect(addr1).agreeOrDisagreeToTermsAndConditions(true))
        .to.emit(token, 'Agreement')
        .withArgs(addr1.address, true);

      console.log('TEST!1');
      expect(await token.agreements(addr1.address)).to.be.true;

      // lets agree twice
      await expect(token.connect(addr1).agreeOrDisagreeToTermsAndConditions(true)).to.be.revertedWith('You already agreed to our terms and conditions!');

      // and finally disagree
      await token.connect(addr1).agreeOrDisagreeToTermsAndConditions(false);
      expect(await token.agreements(addr1.address)).to.be.false;
    });
  });
});