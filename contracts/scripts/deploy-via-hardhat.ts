import { ethers } from 'hardhat';

async function main() {

  // doing 2x for loops to have the same contract addresses each time
  const deployedTokens: { [tokenName: string]: any } = {};
  for (const tokenName of ['GenesisToken',  'MosaicToken', 'SeaToken', 'ArtToken']) {

    const contractFactory = await ethers.getContractFactory(tokenName);
    const token = await contractFactory.deploy();
    await token.deployed();

    console.log(`*** ${ tokenName } deployed to ${ token.address } ***`);

    deployedTokens[tokenName] = token;
  }

  for (const tokenName of ['GenesisToken',  'MosaicToken', 'SeaToken', 'ArtToken']) {

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
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
