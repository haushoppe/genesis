# Solidity contracts

## Dependencies

 * ERC721A contract v4 (https://www.npmjs.com/package/erc721a)
 * OpenZeppelin interfaces and utilities (https://www.npmjs.com/package/@openzeppelin/contracts)

Install via:

```
npm install
```

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

### Testing using Chai & Mocha

Remix supports testing of your files in JavaScript
using assertion library Chai & test framework Mocha.

see https://remix-ide.readthedocs.io/en/latest/testing_using_Chai_&_Mocha.html

Once done with writing the tests, right click on file name in `File Explorers`
plugin. It will show some options along with option to `Run`. 
This `Run` option is used to run the JS scripts



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
see https://github.com/ethereum/remix-project/issues/1618
see https://github.com/ethereum/remix-project/issues/2369

> The problem is that the method you are trying to test is external and to use 
> msg.sender functionality you have to inherit the contract which makes it unable
> to call external methods.

see https://github.com/ethereum/remix-project/issues/2068#issuecomment-1090306802


## How to use ERC2981 to set royalties

see https://www.ethdump.com/how-use-erc2981-set-royalties