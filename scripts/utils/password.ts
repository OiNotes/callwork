import bcrypt from 'bcryptjs'

interface ResolvePasswordOptions {
  label?: string
  envVar?: string
  hashEnvVar?: string
  fallbackEnvVar?: string
  fallbackHashEnvVar?: string
  saltRounds?: number
}

export function resolvePasswordValue(options: ResolvePasswordOptions = {}): string {
  const {
    label = 'password',
    envVar = 'SEED_PASSWORD',
    fallbackEnvVar = 'SEED_PASSWORD',
  } = options

  const raw = process.env[envVar] || process.env[fallbackEnvVar]
  if (!raw) {
    throw new Error(`Missing ${label}. Set ${envVar} or ${fallbackEnvVar}.`)
  }

  return raw
}

export async function resolvePasswordHash(options: ResolvePasswordOptions = {}): Promise<string> {
  const {
    label = 'password',
    envVar = 'SEED_PASSWORD',
    hashEnvVar = 'SEED_PASSWORD_HASH',
    fallbackEnvVar = 'SEED_PASSWORD',
    fallbackHashEnvVar = 'SEED_PASSWORD_HASH',
    saltRounds = 10,
  } = options

  const existingHash = process.env[hashEnvVar] || process.env[fallbackHashEnvVar]
  if (existingHash) {
    return existingHash
  }

  const raw = resolvePasswordValue({ label, envVar, fallbackEnvVar })
  return bcrypt.hash(raw, saltRounds)
}
