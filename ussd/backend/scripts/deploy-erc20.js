/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const args = process.argv.slice(2);
  const arg = (name, def) => {
    const idx = args.findIndex(a => a === `--${name}`);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return def;
  };
  const supplyStr = arg('supply', '1000000'); // human units
  const toAddr = arg('to');
  const amountStr = arg('amount', '0'); // human units to transfer to --to immediately after deploy

  const RPC = process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api';
  const PK = process.env.HEDERA_FUNDER_PRIVATE_KEY;
  if (!PK) throw new Error('HEDERA_FUNDER_PRIVATE_KEY missing');

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const deployer = await wallet.getAddress();

  const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract SimpleToken {\n    string public name = "DeXa Token";\n    string public symbol = "DXT";\n    uint8 public decimals = 18;\n    uint256 public totalSupply;\n    mapping(address=>uint256) public balanceOf;\n    mapping(address=>mapping(address=>uint256)) public allowance;\n    constructor(uint256 initialSupply){ totalSupply=initialSupply; balanceOf[msg.sender]=initialSupply; }\n    function transfer(address to,uint256 amt) public returns(bool){ require(balanceOf[msg.sender]>=amt, "bal"); balanceOf[msg.sender]-=amt; balanceOf[to]+=amt; emit Transfer(msg.sender,to,amt); return true; }\n    function approve(address s,uint256 amt) public returns(bool){ allowance[msg.sender][s]=amt; emit Approval(msg.sender,s,amt); return true; }\n    function transferFrom(address f,address to,uint256 amt) public returns(bool){ require(balanceOf[f]>=amt && allowance[f][msg.sender]>=amt, "allow"); allowance[f][msg.sender]-=amt; balanceOf[f]-=amt; balanceOf[to]+=amt; emit Transfer(f,to,amt); return true; }\n    event Transfer(address indexed from,address indexed to,uint256 value);\n    event Approval(address indexed owner,address indexed spender,uint256 value);\n}`;

  // solc standard JSON input
  const input = {
    language: 'Solidity',
    sources: { 'SimpleToken.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const fatal = output.errors.filter(e => e.severity === 'error');
    if (fatal.length) {
      fatal.forEach(e => console.error(e.formattedMessage));
      process.exit(1);
    }
  }

  const contract = output.contracts['SimpleToken.sol']['SimpleToken'];
  const abi = contract.abi;
  const bytecode = '0x' + contract.evm.bytecode.object;

  const decimals = 18n;
  function toUnits(humanStr) {
    if (!humanStr) return 0n;
    const [intPart, fracPartRaw] = String(humanStr).split('.');
    const fracPart = (fracPartRaw || '').padEnd(Number(decimals), '0').slice(0, Number(decimals));
    const whole = BigInt(intPart || '0') * (10n ** decimals);
    const frac = fracPart ? BigInt(fracPart) : 0n;
    return whole + frac;
  }

  const initialSupply = toUnits(supplyStr);
  console.log('Deployer:', deployer);
  console.log('Initial supply (wei):', initialSupply.toString());

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contractInstance = await factory.deploy(initialSupply);
  console.log('Deploy tx:', contractInstance.deploymentTransaction().hash);
  const addr = await contractInstance.getAddress();
  console.log('Deployed token at:', addr);
  await contractInstance.waitForDeployment();

  if (toAddr && amountStr && Number(amountStr) > 0) {
    const amount = toUnits(amountStr);
    console.log(`Transferring ${amountStr} tokens to ${toAddr} ...`);
    const tx = await contractInstance.transfer(toAddr, amount);
    console.log('Transfer tx:', tx.hash);
    await tx.wait();
    console.log('Transfer complete');
  }

  console.log(JSON.stringify({ address: addr }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });

