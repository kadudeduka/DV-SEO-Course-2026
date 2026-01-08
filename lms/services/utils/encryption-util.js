/**
 * Encryption Utility
 * 
 * Provides encryption/decryption functions for sensitive data like OAuth tokens.
 * Uses AES-256-GCM encryption for security.
 * 
 * Note: In browser environments, this uses Web Crypto API.
 * In Node.js environments, this uses built-in crypto module.
 */

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {string} key - Encryption key (32 bytes or will be derived)
 * @returns {Promise<string>} Encrypted data (hex encoded)
 */
export async function encrypt(plaintext, key) {
    if (!plaintext) return null;
    if (!key) throw new Error('Encryption key is required');

    // Browser environment - use Web Crypto API
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        return await encryptBrowser(plaintext, key);
    }
    
    // Node.js environment - use built-in crypto
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        return encryptNode(plaintext, key);
    }
    
    throw new Error('Encryption not supported in this environment');
}

/**
 * Decrypt data using AES-256-GCM
 * @param {string} ciphertext - Encrypted data (hex encoded)
 * @param {string} key - Encryption key
 * @returns {Promise<string>} Decrypted data
 */
export async function decrypt(ciphertext, key) {
    if (!ciphertext) return null;
    if (!key) throw new Error('Encryption key is required');

    // Browser environment - use Web Crypto API
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        return await decryptBrowser(ciphertext, key);
    }
    
    // Node.js environment - use built-in crypto
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        return decryptNode(ciphertext, key);
    }
    
    throw new Error('Decryption not supported in this environment');
}

/**
 * Browser encryption using Web Crypto API
 */
async function encryptBrowser(plaintext, keyString) {
    try {
        // Derive key from string using PBKDF2
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(keyString),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );
        
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const plaintextBytes = encoder.encode(plaintext);
        
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            derivedKey,
            plaintextBytes
        );
        
        // Combine salt + iv + ciphertext
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);
        
        // Convert to hex string for storage
        return Array.from(combined)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    } catch (error) {
        console.error('[EncryptionUtil] Browser encryption error:', error);
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Browser decryption using Web Crypto API
 */
async function decryptBrowser(ciphertextHex, keyString) {
    try {
        // Convert hex to bytes
        const ciphertext = new Uint8Array(
            ciphertextHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
        );
        
        // Extract salt, iv, and actual ciphertext
        const salt = ciphertext.slice(0, 16);
        const iv = ciphertext.slice(16, 28);
        const encrypted = ciphertext.slice(28);
        
        // Derive key
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(keyString),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        
        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        
        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            derivedKey,
            encrypted
        );
        
        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.error('[EncryptionUtil] Browser decryption error:', error);
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

/**
 * Node.js encryption using built-in crypto module
 */
function encryptNode(plaintext, keyString) {
    const crypto = require('crypto');
    
    try {
        // Generate random salt and IV
        const salt = crypto.randomBytes(16);
        const iv = crypto.randomBytes(12);
        
        // Derive key using PBKDF2
        const key = crypto.pbkdf2Sync(keyString, salt, 100000, 32, 'sha256');
        
        // Create cipher
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        // Encrypt
        let encrypted = cipher.update(plaintext, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // Get auth tag
        const authTag = cipher.getAuthTag();
        
        // Combine salt + iv + authTag + ciphertext
        const combined = Buffer.concat([salt, iv, authTag, encrypted]);
        
        // Return as hex string
        return combined.toString('hex');
    } catch (error) {
        console.error('[EncryptionUtil] Node.js encryption error:', error);
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

/**
 * Node.js decryption using built-in crypto module
 */
function decryptNode(ciphertextHex, keyString) {
    const crypto = require('crypto');
    
    try {
        // Convert hex to buffer
        const ciphertext = Buffer.from(ciphertextHex, 'hex');
        
        // Extract components
        const salt = ciphertext.slice(0, 16);
        const iv = ciphertext.slice(16, 28);
        const authTag = ciphertext.slice(28, 44);
        const encrypted = ciphertext.slice(44);
        
        // Derive key
        const key = crypto.pbkdf2Sync(keyString, salt, 100000, 32, 'sha256');
        
        // Create decipher
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        
        // Decrypt
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString('utf8');
    } catch (error) {
        console.error('[EncryptionUtil] Node.js decryption error:', error);
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

