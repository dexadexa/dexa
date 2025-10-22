import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    phoneNumber: string;
    privateKey: string;
    publicKey: string;
    pin: string;
    createdAt: Date;
    pinRetries: number;
    pinLockedUntil: Date | null;
}

const UserSchema: Schema = new Schema({
    phoneNumber: { type: String, required: true, unique: true },
    privateKey: { type: String, required: true },
    publicKey: { type: String, required: true },
    pin: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    pinRetries: { type: Number, default: 0 },
    pinLockedUntil: { type: Date, default: null }
});

export default mongoose.model<IUser>('User', UserSchema);