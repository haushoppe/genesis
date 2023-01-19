import { ethers } from "./ethers-5.6.esm.min.js";
import { contractAddress, contractABI } from "./contract-config.js";

// A Web3Provider wraps a standard Web3 provider, which is
// what MetaMask injects as window.ethereum into each page
const provider = new ethers.providers.Web3Provider(window.ethereum);

// The MetaMask plugin also allows signing transactions to
// send ether and pay to change state within the blockchain.
// For this, you need the account signer...
const signer = provider.getSigner();

// Initialize the contract object with a signer to be able to do transactions
const contract = new ethers.Contract(contractAddress, contractABI, signer);
console.log("Contract address is " + contractAddress);

let loggedIn = false;
let isAdmin = false;
let walletAddress = "";

/**
 * Pop up wallet dialog to get user to sign a message.
 * Check that signature is valid and really was signed by the "signer" account.
 */
async function login() {
    walletAddress = await signer.getAddress();
    const ens_name = await provider.lookupAddress(walletAddress);
    if (ens_name) {
        walletAddress = ens_name;
    }

    const message = "Sign this message to prove ownership of account " + walletAddress + "\n\nNo transaction is submitted.";

    try {
        // Pop up wallet notification to sign
        let signature = await signer.signMessage(message);

        // Verify that signature matches wallet address
        loggedIn = ethers.utils.verifyMessage(message, signature) == walletAddress;

        // Check if the current, logged-in user is an admin
        isAdmin = walletAddress == await contract.owner();
    } catch {
        return false;
    }
}

/**
 * Get the number of mints from the contract.
 * Updates the "mintcount" HTML element directly. Returns nothing.
 */
async function updateMintCount() {
    const mintCount = await contract.totalSupply();

    // Update counter on page
    document.getElementById("mintcount").textContent = mintCount + " mints so far";
}

/**
 * Show account address on mint page if logged in.
 * Updates the "accountinfo" HTML element directly. Returns nothing.
 */
async function showAccountInfo() {
    let message = "Not logged in yet."
    if (loggedIn) {
        message = "Successful login for " + walletAddress;
        if (isAdmin) {
            message = message + " (admin)";
        }
    }
    document.getElementById("accountinfo").textContent = message;
}

async function mintStatus(message) {
    document.getElementById("mintinfo").innerHTML = "<b>Status</b>: " + message;
}

async function enableMintButton() {
    if (!loggedIn) {
        await mintStatus("You need to connect your wallet before you can mint");
        return false;
    }

    const mintstatus = await contract.isSaleActive();
    if (mintstatus !== true) {
        await mintStatus("Minting is disabled");
        return false;
    }

    // Check if this wallet has minted already
    const balance = await contract.totalMintsPerAddress(walletAddress);
    const max_tokens_per_wallet = await contract.maxMintPerAddress();
    if (balance >= max_tokens_per_wallet) {
        await mintStatus("You've already minted your tokens");
        return false;
    }

    // Check if we're minted out (maxSupply can be raised by the admin in that case)
    const totalsupply = await contract.totalSupply();
    const maxsupply = await contract.maxSupply();
    console.log("totalSupply: " + totalsupply + " maxSupply: " + maxsupply);
    if (totalsupply + 1 > maxsupply) {
        await mintStatus("Sorry, minted out (maxSupply reached)");
        return false;
    }

    // Enable mint button
    document.getElementById('button').disabled = false;
}

/**
 * Initialization on page load
 */
async function onLoad() {
    await updateMintCount();

    // Get wallet to ask for permission to connect to this site
    await provider.send("eth_requestAccounts", []);

    await login();
    await showAccountInfo();
    await enableMintButton();
}
document.addEventListener('DOMContentLoaded', onLoad);

/**
 * Handle minting
 */
async function mint() {
    const mintstatus = await contract.isSaleActive();
    if (mintstatus !== true) {
        await mintStatus("Minting is disabled");
        return false;
    };

    const totalsupply = await contract.totalSupply();
    const maxsupply = await contract.maxSupply();
    if (totalsupply + 1 > maxsupply) {
        await mintStatus("Sorry, minted out (maxSupply reached)");
        return false;
    }

    // Submit transaction
    try {
        const tx = await contract.mint({ gasLimit: 150000 });
        await mintStatus("Successfully submitted transaction, waiting for it to be processed by the network");

        const txstatus = await tx.wait();
        if (txstatus.status == 1) {
            await mintStatus("Mint successful!");
        } else {
            await mintStatus("Transaction failed");
        }
    } catch (err) {
        await mintStatus("Got error: " + err.message);
    }
}
document.getElementById('button').addEventListener('click', mint);