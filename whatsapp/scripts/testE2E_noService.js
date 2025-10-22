// scripts/testE2E_noService.js
// Self-contained E2E test without importing HederaService (to avoid JSON import issues)
// Steps:
// 1) Generate new EVM keypair
// 2) Register phone -> address in UserRegistry (on-chain) using admin key
// 3) Resolve via contract
// 4) Send tiny HBAR from admin to new address

import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactPath = path.join(__dirname, '..', 'artifacts', 'UserRegistry.json');
const { abi } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

const HEDERA_RPC = process.env.HEDERA_RPC || 'https://testnet.hashio.io/api';
const CHAIN_ID = 296;
const ADMIN_PK = process.env.HEDERA_ADMIN_PK || process.env.DEPLOYER_PK;
const REGISTRY_ADDR = process.env.USER_REGISTRY_ADDRESS;

if (!ADMIN_PK) {
  console.error('Missing HEDERA_ADMIN_PK (or DEPLOYER_PK) in env.');
  process.exit(1);
}
if (!REGISTRY_ADDR) {
  console.error('Missing USER_REGISTRY_ADDRESS in env.');
  process.exit(1);
}

function randomPhone() {
  const n = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
  return `+1555${n}`;
}

(async () => {
  try {
    const provider = new ethers.JsonRpcProvider(HEDERA_RPC, CHAIN_ID);
    const admin = new ethers.Wallet(ADMIN_PK, provider);
    const adminAddr = await admin.getAddress();
    console.log('Admin:', adminAddr);
    const balWei = await provider.getBalance(adminAddr);
    console.log('Admin balance (HBAR):', ethers.formatEther(balWei));

    // 1) New EVM account (auto-created on first transfer on Hedera Testnet)
    const newWallet = ethers.Wallet.createRandom();
    console.log('New account:', newWallet.address);

    // 2) Register phone -> address in contract
    const phone = randomPhone();
    console.log('Registering phone:', phone, '->', newWallet.address);
    const contractAdmin = new ethers.Contract(REGISTRY_ADDR, abi, admin);
    const tx = await contractAdmin.registerUser(phone, newWallet.address);
    const receipt = await tx.wait();
    console.log('registerUser tx hash:', receipt.hash);

    // 3) Resolve back
    const contractRO = new ethers.Contract(REGISTRY_ADDR, abi, provider);
    const resolved = await contractRO.resolve(phone);
    console.log('Resolved from contract:', resolved);
    if (resolved.toLowerCase() !== newWallet.address.toLowerCase()) {
      throw new Error('Resolved address does not match registered address');
    }

    // 4) Send tiny transfer from admin to new account
    const amountHbar = 0.0001; // 0.0001 HBAR
    const valueWei = ethers.parseEther(amountHbar.toString());
    console.log(`Sending ${amountHbar} HBAR to ${newWallet.address}...`);
    const payTx = await admin.sendTransaction({ to: newWallet.address, value: valueWei });
    const payRcpt = await payTx.wait();
    console.log('Payment tx hash:', payRcpt.hash);

    const balRecipientWei = await provider.getBalance(newWallet.address);
    console.log('Recipient balance (HBAR):', ethers.formatEther(balRecipientWei));

    console.log('E2E test: SUCCESS');
  } catch (err) {
    console.error('E2E test: FAILED');
    console.error(err);
    process.exit(1);
  }
})();

