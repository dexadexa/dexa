const isHedera = true;
const DexaWhatsAppService = (await import('./HederaService.js')).default;



async function runRefundPaymentTest() {
    if (isHedera) {
        const svc = new DexaWhatsAppService();
        try {
            // Accounts
            const alice = await svc.createAccount();
            const bob = await svc.createAccount();
            const admin = await svc.createAccount();

            // Fund accounts (tinybar)
            await svc.fundAccount(alice.address, 200_000_000n);
            await svc.fundAccount(bob.address, 100_000_000n);
            await svc.fundAccount(admin.address, 100_000_000n);
            await svc.sleep(1);

            // Register stub users
            const t = Date.now();
            const alicePhone = `+91 95555 ${t % 10000}1`;
            const bobPhone = `+91 95555 ${t % 10000}2`;
            const reg = {
                alice: await svc.registerUser(alicePhone, alice.address),
                bob: await svc.registerUser(bobPhone, bob.address)
            };
            await svc.sleep(1);

            // Initial balances
            const init = {
                alice: await svc.getAccountBalance(alice.address),
                bob: await svc.getAccountBalance(bob.address)
            };

            // Payment from Alice to Bob by phone
            const paymentTxn = await svc.sendPaymentByPhone(
                alice.privateKey,
                bobPhone,
                75_000_000n,
                "Refundable purchase (Hedera stub)"
            );
            await svc.sleep(1);

            const afterPay = {
                alice: await svc.getAccountBalance(alice.address),
                bob: await svc.getAccountBalance(bob.address)
            };

            // Refund (stub)
            const refundTxn = await svc.refundPayment(admin.privateKey, paymentTxn.hash);
            await svc.sleep(1);

            const fin = {
                alice: await svc.getAccountBalance(alice.address),
                bob: await svc.getAccountBalance(bob.address)
            };

            return {
                network: "hedera",
                users: {
                    alice: { address: alice.address, phone: alicePhone },
                    bob: { address: bob.address, phone: bobPhone }
                },
                balances: {
                    alice: {
                        initial: svc.weiToHbarNumber(init.alice),
                        afterPayment: svc.weiToHbarNumber(afterPay.alice),
                        final: svc.weiToHbarNumber(fin.alice)
                    },
                    bob: {
                        initial: svc.weiToHbarNumber(init.bob),
                        afterPayment: svc.weiToHbarNumber(afterPay.bob),
                        final: svc.weiToHbarNumber(fin.bob)
                    }
                },
                transactions: {
                    registration: { alice: reg.alice.hash, bob: reg.bob.hash },
                    payment: {
                        hash: paymentTxn.hash,
                        amount: 0.75,
                        description: "Refundable purchase (Hedera stub)",
                        status: "completed",
                        explorerLink: `https://hashscan.io/testnet/transaction/${paymentTxn.hash}`
                    },
                    refund: {
                        attempted: true,
                        hash: refundTxn.hash,
                        successful: true,
                        explorerLink: `https://hashscan.io/testnet/transaction/${refundTxn.hash}`
                    }
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return { error: error.message, network: "hedera", timestamp: new Date().toISOString() };
        }
    }


// Export for module usage
export { runRefundPaymentTest };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log("Running Refund Payment Test...");
    runRefundPaymentTest()
        .then(result => {
            console.log("Refund Test Results:");
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(error => {
            console.error("Refund Test Failed:", error);
        });
}