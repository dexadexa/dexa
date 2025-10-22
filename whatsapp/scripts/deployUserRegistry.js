// scripts/deployUserRegistry.js
// Minimal deployment script using ethers v6.
// This script expects either:
// 1) An artifacts/UserRegistry.json file with { abi, bytecode }
// or
// 2) Environment variables USER_REGISTRY_ABI and USER_REGISTRY_BYTECODE (JSON and 0x bytecode)
//
// Required ENV:
// - HEDERA_RPC (default: https://testnet.hashio.io/api)
// - DEPLOYER_PK (private key with HBAR on Hedera Testnet)
// - OPTIONAL: OWNER_ADDRESS (owner of the registry; defaults to deployer)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEDERA_RPC = process.env.HEDERA_RPC || 'https://testnet.hashio.io/api';
const DEPLOYER_PK = process.env.DEPLOYER_PK;
const OWNER_ADDRESS = process.env.OWNER_ADDRESS || null;

if (!DEPLOYER_PK) {
  console.error('Missing DEPLOYER_PK env var.');
  process.exit(1);
}

function loadArtifact() {
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'UserRegistry.json');
  if (fs.existsSync(artifactPath)) {
    const json = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    if (!json.abi || !json.bytecode) {
      throw new Error('artifacts/UserRegistry.json missing abi or bytecode');
    }
    return json;
  }
  const abiEnv = process.env.USER_REGISTRY_ABI;
  const bytecodeEnv = process.env.USER_REGISTRY_BYTECODE;
  if (!abiEnv || !bytecodeEnv) {
    throw new Error('Provide artifacts/UserRegistry.json or set USER_REGISTRY_ABI and USER_REGISTRY_BYTECODE');
  }
  const abi = JSON.parse(abiEnv);
  const bytecode = bytecodeEnv;
  return { abi, bytecode };
}

async function main() {
  const { abi, bytecode } = loadArtifact();
  const provider = new ethers.JsonRpcProvider(HEDERA_RPC, 296);
  const wallet = new ethers.Wallet(DEPLOYER_PK, provider);

  console.log('Deployer:', await wallet.getAddress());
  const balance = await provider.getBalance(await wallet.getAddress());
  console.log('Balance (HBAR):', ethers.formatEther(balance));

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const owner = OWNER_ADDRESS || await wallet.getAddress();
  const contract = await factory.deploy(owner);

  console.log('Deploying UserRegistry...');
  const receipt = await contract.deploymentTransaction().wait();

  const addr = await contract.getAddress();
  console.log('UserRegistry deployed at:', addr);
  console.log('Tx hash:', receipt.hash);
  console.log('Explorer:', `https://hashscan.io/testnet/contract/${addr}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

