'use client'

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

export type CardVariant = 'default' | 'glass' | 'outlined' | 'elevated'

// Omit event handlers that conflict with Framer Motion
type BaseCardProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
>

export interface CardProps extends BaseCardProps {
  variant?: CardVariant
  interactive?: boolean
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-[var(--card)] shadow-[var(--shadow-sm)]',
  glass: 'bg-[var(--card)]/80 backdrop-blur-md shadow-[var(--shadow-md)]',
  outlined: 'bg-transparent border border-[var(--border)]',
  elevated: 'bg-[var(--card)] shadow-[var(--shadow-lg)]',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', interactive = false, className, children, onClick, ...props }, ref) => {
    const Comp = interactive ? motion.div : 'div'

    return (
      <Comp
        ref={ref}
        className={cn(
          'rounded-[var(--radius-lg)] p-4 md:p-6',
          'text-[var(--card-foreground)]',
          variantStyles[variant],
          interactive && 'cursor-pointer',
          className
        )}
        onClick={onClick}
        {...(interactive
          ? {
              whileHover: { scale: 1.01 },
              whileTap: { scale: 0.99 },
              transition: { type: 'spring', stiffness: 400, damping: 25 },
            }
          : {})}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        {...props}
      >
        {children}
      </Comp>
    )
  }
)

Card.displayName = 'Card'

// Compound components
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ icon, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-2 mb-3', className)}
      {...props}
    >
      {icon && <span className="text-[var(--muted-foreground)]">{icon}</span>}
      <h3 className="font-semibold text-[var(--foreground)]">{children}</h3>
    </div>
  )
)

CardHeader.displayName = 'CardHeader'

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  )
)

CardContent.displayName = 'CardContent'

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border)]', className)}
      {...props}
    />
  )
)

CardFooter.displayName = 'CardFooter'

export default Card
