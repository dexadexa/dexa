/* eslint-disable no-console */
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const args = process.argv.slice(2);
  const arg = (name, def) => {
    const i = args.findIndex(a => a === `--${name}`);
    return (i !== -1 && i + 1 < args.length) ? args[i + 1] : def;
  };

  const token = arg('token');
  const to = arg('to');
  const amountStr = arg('amount', '0');
  if (!token || !to || !amountStr) {
    console.error('Usage: node scripts/transfer-erc20.js --token <addr> --to <addr> --amount <human>');
    process.exit(1);
  }

  const RPC = process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api';
  const PK = process.env.HEDERA_FUNDER_PRIVATE_KEY;
  if (!PK) throw new Error('HEDERA_FUNDER_PRIVATE_KEY missing');

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  const ERC20_ABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address to, uint256 value) returns (bool)'
  ];

  const erc20 = new ethers.Contract(token, ERC20_ABI, wallet);
  const decimals = await erc20.decimals();
  const symbol = await erc20.symbol().catch(()=>'TOKEN');

  function toUnits(human, decimals) {
    const [w, fRaw = ''] = String(human).split('.');
    const f = (fRaw + '0'.repeat(decimals)).slice(0, decimals) || '0';
    return BigInt(w || '0') * (10n ** BigInt(decimals)) + BigInt(f);
  }

  const value = toUnits(amountStr, Number(decimals));
  console.log(`Transferring ${amountStr} ${symbol} to ${to} ...`);
  const tx = await erc20.transfer(to, value);
  console.log('Tx:', tx.hash);
  const rcpt = await tx.wait();
  console.log('Status:', rcpt?.status);
}

main().catch((e) => { console.error(e); process.exit(1); });

