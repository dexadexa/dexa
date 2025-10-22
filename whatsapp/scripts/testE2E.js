// scripts/testE2E.js
// Quick end-to-end test for Hedera EVM:
// 1) Create a new account (local keypair)
// 2) Register phone -> address in UserRegistry
// 3) Resolve it back from the contract
// 4) Send a tiny HBAR transfer to the new address

import { ethers } from 'ethers';
import HederaService from '../HederaService.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactPath = path.join(__dirname, '..', 'artifacts', 'UserRegistry.json');
const UserRegistry = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

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

const provider = new ethers.JsonRpcProvider(HEDERA_RPC, CHAIN_ID);
const service = new HederaService({ rpcUrl: HEDERA_RPC });

function randomPhone() {
  // E.164-like test number
  const n = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
  return `+1555${n}`;
}

(async () => {
  try {
    const admin = new ethers.Wallet(ADMIN_PK, provider);
    const adminAddr = await admin.getAddress();
    console.log('Admin:', adminAddr);
    const balWei = await provider.getBalance(adminAddr);
    console.log('Admin balance (HBAR):', ethers.formatEther(balWei));

    // 1) Create a new account (local keypair; Hedera will auto-create on first transfer)
    const acct = await service.createAccount();
    console.log('New account:', acct.address);

    // 2) Register phone -> address
    const phone = randomPhone();
    console.log('Registering phone:', phone, '->', acct.address);
    const reg = await service.registerUser(phone, acct.address);
    console.log('registerUser tx hash:', reg.hash);

    // 3) Resolve back from contract
    const contract = new ethers.Contract(REGISTRY_ADDR, UserRegistry.abi, provider);
    const resolved = await contract.resolve(phone);
    console.log('Resolved from contract:', resolved);
    if (resolved.toLowerCase() !== acct.address.toLowerCase()) {
      throw new Error('Resolved address does not match registered address');
    }

    // 4) Send a tiny transfer to the new address
    const amountHbar = 0.0001; // 0.0001 HBAR
    const valueWei = service.hbarToWei(amountHbar);
    console.log(`Sending ${amountHbar} HBAR to ${acct.address}...`);
    const pay = await service.sendPayment(ADMIN_PK, acct.address, valueWei);
    console.log('Payment tx hash:', pay.hash);

    // Confirm recipient balance
    const balRecipientWei = await provider.getBalance(acct.address);
    console.log('Recipient balance (HBAR):', ethers.formatEther(balRecipientWei));

    console.log('E2E test: SUCCESS');
  } catch (err) {
    console.error('E2E test: FAILED');
    console.error(err);
    process.exit(1);
  }
})();

