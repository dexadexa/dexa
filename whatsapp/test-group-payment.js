const isHedera = true;
const DexaWhatsAppService = (await import('./HederaService.js')).default;



async function runGroupPaymentTest() {
    if (isHedera) {
        const svc = new DexaWhatsAppService();
        try {
            // Accounts
            const alice = await svc.createAccount();
            const bob = await svc.createAccount();
            const charlie = await svc.createAccount();

            // Fund accounts (tinybar)
            await svc.fundAccount(alice.address, 300_000_000n);
            await svc.fundAccount(bob.address, 200_000_000n);
            await svc.fundAccount(charlie.address, 200_000_000n);
            await svc.sleep(1);

            // Register stub users
            const t = Date.now();
            const phones = {
                alice: `+91 90000 ${t % 10000}1`,
                bob: `+91 90000 ${t % 10000}2`,
                charlie: `+91 90000 ${t % 10000}3`
            };
            const reg = {
                alice: await svc.registerUser(phones.alice, alice.address),
                bob: await svc.registerUser(phones.bob, bob.address),
                charlie: await svc.registerUser(phones.charlie, charlie.address)
            };
            await svc.sleep(1);

            // Initial balances
            const init = {
                alice: await svc.getAccountBalance(alice.address),
                bob: await svc.getAccountBalance(bob.address),
                charlie: await svc.getAccountBalance(charlie.address)
            };

            // Create group & add members
            const group = await svc.createGroup(alice.privateKey, "Trip to Goa");
            const addBob = await svc.addMemberToGroup(alice.privateKey, group.groupId, bob.address);
            const addCharlie = await svc.addMemberToGroup(alice.privateKey, group.groupId, charlie.address);

            // Add an expense (Alice pays 1.5 HBAR)
            const expense = await svc.addGroupExpense(
                alice.privateKey,
                group.groupId,
                150_000_000n,
                "Hotel booking - 1 night",
                [alice.address, bob.address, charlie.address]
            );
            await svc.sleep(1);

            // Settlement (stub)
            const settlement = await svc.executeOptimalSettlement(alice.privateKey, group.groupId);
            await svc.sleep(1);

            const fin = {
                alice: await svc.getAccountBalance(alice.address),
                bob: await svc.getAccountBalance(bob.address),
                charlie: await svc.getAccountBalance(charlie.address)
            };

            return {
                network: "hedera",
                group: {
                    id: group.groupId,
                    name: "Trip to Goa",
                    members: [alice.address, bob.address, charlie.address]
                },
                expenses: [{
                    payer: alice.address,
                    amount: 1.5,
                    description: "Hotel booking - 1 night",
                    participants: 3
                }],
                balances: {
                    alice: { initial: svc.weiToHbarNumber(init.alice), final: svc.weiToHbarNumber(fin.alice) },
                    bob: { initial: svc.weiToHbarNumber(init.bob), final: svc.weiToHbarNumber(fin.bob) },
                    charlie: { initial: svc.weiToHbarNumber(init.charlie), final: svc.weiToHbarNumber(fin.charlie) }
                },
                transactions: {
                    registration: { alice: reg.alice.hash, bob: reg.bob.hash, charlie: reg.charlie.hash },
                    group: {
                        create: group.hash,
                        addBob: addBob.hash,
                        addCharlie: addCharlie.hash,
                        addExpense: expense.hash,
                        settlement: settlement.hash,
                        explorerLink: `https://hashscan.io/testnet/transaction/${settlement.hash}`
                    }
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return { error: error.message, network: "hedera", timestamp: new Date().toISOString() };
        }
    }


// Export for module usage
export { runGroupPaymentTest };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log("Running Group Payment Test...");
    runGroupPaymentTest()
        .then(result => {
            console.log("Group Test Results:");
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(error => {
            console.error("Group Test Failed:", error);
        });
}