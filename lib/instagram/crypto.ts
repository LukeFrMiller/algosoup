import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@/lib/env'

// AES-256-GCM. ciphertext = ct || 16-byte auth tag. iv = 12 random bytes.
const key = () => Buffer.from(env('TOKEN_ENCRYPTION_KEY'), 'hex')

export function encrypt(plain: string): { ciphertext: Buffer; iv: Buffer } {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([c.update(plain, 'utf8'), c.final(), c.getAuthTag()])
  return { ciphertext, iv }
}

export function decrypt(ciphertext: Buffer, iv: Buffer): string {
  const d = createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(ciphertext.subarray(-16))
  return d.update(ciphertext.subarray(0, -16)) + d.final('utf8')
}

// Postgres bytea over PostgREST is a hex string: "\x0aff..."
export const toBytea = (b: Buffer) => '\\x' + b.toString('hex')
export const fromBytea = (s: string) => Buffer.from(s.replace(/^\\x/, ''), 'hex')

if (import.meta.main) {
  process.env.TOKEN_ENCRYPTION_KEY ??= randomBytes(32).toString('hex')
  const { ciphertext, iv } = encrypt('hello token')
  const back = decrypt(fromBytea(toBytea(ciphertext)), fromBytea(toBytea(iv)))
  if (back !== 'hello token') throw new Error('crypto round-trip failed')
  let tampered = false
  try { decrypt(Buffer.concat([Buffer.from([ciphertext[0] ^ 1]), ciphertext.subarray(1)]), iv) } catch { tampered = true }
  if (!tampered) throw new Error('tamper not detected')
  console.log('crypto ok')
}
