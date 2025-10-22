import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  TWILIO_ACCOUNT_SID: z.string().min(10),
  TWILIO_AUTH_TOKEN: z.string().min(10),
  TWILIO_WHATSAPP_NUMBER: z.string().regex(/^whatsapp:\+/i, {
    message: 'Must include whatsapp:+ prefix',
  }),
  // Hedera EVM configuration
  HEDERA_RPC: z.string().url().default('https://testnet.hashio.io/api'),
  HEDERA_CHAIN_ID: z.coerce.number().int().positive().default(296),
  // Deployed Smart Contract Addresses (EVM)
  USER_REGISTRY_ADDRESS: z.string().default('0x0000000000000000000000000000000000000000'),
  ENCRYPTION_SECRET: z.string().min(32, {
    message: 'Provide a strong secret (>=32 characters)',
  }),
  SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  CONFIRMATION_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),
  WEBHOOK_URL: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === 'production';
