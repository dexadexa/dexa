import express, { Request, Response } from "express";
import { summarizeResponse } from "./utils.js";
import User from "./models/User.js";
import { connectDB } from "./db/connect.js";
import { africastalking } from "./sendSMS.js";
import dotenv from "dotenv";
import { Wallet, JsonRpcProvider, formatEther, parseEther, parseUnits, isAddress, Contract } from "ethers";
import { EventEmitter } from 'events';
dotenv.config();

// Hedera (EVM) provider setup
const RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
const CHAIN_ID = Number(process.env.HEDERA_CHAIN_ID || 296);
const provider = new JsonRpcProvider(RPC_URL, { chainId: CHAIN_ID, name: "hedera-testnet" });

// HTS Precompile and ERC20 minimal ABIs
const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";
const HTS_ABI = [
  "function associateToken(address account, address token) returns (int64)"
];
const ERC20_ABI = [
  "function transfer(address to, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Helpers: PIN lockout and fee estimation
import Transaction from "./models/Transaction.js";

async function isLocked(user: any): Promise<string | null> {
  if (!user?.pinLockedUntil) return null;
  const now = new Date();
  if (user.pinLockedUntil && now < user.pinLockedUntil) {
    const mins = Math.ceil((user.pinLockedUntil.getTime() - now.getTime()) / 60000);
    return `END PIN locked. Try again in ${mins} minute(s).`;
  }
  return null;
}

async function handlePinFailure(user: any) {
  user.pinRetries = (user.pinRetries || 0) + 1;
  if (user.pinRetries >= 3) {
    user.pinRetries = 0;
    user.pinLockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  }
  await user.save();
}

async function resetPinRetries(user: any) {
  if (user.pinRetries || user.pinLockedUntil) {
    user.pinRetries = 0;
    user.pinLockedUntil = null;
    await user.save();
  }
}

async function estimateFeeHBAR(fromPk: string, tx: any): Promise<string> {
  const wallet = new Wallet(fromPk, provider);
  const gas = await wallet.estimateGas(tx);
  const feeData = await provider.getFeeData();
  const price = (feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n);
  if (!price) return "0";
  const feeWei = gas * price;
  return formatEther(feeWei);
}


function toUnits(amountStr: string, decimals: number): bigint {
  const [w, fRaw = ""] = String(amountStr).split(".");
  const wStr = w || "0";
  const f = (fRaw + "0".repeat(decimals)).slice(0, decimals) || "0";
  return BigInt(wStr) * (10n ** BigInt(decimals)) + BigInt(f);
}


const app = express();

const responseEmitter = new EventEmitter();

// Add PIN to User model first
interface MenuState {
    level: number;
    action?: string;
    pin?: string;
}


  // Helper to wrap async route handlers
  const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default async function smsServer(): Promise<void> {
  await connectDB();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));


  //ussd route
  app.post("/new-ussd", asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber, text } = req.body;

    console.log("new ussd", req.body);
    //only split the text if it contains the *
    let textArray = [];
    if (text?.includes('*')) {
        textArray = text.split('*');
    } else {
        textArray = [text];
    }


    const level = textArray.length;
    const currentInput = textArray[textArray.length - 1];

    try {
        let user = await User.findOne({ phoneNumber });

        // Main menu - remove balance option
        if (text === "") {
            let response = "CON Welcome to DeXa USSD\n";
            response += "1. Create Account\n";
            response += "2. View Private Key\n";
            response += "3. Set PIN\n";
            response += "4. Delete Account\n";
            response += "5. Check Balance\n";
            response += "6. Send HBAR\n";
            response += "7. Tx History\n";
            response += "8. Token Associate\n";
            response += "9. Token Transfer";
            return res.send(response);
        }

        // Handle menu options
        switch(textArray[0]) {
            case "1": // Create Account
                if (!user) {
                    const newWallet = Wallet.createRandom();
                    const privateKeyHex = newWallet.privateKey;


                    if (level === 1) {
                        return res.send("CON Enter a PIN for your account (4 digits):");
                    } else if (level === 2) {
                        if (!/^\d{4}$/.test(currentInput)) {
                            return res.send("END Invalid PIN. Please try again with 4 digits.");
                        }
                        user = new User({
                            phoneNumber,
                            privateKey: privateKeyHex,
                            publicKey: newWallet.address,
                            pin: currentInput
                        });
                        await user.save();
                        return res.send("END Account created successfully! Fund your wallet on Hedera Testnet (HBAR)");
                    }
                } else {
                    return res.send("END Account already exists!");
                }
                break;

            case "2": // View Private Key
                if (!user) {
                    return res.send("END Please create an account first");
                }
                if (level === 1) {
                    const lockedMsg = await isLocked(user);
                    if (lockedMsg) return res.send(lockedMsg);
                    return res.send("CON Enter your PIN:");
                } else if (level === 2) {
                    if (currentInput !== user.pin) {
                        await handlePinFailure(user);
                        return res.send("END Invalid PIN");
                    }
                    await resetPinRetries(user);
                    // Send private key via SMS for security
                    await africastalking.SMS.send({
                        to: phoneNumber,
                        message: `Your private key is: ${user.privateKey}`,
                        from: process.env.AFRICASTALKING_SENDER_ID as string
                    });
                    return res.send("END Your private key has been sent via SMS");
                }
                break;

            case "3": // Set PIN
                if (!user) {
                    return res.send("END Please create an account first");
                }
                if (level === 1) {
                    const lockedMsg = await isLocked(user);
                    if (lockedMsg) return res.send(lockedMsg);
                    return res.send("CON Enter your current PIN:");
                } else if (level === 2) {
                    if (currentInput !== user.pin) {
                        await handlePinFailure(user);
                        return res.send("END Invalid PIN");
                    }
                    await resetPinRetries(user);
                    return res.send("CON Enter new PIN (4 digits):");
                } else if (level === 3) {
                    if (!/^\d{4}$/.test(currentInput)) {
                        return res.send("END Invalid PIN format. Use 4 digits.");
                    }
                    user.pin = currentInput;
                    await user.save();
                    return res.send("END PIN updated successfully!");
                }
                break;

            case "4": // Delete Account
                if (!user) {
                    return res.send("END No account to delete");
                }
                if (level === 1) {
                    const lockedMsg = await isLocked(user);
                    if (lockedMsg) return res.send(lockedMsg);
                    return res.send("CON Enter PIN to confirm account deletion:");
                } else if (level === 2) {
                    if (currentInput !== user.pin) {
                        await handlePinFailure(user);
                        return res.send("END Invalid PIN");
                    }
                    await resetPinRetries(user);
                    await User.deleteOne({ phoneNumber });
                    return res.send("END Account deleted successfully");
                }
                break;

            case "5": // Check Balance
                if (!user) {
                    return res.send("END Please create an account first");
                }
                try {
                    const balanceWei = await provider.getBalance(user.publicKey);
                    const balanceHBAR = formatEther(balanceWei);

                    // Send SMS with balance as well
                    await africastalking.SMS.send({
                        to: phoneNumber,
                        message: `HBAR Balance\nAddress: ${user.publicKey}\nBalance: ${balanceHBAR} HBAR`,
                        from: process.env.AFRICASTALKING_SENDER_ID as string
                    });

                    return res.send(`END Address: ${user.publicKey}\nBalance: ${balanceHBAR} HBAR`);
                } catch (e) {
                    console.error("Balance check error", e);
                    return res.send("END Failed to fetch balance. Please try again later.");
                }

                case "7": { // Tx History (last 5)
                    if (!user) return res.send("END Please create an account first");
                    const last = await Transaction.find({ phoneNumber }).sort({ createdAt: -1 }).limit(5);
                    if (!last.length) return res.send("END No transactions yet");
                    const lines = last.map(t => {
                      if (t.type === 'hbar_send') return `HBAR -> ${t.to} ${t.amount}`;
                      if (t.type === 'fund') return `FUND +${t.amount} HBAR`;
                      if (t.type === 'token_transfer') return `${t.tokenSymbol || 'TOKEN'} -> ${t.to} ${t.amount}`;
                      if (t.type === 'token_associate') return `ASSOC ${t.tokenAddress?.slice(0,10)}...`;
                      return t.type;
                    });
                    return res.send(`END Last Tx:\n${lines.join('\n')}`);
                }

                case "8": { // Token Associate (PIN -> token)
                    if (!user) return res.send("END Please create an account first");
                    if (level === 1) {
                        const lockedMsg = await isLocked(user);
                        if (lockedMsg) return res.send(lockedMsg);
                        return res.send("CON Enter your PIN:");
                    } else if (level === 2) {
                        const pinInput = textArray[1];
                        if (pinInput !== user.pin) { await handlePinFailure(user); return res.send("END Invalid PIN"); }
                        await resetPinRetries(user);
                        return res.send("CON Enter token contract address (0x...):");
                    } else if (level === 3) {
                        const tokenAddr = textArray[2];
                        if (!isAddress(tokenAddr)) return res.send("END Invalid token address");
                        try {
                            const wallet = new Wallet(user.privateKey, provider);
                            const hts = new Contract(HTS_PRECOMPILE, HTS_ABI, wallet);
                            const gas = await (hts as any).associateToken.estimateGas(user.publicKey, tokenAddr);
                            const fd = await provider.getFeeData();
                            const price = (fd.maxFeePerGas ?? fd.gasPrice ?? 0n);
                            const fee = formatEther(gas * price);
                            return res.send(`CON Associate Token?\nToken: ${tokenAddr}\nEst. Fee: ${fee} HBAR\n1. Confirm\n0. Cancel`);
                        } catch(e) {
                            console.error('assoc estimate err', e);
                            return res.send("END Failed to estimate fee");
                        }
                    } else if (level === 4) {
                        const tokenAddr = textArray[2];
                        const confirm = textArray[3];
                        if (confirm !== '1') return res.send("END Cancelled");
                        try {
                            const wallet = new Wallet(user.privateKey, provider);
                            const hts = new Contract(HTS_PRECOMPILE, HTS_ABI, wallet);
                            const tx = await hts.associateToken(user.publicKey, tokenAddr);
                            const receipt = await tx.wait();
                            await Transaction.create({ phoneNumber, type: 'token_associate', from: user.publicKey, tokenAddress: tokenAddr, status: (receipt?.status===1||receipt===null)?'success':'pending', chainId: CHAIN_ID });
                            return res.send(`END Token associated. Tx: ${tx.hash}`);
                        } catch(e:any) {
                            console.error('associate error', e);
                            return res.send(`END Failed: ${e?.message||'Unknown error'}`);
                        }
                    }
                    break;
                }

                case "9": { // Token Transfer (PIN -> token -> to -> amount -> confirm)
                    if (!user) return res.send("END Please create an account first");
                    if (level === 1) {
                        const lockedMsg = await isLocked(user);
                        if (lockedMsg) return res.send(lockedMsg);
                        return res.send("CON Enter your PIN:");
                    } else if (level === 2) {
                        const pinInput = textArray[1];
                        if (pinInput !== user.pin) { await handlePinFailure(user); return res.send("END Invalid PIN"); }
                        await resetPinRetries(user);
                        return res.send("CON Enter token contract address (0x...):");
                    } else if (level === 3) {
                        const tokenAddr = textArray[2];
                        if (!isAddress(tokenAddr)) return res.send("END Invalid token address");
                        return res.send("CON Enter recipient EVM address (0x...):");
                    } else if (level === 4) {
                        const tokenAddr = textArray[2];
                        const toAddr = textArray[3];
                        if (!isAddress(toAddr)) return res.send("END Invalid recipient address");
                        return res.send("CON Enter amount (token units, e.g., 1.5):");
                    } else if (level === 5) {
                        const tokenAddr = textArray[2];
                        const toAddr = textArray[3];
                        const amountStr = textArray[4];
                        if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) return res.send("END Invalid amount");
                        try {
                            const wallet = new Wallet(user.privateKey, provider);
                            const erc20 = new Contract(tokenAddr, ERC20_ABI, wallet);
                            const decimals = Number(await erc20.decimals());
                            const symbol: string = await erc20.symbol().catch(()=>'TOKEN');
                            const value = toUnits(amountStr, decimals);
                            const gas = await (erc20 as any).transfer.estimateGas(toAddr, value);
                            const fd = await provider.getFeeData();
                            const price = (fd.maxFeePerGas ?? fd.gasPrice ?? 0n);
                            const fee = formatEther(gas * price);
                            return res.send(`CON Confirm Token Transfer\nToken: ${symbol}\nTo: ${toAddr}\nAmount: ${amountStr}\nEst. Fee: ${fee} HBAR\n1. Confirm\n0. Cancel`);
                        } catch(e) {
                            console.error('token estimate err', e);
                            return res.send("END Failed to estimate fee");
                        }
                    } else if (level === 6) {
                        const tokenAddr = textArray[2];
                        const toAddr = textArray[3];
                        const amountStr = textArray[4];
                        const confirm = textArray[5];
                        if (confirm !== '1') return res.send("END Cancelled");
                        try {
                            const wallet = new Wallet(user.privateKey, provider);
                            const erc20 = new Contract(tokenAddr, ERC20_ABI, wallet);
                            const decimals = Number(await erc20.decimals());
                            const symbol: string = await erc20.symbol().catch(()=>'TOKEN');
                            const value = toUnits(amountStr, decimals);
                            const tx = await erc20.transfer(toAddr, value);
                            const receipt = await tx.wait();
                            await Transaction.create({ phoneNumber, type: 'token_transfer', from: user.publicKey, to: toAddr, tokenAddress: tokenAddr, tokenSymbol: symbol, amount: amountStr, amountRaw: value.toString(), txHash: tx.hash, status: (receipt?.status===1||receipt===null)?'success':'pending', chainId: CHAIN_ID });
                            return res.send(`END Token transfer submitted. Tx: ${tx.hash}`);
                        } catch(e:any) {
                            console.error('token transfer error', e);
                            return res.send(`END Failed: ${e?.message||'Unknown error'}`);
                        }
                    }
                    break;
                }

            case "6": // Send HBAR
                if (!user) {
                    return res.send("END Please create an account first");
                }
                if (level === 1) {
                    const lockedMsg = await isLocked(user);
                    if (lockedMsg) return res.send(lockedMsg);
                    return res.send("CON Enter your PIN:");
                } else if (level === 2) {
                    const pinInput = textArray[1];
                    if (pinInput !== user.pin) {
                        await handlePinFailure(user);
                        return res.send("END Invalid PIN");
                    }
                    await resetPinRetries(user);
                    return res.send("CON Enter recipient EVM address (0x...):");
                } else if (level === 3) {
                    const addressInput = textArray[2];
                    if (!isAddress(addressInput)) {
                        return res.send("END Invalid address format. Must be 0x + 40 hex chars.");
                    }
                    return res.send("CON Enter amount in HBAR (e.g., 0.01):");
                } else if (level === 4) {
                    const pinInput = textArray[1];
                    const addressInput = textArray[2];
                    const amountInput = textArray[3];
                    if (pinInput !== user.pin) {
                        await handlePinFailure(user);
                        return res.send("END Invalid PIN");
                    }
                    if (!isAddress(addressInput)) {
                        return res.send("END Invalid address format.");
                    }

                    if (!amountInput || isNaN(Number(amountInput)) || Number(amountInput) <= 0) {
                        return res.send("END Invalid amount.");
                    }
                    // fee preview and confirm
                    try {
                        const sender = new Wallet(user.privateKey, provider);
                        const fee = await estimateFeeHBAR(user.privateKey, { to: addressInput, value: parseEther(amountInput) });
                        return res.send(`CON Confirm Send\nTo: ${addressInput}\nAmount: ${amountInput} HBAR\nEst. Fee: ${fee} HBAR\n1. Confirm\n0. Cancel`);
                    } catch (e: any) {
                        console.error("Estimate fee error", e);
                        return res.send("END Failed to estimate fee.");
                    }
                } else if (level === 5) {
                    const pinInput = textArray[1];
                    const addressInput = textArray[2];
                    const amountInput = textArray[3];
                    const confirm = textArray[4];
                    if (confirm !== '1') return res.send("END Cancelled");
                    try {
                        const sender = new Wallet(user.privateKey, provider);
                        const tx = await sender.sendTransaction({ to: addressInput, value: parseEther(amountInput) });
                        const receipt = await tx.wait();

                        // Log transaction
                        await Transaction.create({
                          phoneNumber,
                          type: 'hbar_send',
                          from: user.publicKey,
                          to: addressInput,
                          amount: amountInput,
                          amountRaw: parseEther(amountInput).toString(),
                          txHash: tx.hash,
                          status: receipt?.status === 1 || receipt === null ? 'success' : 'pending',
                          chainId: CHAIN_ID,
                          tokenAddress: null,
                          tokenSymbol: 'HBAR'
                        });

                        // Notify via SMS
                        await africastalking.SMS.send({
                            to: phoneNumber,
                            message: `HBAR Transfer\nTo: ${addressInput}\nAmount: ${amountInput} HBAR\nTx: ${tx.hash}`,
                            from: process.env.AFRICASTALKING_SENDER_ID as string
                        });

                        if (receipt?.status === 1 || receipt === null) {
                            return res.send(`END Success! Sent ${amountInput} HBAR. Tx: ${tx.hash}`);
                        }
                        return res.send(`END Submitted. Tx: ${tx.hash}`);
                    } catch (e: any) {
                        console.error("Send HBAR error", e);
                        return res.send(`END Failed: ${e?.message || "Unknown error"}`);
                    }
                }
                break;



            default:
                return res.send("END Invalid option");
        }
    } catch (error) {
        console.error("Error:", error);
        return res.send("END An error occurred. Please try again.");
    }
  }));

  app.post("/notifications", async (req, res) => {
    console.log("notifications have come in", req.body);
  });

  // Get HBAR balance for the user's EVM address
  app.get("/balance/:phoneNumber", asyncHandler(async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.params;
      const user = await User.findOne({ phoneNumber });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const address = user.publicKey;
      const balanceWei = await provider.getBalance(address);
      const balanceHBAR = formatEther(balanceWei);
      return res.json({ address, chainId: CHAIN_ID, token: "HBAR", balance: balanceHBAR });
    } catch (err) {
      console.error("/balance error", err);
      return res.status(500).json({ error: "Failed to fetch balance" });
    }
  }));

  // Optional: fund user from a configured faucet/funder private key
  app.post("/fund", asyncHandler(async (req: Request, res: Response) => {
    try {
      const { phoneNumber, amount } = req.body as { phoneNumber: string; amount?: string };
      if (!phoneNumber) return res.status(400).json({ error: "phoneNumber is required" });

      const FUNDER_KEY = process.env.HEDERA_FUNDER_PRIVATE_KEY;
      if (!FUNDER_KEY) {
        return res.status(400).json({ error: "Funding not configured. Set HEDERA_FUNDER_PRIVATE_KEY in env." });
      }

      const user = await User.findOne({ phoneNumber });
      if (!user) return res.status(404).json({ error: "User not found" });

      const funder = new Wallet(FUNDER_KEY, provider);
      const value = parseEther(amount || "5"); // default 5 HBAR

      const tx = await funder.sendTransaction({ to: user.publicKey, value });
      const receipt = await tx.wait();
      await Transaction.create({ phoneNumber, type: 'fund', from: await funder.getAddress(), to: user.publicKey, amount: (amount||'5'), amountRaw: value.toString(), txHash: tx.hash, status: (receipt?.status===1||receipt===null)?'success':'pending', chainId: CHAIN_ID, tokenSymbol: 'HBAR' });
      return res.json({ hash: tx.hash, status: receipt?.status, to: user.publicKey, amount: amount || "5" });
    } catch (err) {
      console.error("/fund error", err);
      return res.status(500).json({ error: "Funding failed" });
    }
  }));


  //route to reset the database
  app.get("/reset-db", async (req, res) => {
    await User.deleteMany();
    res.send("Database reset");
  });


  app.post("/new-message", asyncHandler(async (req: Request, res: Response) => {
    try {
      console.log("new message", req.body);
      const phoneNumber = req.body.from;

      // Check if user exists
      let user = await User.findOne({ phoneNumber });

      if (!user) {
        // Send setup instructions via SMS
        await africastalking.SMS.send({
          to: phoneNumber,
          message: `Welcome to DeXa USSD! To get started:
1. Dial *483*1# to access the USSD menu
2. Select option 1 to create your account
3. Set up your 4-digit PIN
4. Once complete, you can start sending SMS queries
`,
          from: process.env.AFRICASTALKING_SENDER_ID as string
        });
        return res.status(200).json({ message: "Setup instructions sent" });
      }

      // Initialize agent with user's private key
      const responseText = `DeXa USSD (Hedera Testnet)\nAddress: ${user.publicKey}\nChain ID: 296\nToken: HBAR`;

      await africastalking.SMS.send({
        to: phoneNumber,
        message: responseText,
        from: process.env.AFRICASTALKING_SENDER_ID as string,
      });





      return res.status(200).json({ message: "Message processed" });
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }));

  // REST endpoint to transfer HBAR (requires PIN)
  app.post("/transfer", asyncHandler(async (req: Request, res: Response) => {
    try {
      const { phoneNumber, pin, to, amount } = req.body as { phoneNumber: string; pin: string; to: string; amount: string };
      if (!phoneNumber || !pin || !to || !amount) return res.status(400).json({ error: "phoneNumber, pin, to, amount required" });

      const user = await User.findOne({ phoneNumber });
      if (!user) return res.status(404).json({ error: "User not found" });
      if (pin !== user.pin) return res.status(403).json({ error: "Invalid PIN" });
      if (!isAddress(to)) return res.status(400).json({ error: "Invalid recipient address" });

      const value = parseEther(amount);
      const sender = new Wallet(user.privateKey, provider);
      const tx = await sender.sendTransaction({ to, value });
      const receipt = await tx.wait();
      await Transaction.create({ phoneNumber, type: 'hbar_send', from: user.publicKey, to, amount, amountRaw: value.toString(), txHash: tx.hash, status: (receipt?.status===1||receipt===null)?'success':'pending', chainId: CHAIN_ID, tokenSymbol: 'HBAR' });
      return res.json({ hash: tx.hash, status: receipt?.status ?? null });
    } catch (e: any) {
      console.error("/transfer error", e);
      return res.status(500).json({ error: e?.message || "Transfer failed" });
    }
  }));


  const port = process.env.PORT || 3013;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
