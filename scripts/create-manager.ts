#!/usr/bin/env tsx
/**
 * Создание первого менеджера в системе
 *
 * Usage:
 *   npx tsx scripts/create-manager.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createManager() {
  console.log('\n👤 СОЗДАНИЕ МЕНЕДЖЕРА\n')

  const email = 'manager@callwork.com'
  const password = 'password123'
  const name = 'Менеджер Callwork'

  try {
    // Проверяем существует ли пользователь
    const existing = await prisma.user.findUnique({
      where: { email }
    })

    if (existing) {
      console.log(`⚠️  Пользователь ${email} уже существует`)
      console.log(`   ID: ${existing.id}`)
      console.log(`   Имя: ${existing.name}`)
      console.log(`   Роль: ${existing.role}`)
      console.log(`   Активен: ${existing.isActive ? '✅' : '❌'}`)
      return
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10)

    // Создаём менеджера
    const manager = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'MANAGER',
        isActive: true,
        monthlyGoal: 14000000 // 14 миллионов по умолчанию
      }
    })

    console.log('✅ Менеджер успешно создан!\n')
    console.log('=' .repeat(60))
    console.log(`Email:    ${manager.email}`)
    console.log(`Password: ${password}`)
    console.log(`Name:     ${manager.name}`)
    console.log(`Role:     ${manager.role}`)
    console.log(`Goal:     ${manager.monthlyGoal?.toString() || 'не установлена'} ₽`)
    console.log(`ID:       ${manager.id}`)
    console.log('=' .repeat(60))
    console.log('\n🔐 Используйте эти данные для входа в систему\n')

  } catch (error) {
    console.error('❌ Ошибка при создании менеджера:', error)
    throw error
  }
}

async function main() {
  await createManager()
}

main()
  .catch(error => {
    console.error('\n💥 КРИТИЧЕСКАЯ ОШИБКА:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
