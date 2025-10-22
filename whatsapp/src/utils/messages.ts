export const helpMessage = `
Welcome to DeXa Hedera Last Mile Access ⚡️

You can send HBAR directly within WhatsApp. Try these commands:
• SEND <amount> HBAR TO <phone number or contact name>
• BALANCE — Check your wallet balance
• HISTORY — View your last few payments
• EXPORT — Securely receive your wallet recovery phrase
• HELP — Show this message again

Every payment requires a confirmation. Reply YES when prompted to approve.
`;

export const unrecognisedMessage = `I didn't catch that. Reply HELP to see available commands.`;

export const confirmationPrompt = (preview: string) =>
  `About to send:
${preview}

Reply YES within 2 minutes to confirm.`;

export const confirmationExpiredMessage =
  'Confirmation timed out. Start again when you are ready.';

export const confirmationDeclinedMessage = 'Payment cancelled.';

export const walletProvisionedMessage = `Your Hedera wallet is ready. Reply HELP to explore commands.`;
