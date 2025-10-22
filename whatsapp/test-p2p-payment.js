const isHedera = true;
const DexaWhatsAppService = (await import('./HederaService.js')).default;



async function runP2PPaymentTest() {
    if (isHedera) {
        const dexaWhatsAppService = new DexaWhatsAppService();
        try {
            // Create accounts
            const aliceAccount = await dexaWhatsAppService.createAccount();
            const bobAccount = await dexaWhatsAppService.createAccount();

            // Fund accounts (tinybar placeholder amounts)
            await dexaWhatsAppService.fundAccount(aliceAccount.address, 200_000_000n);
            await dexaWhatsAppService.fundAccount(bobAccount.address, 100_000_000n);
            await dexaWhatsAppService.sleep(1);

            // Register users in stub registry with unique phone numbers
            const timestamp = Date.now();
            const alicePhone = `+91 98765 ${timestamp % 10000}1`;
            const bobPhone = `+91 98765 ${timestamp % 10000}2`;
            const aliceReg = await dexaWhatsAppService.registerUser(alicePhone, aliceAccount.address);
            const bobReg = await dexaWhatsAppService.registerUser(bobPhone, bobAccount.address);
            await dexaWhatsAppService.sleep(1);

            // Initial balances
            const aliceInitialBalance = await dexaWhatsAppService.getAccountBalance(aliceAccount.address);
            const bobInitialBalance = await dexaWhatsAppService.getAccountBalance(bobAccount.address);

            // Send payment by phone (stub registry -> address, HBAR tinybar)
            const paymentExecution = await dexaWhatsAppService.sendPaymentByPhone(
                aliceAccount.privateKey,
                bobPhone,
                10_000_000n,
                "P2P Payment Test (Hedera stub)"
            );
            await dexaWhatsAppService.sleep(1);

            // Final balances
            const aliceFinalBalance = await dexaWhatsAppService.getAccountBalance(aliceAccount.address);
            const bobFinalBalance = await dexaWhatsAppService.getAccountBalance(bobAccount.address);

            return {
                network: "hedera",
                accounts: {
                    alice: {
                        address: aliceAccount.address,
                        phone: alicePhone,
                        initialBalance: dexaWhatsAppService.weiToHbarNumber(aliceInitialBalance),
                        finalBalance: dexaWhatsAppService.weiToHbarNumber(aliceFinalBalance)
                    },
                    bob: {
                        address: bobAccount.address,
                        phone: bobPhone,
                        initialBalance: dexaWhatsAppService.weiToHbarNumber(bobInitialBalance),
                        finalBalance: dexaWhatsAppService.weiToHbarNumber(bobFinalBalance)
                    }
                },
                transactions: {
                    registration: {
                        alice: aliceReg.hash,
                        bob: bobReg.hash
                    },
                    payment: {
                        execution: paymentExecution.hash,
                        amount: 0.1,
                        explorerLink: `https://hashscan.io/testnet/transaction/${paymentExecution.hash}`
                    }
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                error: error.message,
                network: "hedera",
                timestamp: new Date().toISOString()
            };
        }
    }


// Export for module usage
export { runP2PPaymentTest };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log("Running P2P Payment Test...");
    runP2PPaymentTest()
        .then(result => {
            console.log("P2P Test Results:");
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(error => {
            console.error("P2P Test Failed:", error);
        });
}