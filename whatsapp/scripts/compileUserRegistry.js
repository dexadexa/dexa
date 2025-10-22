// scripts/compileUserRegistry.js
// Compile contracts/UserRegistry.sol using solc (standard JSON input/output).
// Produces artifacts/UserRegistry.json with { abi, bytecode }.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contractRelPath = path.join('contracts', 'UserRegistry.sol');
const contractPath = path.join(__dirname, '..', contractRelPath);
const artifactsDir = path.join(__dirname, '..', 'artifacts');
const outFile = path.join(artifactsDir, 'UserRegistry.json');

if (!fs.existsSync(contractPath)) {
  console.error('Missing', contractRelPath);
  process.exit(1);
}

const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    [contractRelPath]: { content: source }
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': {
        '*': [ 'abi', 'evm.bytecode.object' ]
      }
    }
  }
};

console.log('Compiling UserRegistry.sol with solc', solc.version());
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  const hasError = output.errors.some((e) => e.severity === 'error');
  output.errors.forEach((e) => console.log(e.formattedMessage || e.message));
  if (hasError) {
    process.exit(1);
  }
}

const compiled = output.contracts?.[contractRelPath]?.UserRegistry;
if (!compiled) {
  console.error('Compilation succeeded but UserRegistry artifact not found');
  process.exit(1);
}

const abi = compiled.abi;
const bytecode = '0x' + compiled.evm.bytecode.object;

if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir);
fs.writeFileSync(outFile, JSON.stringify({ abi, bytecode }, null, 2));

console.log('Wrote', path.relative(process.cwd(), outFile));

