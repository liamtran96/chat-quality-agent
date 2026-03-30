import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';

/**
 * AES-256-GCM encryption service, binary-compatible with the Go backend.
 *
 * Go layout (gcm.Seal with nonce prefix):
 *   [ 12-byte nonce ][ ciphertext ][ 16-byte GCM auth tag ]
 *
 * Node's crypto module outputs ciphertext separately from the auth tag,
 * so we must manually concatenate them in the same order.
 */
@Injectable()
export class CryptoService {

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Returns Buffer: [12-byte nonce][ciphertext][16-byte tag]
   * Binary-compatible with Go's gcm.Seal(nonce, nonce, plaintext, nil).
   */
  encrypt(plaintext: Buffer, key: string): Buffer {
    const keyBuf = Buffer.from(key, 'utf8');
    if (keyBuf.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes for AES-256');
    }

    const nonce = randomBytes(12); // GCM standard nonce size
    const cipher = createCipheriv('aes-256-gcm', keyBuf, nonce);

    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag(); // 16 bytes

    // Go format: nonce + ciphertext + tag
    return Buffer.concat([nonce, encrypted, tag]);
  }

  /**
   * Decrypt AES-256-GCM ciphertext.
   * Input Buffer layout: [12-byte nonce][ciphertext][16-byte tag]
   * Binary-compatible with Go's gcm.Open.
   */
  decrypt(data: Buffer, key: string): Buffer {
    const keyBuf = Buffer.from(key, 'utf8');
    if (keyBuf.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes for AES-256');
    }

    const nonceSize = 12;
    const tagSize = 16;

    if (data.length < nonceSize + tagSize) {
      throw new Error('Ciphertext too short');
    }

    const nonce = data.subarray(0, nonceSize);
    const tag = data.subarray(data.length - tagSize);
    const ciphertext = data.subarray(nonceSize, data.length - tagSize);

    const decipher = createDecipheriv('aes-256-gcm', keyBuf, nonce);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
  }

  /** Encrypt a string and return base64-encoded result. */
  encryptToBase64(plaintext: string, key: string): string {
    const encrypted = this.encrypt(Buffer.from(plaintext, 'utf8'), key);
    return encrypted.toString('base64');
  }

  /** Decode base64 and decrypt. */
  decryptFromBase64(encoded: string, key: string): string {
    const data = Buffer.from(encoded, 'base64');
    const decrypted = this.decrypt(data, key);
    return decrypted.toString('utf8');
  }

  /** Generate a cryptographically secure random string (base64url-encoded). */
  generateRandomString(n: number): string {
    const bytes = randomBytes(n);
    return bytes.toString('base64url');
  }
}
