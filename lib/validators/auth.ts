import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[A-Z]/, 'Пароль должен содержать заглавную букву')
  .regex(/[0-9]/, 'Пароль должен содержать цифру')
  .regex(/[^A-Za-z0-9]/, 'Пароль должен содержать спецсимвол')
