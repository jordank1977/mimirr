import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const ALGORITHM = 'aes-256-gcm'
const KEY_FILE_PATH = path.join(process.cwd(), 'config', 'encryption.key')

let encryptionKey: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (encryptionKey) {
    return encryptionKey
  }

  const configDir = path.dirname(KEY_FILE_PATH)
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }

  if (fs.existsSync(KEY_FILE_PATH)) {
    const keyHex = fs.readFileSync(KEY_FILE_PATH, 'utf8').trim()
    encryptionKey = Buffer.from(keyHex, 'hex')
  } else {
    // Generate a 32-byte hex string (64 characters)
    const newKeyHex = crypto.randomBytes(32).toString('hex')
    fs.writeFileSync(KEY_FILE_PATH, newKeyHex, 'utf8')
    encryptionKey = Buffer.from(newKeyHex, 'hex')
  }

  return encryptionKey
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param text The plaintext string to encrypt.
 * @returns The encrypted string in the format iv:authTag:cipherText.
 */
export function encrypt(text: string): string {
  if (!text) return ''

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12) // 12 bytes is standard for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let cipherText = cipher.update(text, 'utf8', 'hex')
  cipherText += cipher.final('hex')

  const authTag = cipher.getAuthTag().toString('hex')

  return `${iv.toString('hex')}:${authTag}:${cipherText}`
}

/**
 * Decrypts a ciphertext string using AES-256-GCM.
 * Returns an empty string if decryption fails (e.g., legacy plaintext).
 * @param encryptedData The encrypted string in the format iv:authTag:cipherText.
 * @returns The decrypted plaintext string, or empty string on failure.
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return ''

  try {
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format')
    }

    const [ivHex, authTagHex, cipherText] = parts
    const key = getEncryptionKey()
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let plainText = decipher.update(cipherText, 'hex', 'utf8')
    plainText += decipher.final('utf8')

    return plainText
  } catch (error) {
    // Silently swallow errors for legacy plaintext passwords
    return ''
  }
}
