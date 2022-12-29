console.info('*** Make sure each contract is compiled and artifacts are generated before execution! ***');

exports.deployToken = async function(tokenName, owner) {
    const metadata = JSON.parse(await remix.call('fileManager', 'getFile', `artifacts/${tokenName}.json`))
    const instance = new ethers.ContractFactory(metadata.abi, metadata.data.bytecode.object, owner);
    const token = await instance.deploy();
    await token.deployed();
    // console.log('Token deployed! ⭐️ Contract address: ' + token.address);

    return token;
};

exports.ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';