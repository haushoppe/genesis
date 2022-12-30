console.info('*** Make sure each contract is compiled and artifacts are generated before execution! ***');

async function deployToken(tokenName, owner) {
  const metadata = JSON.parse(await remix.call('fileManager', 'getFile', `artifacts/${tokenName}.json`))
  const instance = new ethers.ContractFactory(metadata.abi, metadata.data.bytecode.object, owner);
  const token = await instance.deploy();
  await token.deployed();
  // console.log('Token deployed! ⭐️ Contract address: ' + token.address);

  return token;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ONE_ADDRESS = '0x0000000000000000000000000000000000000001';


// Calling `signMessage` on a signer returned by `ethers.getSigners()` when using hardhat
// network results with following error:
// > MethodNotFoundError: Method personal_sign not found
// see https://github.com/NomicFoundation/hardhat/issues/1972
// see https://github.com/NomicFoundation/hardhat/issues/1981#issuecomment-966514426
//
// --> we create a completely new signer from a random wallet
// see https://piyopiyo.medium.com/how-to-generate-ethereum-wallet-with-ethers-js-d0ef74eadfd8
function getRandomSigner() {

  // later on we can just use this
  // const signer = new ethers.Wallet("0x" + "<your private key>");

  const wallet = ethers.Wallet.createRandom()
  // console.log('wallet address: ' +  wallet.address);
  // console.log('wallet mnemonic: ' + wallet.mnemonic.phrase);
  // console.log('wallet privateKey ' + wallet.privateKey);

  const provider = ethers.provider;
  const signer = new ethers.Wallet(wallet.privateKey, provider);
  // console.log(signer);
  return signer;
}

// encode the message - same as abi.encode in Solidity
// see https://docs.ethers.org/v5/api/utils/abi/coder/#AbiCoder--methods
//
// example MESSAGE: 0x0000000000000000000000005b38da6a701c568545dcfcb03fcb875f56beddc40000000000000000000000000000000000000000000000000000000000000004
function encodeMessage(sender, maximumAllowedMints) {
  
  const message = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [sender, maximumAllowedMints]);
  // console.log('MESSAGE encoded: ' + message);
  return message;
}

// pack an encoded message - same as abi.encodePacked in Solidity
// shown here: https://blog.cabala.co/how-to-verify-off-chain-results-and-whitelist-with-ecdsa-in-solidity-using-openzeppelin-ethers-js-ba4c85521711
// explained in detail here: https://89devs.com/solidity/keccak-hash/
//
// example MESSAGE: 0x5b38da6a701c568545dcfcb03fcb875f56beddc40000000000000000000000000000000000000000000000000000000000000004
function encodePackedMessage(sender, maximumAllowedMints) {

  const message = ethers.utils.solidityPack(["address", "uint256"], [sender, maximumAllowedMints]);
  // console.log('MESSAGE encoded + packed: ' + message);
  return message;
}
  

// hash the message with keccak256
// as shown here: https://blog.cabala.co/how-to-verify-off-chain-results-and-whitelist-with-ecdsa-in-solidity-using-openzeppelin-ethers-js-ba4c85521711
//
// Keccak256 is a hashing algorithm that can be used to convert an input into a fixed-size hash.
// It can then be stored conveniently in the bytes 32 data type.
function hashMessage(message) {
  
  const hash = ethers.utils.solidityKeccak256(["bytes"], [message]);
  // console.log('HASH: ' + hash);
  return hash;
}

// sign message with the signer wallet
// this signature is the signature signed for the message with the signer's private key.
async function signMessage(signer, message) {

  const signature = await signer.signMessage(ethers.utils.arrayify(message));
  // console.log('SIGNATURE: ' + signature);
  return signature;
}

exports.deployToken = deployToken;
exports.ZERO_ADDRESS = ZERO_ADDRESS;
exports.ONE_ADDRESS = ONE_ADDRESS;
exports.SignatureHelpers = {
  getRandomSigner,
  encodeMessage,
  encodePackedMessage,
  hashMessage,
  signMessage
};
