import { useRef, useEffect, type RefObject } from 'react'
import { subscribeRaf } from '@/lib/rafScheduler'

export function useAnimatedValue(
  target: number,
  duration: number = 1000,
  elementRef: RefObject<HTMLElement | null>,
  formatter: (value: number) => string = String
) {
  const startValue = useRef(target)
  const previousTarget = useRef(target)
  const startTime = useRef<number | null>(null)

  useEffect(() => {
    startValue.current = previousTarget.current
    previousTarget.current = target
    startTime.current = null

    const unsubscribe = subscribeRaf((timestamp) => {
      if (!elementRef.current) return

      if (startTime.current === null) {
        startTime.current = timestamp
      }

      const elapsed = timestamp - startTime.current
      const progress = Math.min(elapsed / duration, 1)

      // Easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startValue.current + (target - startValue.current) * eased

      elementRef.current.textContent = formatter(Math.round(current))
    })

    return unsubscribe
  }, [target, duration, elementRef, formatter])
}
