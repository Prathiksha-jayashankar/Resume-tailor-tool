import { useState, useEffect, useRef } from 'react'

/**
 * Custom hook that animates a numeric value from 0 to a target using
 * requestAnimationFrame with an ease-out cubic timing function.
 *
 * - Returns integer values from 0 to target, monotonically non-decreasing
 * - Respects `prefers-reduced-motion: reduce` by returning target immediately
 * - Re-triggers animation from 0 when target changes
 * - Reads layout properties only before the animation loop begins (avoids forced reflows)
 *
 * @param target - The target value to animate to (0–100)
 * @param duration - Animation duration in milliseconds (default: 1200ms)
 * @returns The current animated integer value
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 7.5, 7.6
 */
export function useAnimatedValue(target: number, duration: number = 1200): number {
  const [current, setCurrent] = useState(0)
  const rafIdRef = useRef<number | null>(null)
  const previousValueRef = useRef(0)

  useEffect(() => {
    // Check prefers-reduced-motion before starting animation loop
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setCurrent(target)
      previousValueRef.current = target
      return
    }

    // Reset to 0 when target changes
    setCurrent(0)
    previousValueRef.current = 0

    if (target === 0) {
      return
    }

    // Read any layout properties before animation loop begins (Requirement 7.5)
    const startTime = performance.now()
    const startValue = 0

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic timing function
      const eased = 1 - Math.pow(1 - progress, 3)
      const rawValue = startValue + (target - startValue) * eased
      const value = Math.floor(rawValue)

      // Ensure monotonically non-decreasing values
      const monotonicValue = Math.max(value, previousValueRef.current)
      previousValueRef.current = monotonicValue

      setCurrent(monotonicValue)

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(animate)
      } else {
        // Ensure exact target value on completion
        setCurrent(target)
        previousValueRef.current = target
      }
    }

    rafIdRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [target, duration])

  return current
}

export default useAnimatedValue
