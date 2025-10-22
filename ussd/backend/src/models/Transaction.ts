import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  phoneNumber: string;
  type: 'fund' | 'hbar_send' | 'token_associate' | 'token_transfer';
  from?: string;
  to?: string;
  tokenAddress?: string | null;
  tokenSymbol?: string | null;
  amount?: string | null; // human-readable
  amountRaw?: string | null; // wei/base units
  txHash?: string | null;
  status: 'pending' | 'success' | 'failed';
  chainId: number;
  createdAt: Date;
}

const TransactionSchema: Schema = new Schema({
  phoneNumber: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['fund','hbar_send','token_associate','token_transfer'] },
  from: { type: String },
  to: { type: String },
  tokenAddress: { type: String, default: null },
  tokenSymbol: { type: String, default: null },
  amount: { type: String, default: null },
  amountRaw: { type: String, default: null },
  txHash: { type: String, default: null },
  status: { type: String, required: true, enum: ['pending','success','failed'], default: 'pending' },
  chainId: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);

