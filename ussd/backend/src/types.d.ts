declare namespace NodeJS {
    interface ProcessEnv {
        PORT?: string;
        AFRICASTALKING_API_KEY: string;
        AFRICASTALKING_USERNAME: string;
        AFRICASTALKING_SENDER_ID: string;
        HEDERA_RPC_URL?: string; // default: https://testnet.hashio.io/api
        HEDERA_CHAIN_ID?: string; // default: 296
    }
}