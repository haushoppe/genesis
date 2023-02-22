import '@nomicfoundation/hardhat-toolbox';

import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from 'hardhat/builtin-tasks/task-names';
import { HardhatUserConfig, subtask } from 'hardhat/config';
import fs from 'fs';


// https://github.com/NomicFoundation/hardhat/issues/2306#issuecomment-1039452928
subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS)
  .setAction(async (_, __, runSuper) => {

    // let paths = await runSuper();
    let paths = fs.readdirSync(__dirname).filter(x => x.endsWith('.sol'))
    console.log('*** Discovered the following .sol files:', paths)
    return paths;
  });

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    sources: './', // <-- default would be `test`
    tests: './tests' // <-- default would be `test`
  },

  // MetaMask chainId issue
  // https://hardhat.org/hardhat-network/docs/metamask-issue#metamask-chainid-issue
  networks: {
    hardhat: {
      chainId: 1337
    }
  }
};

export default config;


