# Solidity contracts

## Final Contracts

GenesisToken on Goerli
https://goerli.etherscan.io/address/0x728265b4DD95E502EC46CF18E06787c57b473482
by 0x33CF8688b6aFC84ea4F1F9464f000bA9B02Be356

GenesisToken on Mainnet
https://etherscan.io/address/0xBF79e5797dd766288F7831689EF943b286f92d86
by haushoppe.eth 

MosaicToken on Goerli
https://goerli.etherscan.io/address/0x9d0C0eC7f18A7D017f716a602E8991640412E07f
by 0x33CF8688b6aFC84ea4F1F9464f000bA9B02Be356

MosaicToken on Mainnet
https://etherscan.io/address/0xa8af731F0513DA720691d423d0a6C839Ab5d4a22
by haushoppe.eth 

SeaToken on Goerli
https://goerli.etherscan.io/address/0x3E1a35F35fCBb302EEBAD8D8c59aB0369065696E
by 0x33CF8688b6aFC84ea4F1F9464f000bA9B02Be356

SeaToken on Mainnet
https://etherscan.io/address/0xf05A5D8d9DCf1BB1D33B09322Cc52df320A04fC5
by haushoppe.eth 

ArtToken on Goerli
https://goerli.etherscan.io/address/0xBF79e5797dd766288F7831689EF943b286f92d86
by 0x33CF8688b6aFC84ea4F1F9464f000bA9B02Be356

ArtToken on Mainnet
https://etherscan.io/address/0xb40889c9fac33cd7684D3C9B14490EeE29a84761
by haushoppe.eth


Not used anymore -- SeaToken on Mainnet
(BOTTED https://etherscan.io/address/0x1c95e3014dA741C26E0F74cD67fa7f6D0891Fd6a )


## Dependencies

 * ~~ERC721A contract v4.2.3 (https://www.npmjs.com/package/erc721a)~~ (hacked version included)
 * OpenZeppelin interfaces and utilities v4.8.0 (https://www.npmjs.com/package/@openzeppelin/contracts)

Install via:

```
npm install
```

## Things to do after deployment to mainnet

For both tokens:

1. call `setBaseURI("https://genesis.haushoppe.art/x/")`
2. call `gift`

## IDE for contract development

Use Remix IDE at https://remix.ethereum.org/

Ready customized remix:
> https://remix.ethereum.org/#activate=solidity,solidityUnitTesting,debugger&optimize=true&runs=200&evmVersion=null&version=soljson-v0.8.17+commit.8df45f5f.js

It is recommended to install `remixd` locally. 
That enables Remix IDE to interact with files on local disk. 
Start it like this, in the current folder:

```
npm run remixd
```

In Remix, select "localhost" in the Workspaces dropdown menu to connect. 
If it works as expected, you'll see the files in this directory in Remix. 
Double clicking a `.sol` contract will open it in the main edit pane.

ALSO NOTE: Python3.6+ (pip3) needs to already be installed on the System.

```
python3 --version
```


### Change the compiler version

Left side bar: Solidity Compiler > Compiler > 0.811 or higher

Make sure to compile `artisttoken.sol` with "Enable optimization: 200",
otherwise it won't compile because of the contract size.


### JavaScript Testing using Chai & Mocha (and Hardhat)

Remix supports testing of your files in JavaScript
using assertion library Chai & test framework Mocha.

> Helpful Documents
> * see https://remix-ide.readthedocs.io/en/latest/testing_using_Chai_&_Mocha.html
> * see https://www.chaijs.com/api/bdd/ for the API Reference
> * see https://ethereum-waffle.readthedocs.io/en/latest/matchers.html

Once done with writing the tests, right click on file name in `File Explorers`
plugin. It will show some options along with option to `Run`. 
This `Run` option is used to run the JS scripts.

**Note:** It looks like that all `require()` deps are dynamically loaded by Remix.
This means nothing needs to be defined in the local `package.json`.
This also means we always get the very latest version.

Nice blueprint: https://github.com/Meta-Angels/ERC721A/blob/main/test/ERC721A.test.js


### Remix Solidity Unit Testing plugin (dont' use anymore!)

Run the remix solidity tests via the Remix IDE or from the command line:

```
npm run remix-tests
```

see https://remix-ide.readthedocs.io/en/latest/unittesting.html

Note: Some tests were written with the plugin. 
But its not useful for advanced scenarios!!

> Testing scenarios are very limited, because the `msg.sender` cant't be mocked 
> sufficiently!
> * see https://github.com/ethereum/remix-project/issues/1618
> * see https://github.com/ethereum/remix-project/issues/2369

> The problem is that the method you are trying to test is external and to use 
> msg.sender functionality you have to inherit the contract which makes it unable
> to call external methods.
> * see https://github.com/ethereum/remix-project/issues/2068#issuecomment-1090306802


## Know How


* How to use ERC2981 to set royalties
  see https://www.ethdump.com/how-use-erc2981-set-royalties
* How to Get Testnet ETH from a Goerli Faucet
  1. [Register for a free Alchemy account](https://alchemy.com/?a=829a4dd348
  2. Go to [goerlifaucet.com](https://goerlifaucet.com/)
  3. Click ‘Send Me ETH’
* How to add rich metadata to your ERC721 or ERC1155 NFTs:
  https://docs.opensea.io/docs/metadata-standards
* Deploy the contract
  https://remix-ide.readthedocs.io/en/latest/create_deploy.html#deploy-the-contract
  choose: `Injected Provider - MetaMask`
* Verify Contract
  1. use the Plugin: "ETHERSCAN - CONTRACT VERIFICATION"
  2. enter Etherscan API key
  3. submit the form (`scrips/etherscan` is used)
* BigNumbers: https://docs.ethers.org/v5/api/utils/bignumber/