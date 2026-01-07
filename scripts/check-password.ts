import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { resolvePasswordHash, resolvePasswordValue } from './utils/password'
import { logError } from '../lib/logger'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'manager@callwork.com' },
    select: {
      id: true,
      email: true,
      name: true,
      password: true
    }
  })

  if (!user) {
    logError('User not found')
    return
  }

  console.log(`User: ${user.name}`)
  console.log(`Email: ${user.email}\n`)

  // Test password
  const testPassword = resolvePasswordValue({
    label: 'check password',
    envVar: 'CHECK_PASSWORD',
    fallbackEnvVar: 'SEED_PASSWORD',
  })
  const isMatch = await bcrypt.compare(testPassword, user.password)

  console.log(`Match: ${isMatch ? '✓ YES' : '✗ NO'}`)

  if (!isMatch) {
    const shouldReset = Boolean(process.env.RESET_PASSWORD || process.env.RESET_PASSWORD_HASH)
    if (!shouldReset) {
      console.log('Set RESET_PASSWORD or RESET_PASSWORD_HASH to reset the password.')
      return
    }

    console.log('\n⚠️  Password mismatch! Resetting to RESET_PASSWORD...')
    const hashedPassword = await resolvePasswordHash({
      label: 'reset password',
      envVar: 'RESET_PASSWORD',
      hashEnvVar: 'RESET_PASSWORD_HASH',
      fallbackEnvVar: 'CHECK_PASSWORD',
      fallbackHashEnvVar: 'CHECK_PASSWORD_HASH',
    })
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })
    console.log('✓ Password reset successfully!')
  }
}

main()
  .catch((error) => logError(error))
  .finally(() => prisma.$disconnect())
