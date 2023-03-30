import { ethers } from 'hardhat';

/**
 * Fills the Hardhart test network with a series of transcations that simulate the first mints of the projects.
 */
async function main() {

  // doing 2x for loops to have the same contract addresses each time, see `known-tokens.ts`
  const deployedTokens: { [tokenName: string]: any } = {};
  for (const tokenName of ['GenesisToken',  'MosaicToken', 'SeaToken', 'ArtToken', 'ArtistToken', 'CubeToken']) {

    const contractFactory = await ethers.getContractFactory(tokenName);
    const token = await contractFactory.deploy();
    await token.deployed();

    console.log(`\x1b[33m *** ${ tokenName } deployed to ${ token.address } *** \x1b[0m`);

    deployedTokens[tokenName] = token;
  }

  for (const tokenName of ['GenesisToken',  'MosaicToken', 'SeaToken', 'ArtToken', 'ArtistToken', 'CubeToken']) {

    const token = deployedTokens[tokenName];

    await token.setSaleStatus(true)
    await token.setLendingStatus(true);
    await token.setMintPrice(ethers.utils.parseEther("0.1"));

    // user mints 20 tokens
    await token.mint(20, { value: ethers.utils.parseEther("2") });

    if (tokenName === 'GenesisToken' ||
        tokenName === 'MosaicToken') {

      await token.setBatchMosaicMintStatus(true);
      await token.setMintPriceForMosaic(ethers.utils.parseEther("0.05"));

      // mint a 4 mosaics - new tokenIds are #20, #21, #22, #23
      await token.mintMosaicBatch(
        [  0,  1,  2,  3 ],
        [  4,  5,  6,  7 ],
        [  8,  9, 10, 11 ],
        [ 12, 13, 14, 15 ],
        { value: ethers.utils.parseEther("0.2") });

      // now mint a mosaic of mosaics! new tokenIds is #24
      await token.mintMosaic(20, 21, 22, 23,
        { value: ethers.utils.parseEther("0.05") });

      // and a mixed one, new tokenIds is #25
      await token.mintMosaic(24, 16, 17, 18,
        { value: ethers.utils.parseEther("0.05") });
    }

    // enables/disables minting via allowlist
    // see also the `.env.example` file
    await token.setSignerAddress("0xDC11bDf94F8Db09DEA6bdeEDc12cecA406bA4658");
  }

  // last but not least, the poor dev has no money on hardhat, let's send him some huge cash!
  const johannes = '0x8c11C53F77aD5e91fB13611904f2F59b07Aa7c93';
  const [owner] = await ethers.getSigners();
  await owner.sendTransaction({
    to: johannes,
    value: ethers.utils.parseEther("10")
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
