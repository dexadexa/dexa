// HederaService.js
// Minimal Hedera (EVM) service skeleton using ethers v6 and Hashio RPC.
// NOTE: This is an initial scaffold for Hedera Testnet (EVM).

import { ethers } from "ethers";
import UserRegistry from "./artifacts/UserRegistry.json" assert { type: "json" };
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";


const DEFAULT_HEDERA_RPC = process.env.HEDERA_RPC || "https://testnet.hashio.io/api";
const DEFAULT_CHAIN_ID = 296; // Hedera Testnet (EVM)

export default class HederaService {
  /**
   * @param {object} [opts]
   * @param {string} [opts.rpcUrl]
   */
  constructor(opts = {}) {
    const rpcUrl = opts.rpcUrl || DEFAULT_HEDERA_RPC;
    this.provider = new ethers.JsonRpcProvider(rpcUrl, DEFAULT_CHAIN_ID);
    // Optional on-chain registry wiring
    const regAddr = process.env.USER_REGISTRY_ADDRESS;
    if (regAddr && regAddr !== ZERO_ADDR) {
      this._userRegistryContract = new ethers.Contract(regAddr, UserRegistry.abi, this.provider);
    } else {
      this._userRegistryContract = null;
    }

    // In-memory stub registry: phone -> EVM address (used until on-chain contract is deployed)
    this._registry = new Map();
  }

  // ---------- Account & balances ----------

  /** Create a new local EVM account (not funded). */
  async createAccount() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase || null,
    };
  }

  /** Return account balance as tinybar (BigInt) for compatibility with existing tests. */
  async getAccountBalance(address) {
    const wei = await this.provider.getBalance(address);
    return wei; // BigInt (tinybar)
  }

  // Value conversions
  // Hedera EVM uses 18-decimal "wei" like Ethereum; Hedera native tinybar has 8 decimals.
  // 1 HBAR = 1e18 wei; 1 HBAR = 1e8 tinybar; therefore 1 tinybar = 1e10 wei.
  tinybarToWei(tinybar) {
    return BigInt(tinybar) * 10_000_000_000n;
  }

  weiToTinybar(wei) {
    return BigInt(wei) / 10_000_000_000n;
  }

  weiToHbarNumber(wei) {
    return parseFloat(ethers.formatEther(wei));
  }

  hbarToWei(hbarAmount) {
    return ethers.parseEther(hbarAmount.toString());
  }

  /** Simple sleep helper used by tests */
  async sleep(seconds) {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  /**
   * Send HBAR value (in wei) from a private key to a recipient EVM address.
   * @param {string} fromPrivateKey - EVM private key (0x...)
   * @param {string} toAddress - Recipient 0x address
   * @param {bigint} valueWei - Amount in wei (18 decimals)
   */
  async sendPayment(fromPrivateKey, toAddress, valueWei) {
    const wallet = new ethers.Wallet(fromPrivateKey, this.provider);
    const tx = await wallet.sendTransaction({ to: toAddress, value: valueWei });
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  }

  /** Fund an account from an env-configured faucet private key (HEDERA_FAUCET_PK). */
  async fundAccount(toAddress, amountTinybar) {
    const faucetPk = process.env.HEDERA_FAUCET_PK;
    if (!faucetPk) {
      throw new Error("HEDERA_FAUCET_PK not set. Provide a funded testnet private key to enable funding.");
    }
    const faucet = new ethers.Wallet(faucetPk, this.provider);
    const value = this.tinybarToWei(amountTinybar);
    const tx = await faucet.sendTransaction({ to: toAddress, value });
    await this.provider.waitForTransaction(tx.hash);
    return tx;
  }

  // ---------- App-specific stubs (to be implemented) ----------

  async registerUser(phoneNumber, evmAddress) {
    if (!phoneNumber || !evmAddress) throw new Error("registerUser: phone and evmAddress required");
    // If on-chain registry configured and admin key available, write to contract
    const adminPk = process.env.HEDERA_ADMIN_PK || process.env.HEDERA_FAUCET_PK;
    if (this._userRegistryContract && adminPk) {
      const admin = new ethers.Wallet(adminPk, this.provider);
      const contract = this._userRegistryContract.connect(admin);
      const tx = await contract.registerUser(phoneNumber, evmAddress);
      const receipt = await tx.wait();
      return { hash: tx.hash, receipt };
    }
    // Fallback: in-memory mapping
    this._registry.set(phoneNumber, evmAddress);
    return { hash: `stub-register-${Buffer.from(phoneNumber).toString('hex').slice(0, 16)}` };
  }

  async sendPaymentByPhone(fromPrivateKey, toPhoneNumber, amountTinybar, _desc = "") {
    const toAddress = this._registry.get(toPhoneNumber);
    if (!toAddress) throw new Error(`Unknown phone: ${toPhoneNumber}`);
    const valueWei = this.tinybarToWei(amountTinybar);
    const res = await this.sendPayment(fromPrivateKey, toAddress, valueWei);
    return res;
  }

  resolvePhone(phoneNumber) {
    return this._registry.get(phoneNumber) || null;
  }

  async createGroup(creatorPrivateKey, groupName) {
    if (!this._groups) { this._groups = new Map(); this._nextGroupId = 1; }
    const creator = new ethers.Wallet(creatorPrivateKey);
    const id = this._nextGroupId++;
    this._groups.set(id, {
      name: groupName,
      admin: creator.address,
      members: new Set([creator.address]),
      expenses: [],
    });
    return { hash: `stub-group-${id}`, groupId: id };
  }

  async addMemberToGroup(adminPrivateKey, groupId, memberAddress) {
    if (!this._groups || !this._groups.has(groupId)) throw new Error("Unknown group");
    const group = this._groups.get(groupId);
    const admin = new ethers.Wallet(adminPrivateKey);
    if (admin.address.toLowerCase() !== group.admin.toLowerCase()) throw new Error("Not group admin");
    group.members.add(memberAddress);
    return { hash: `stub-add-${groupId}-${memberAddress.slice(2,8)}` };
  }

  async addGroupExpense(payerPrivateKey, groupId, amountTinybar, description, participants) {
    if (!this._groups || !this._groups.has(groupId)) throw new Error("Unknown group");
    const payer = new ethers.Wallet(payerPrivateKey);
    const group = this._groups.get(groupId);
    group.expenses.push({ payer: payer.address, amount: amountTinybar, description, participants });
    return { hash: `stub-exp-${groupId}-${group.expenses.length}` };
  }

  async executeOptimalSettlement(executorPrivateKey, groupId) {
    if (!this._groups || !this._groups.has(groupId)) throw new Error("Unknown group");
    // Stub: no on-chain transfers; return a synthetic hash
    return { hash: `stub-settle-${groupId}` };
  }

  async refundPayment(adminPrivateKey, originalTxRef) {
    // Stub: no actual transfer reversal; return synthetic hash
    return { hash: `stub-refund-${String(originalTxRef).slice(0,16)}` };
  }
}

