# Solidity contracts

## Dependencies

 * ERC721A contract v4 (https://www.npmjs.com/package/erc721a)
 * OpenZeppelin interfaces and utilities (https://www.npmjs.com/package/@openzeppelin/contracts)

Install via:

```
npm install
```

## rotatingcube.sol

The main ERC721A contract for this project. Has the following methods, more to come:
 * setBaseURI (onlyOwner)
 * mint

## IDE for contract development

Use Remix IDE at https://remix.ethereum.org/

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

### Activate the unit testing plugin

https://remix-ide.readthedocs.io/en/latest/unittesting.html