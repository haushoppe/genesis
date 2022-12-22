# Solidity contracts

## Dependencies

 * ERC721A contract
 * OpenZeppelin interfaces and utilities

```
npm install @openzeppelin/contracts
npm install --save-dev erc721a
```

## rotatingcube.sol

The main ERC721A contract for this project. Has the following methods, more to come:
 * setBaseURI (onlyOwner)
 * mint

## IDE for contract development

Use Remix IDE at https://remix.ethereum.org/

It is recommended to install `remixd` locally. That enables Remix IDE to interact with files on local disk. Start it like this, in the current folder:
```
remixd -s $(pwd) -u https://remix.ethereum.org/
```

In Remix, select "localhost" in the Workspaces dropdown menu to connect. If it works as expected, you'll see the files in this directory in Remix. Double clicking a .sol contract will open it in the main edit pane.


