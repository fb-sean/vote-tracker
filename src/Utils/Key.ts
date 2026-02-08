import crypto from 'crypto';

export function generateKey() {
    return crypto.randomBytes(64).toString('hex');
}