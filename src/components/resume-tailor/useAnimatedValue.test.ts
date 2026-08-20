import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { useAnimatedValue } from './useAnimatedValue'

describe('useAnimatedValue', () => {
  let rafCallbacks: Array<(time: number) => void> = []
  let rafId = 0

  beforeEach(() => {
    rafCallbacks = []
    rafId = 0

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return ++rafId
    })

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    vi.spyOn(performance, 'now').mockReturnValue(0)

    // Default: no reduced motion preference
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should start at 0', () => {
    const { result } = renderHook(() => useAnimatedValue(75))
    expect(result.current).toBe(0)
  })

  it('should animate towards target value', () => {
    const { result } = renderHook(() => useAnimatedValue(100, 1200))

    // Simulate time passing at 600ms (halfway)
    vi.spyOn(performance, 'now').mockReturnValue(600)
    act(() => {
      rafCallbacks.forEach((cb) => cb(600))
      rafCallbacks = []
    })

    // At halfway with ease-out cubic, progress should be well above 50%
    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeLessThanOrEqual(100)
  })

  it('should reach exact target value when animation completes', () => {
    const { result } = renderHook(() => useAnimatedValue(85, 1200))

    // Simulate animation completing at 1200ms
    vi.spyOn(performance, 'now').mockReturnValue(1200)
    act(() => {
      rafCallbacks.forEach((cb) => cb(1200))
      rafCallbacks = []
    })

    expect(result.current).toBe(85)
  })

  it('should return integer values (floor)', () => {
    const { result } = renderHook(() => useAnimatedValue(73, 1200))

    // Simulate at 300ms
    vi.spyOn(performance, 'now').mockReturnValue(300)
    act(() => {
      rafCallbacks.forEach((cb) => cb(300))
      rafCallbacks = []
    })

    expect(Number.isInteger(result.current)).toBe(true)
  })

  it('should respect prefers-reduced-motion by returning target immediately', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { result } = renderHook(() => useAnimatedValue(90, 1200))

    expect(result.current).toBe(90)
  })

  it('should re-trigger animation from 0 when target changes', () => {
    const { result, rerender } = renderHook(
      ({ target }) => useAnimatedValue(target, 1200),
      { initialProps: { target: 50 } }
    )

    // Complete the first animation
    vi.spyOn(performance, 'now').mockReturnValue(1200)
    act(() => {
      rafCallbacks.forEach((cb) => cb(1200))
      rafCallbacks = []
    })
    expect(result.current).toBe(50)

    // Change target
    vi.spyOn(performance, 'now').mockReturnValue(0)
    rerender({ target: 80 })

    // Should reset to 0
    expect(result.current).toBe(0)
  })

  it('should return 0 when target is 0', () => {
    const { result } = renderHook(() => useAnimatedValue(0, 1200))
    expect(result.current).toBe(0)
  })

  it('should use default duration of 1200ms', () => {
    const { result } = renderHook(() => useAnimatedValue(100))

    // Simulate at 1200ms - should complete
    vi.spyOn(performance, 'now').mockReturnValue(1200)
    act(() => {
      rafCallbacks.forEach((cb) => cb(1200))
      rafCallbacks = []
    })

    expect(result.current).toBe(100)
  })

  it('should produce monotonically non-decreasing values', () => {
    const { result } = renderHook(() => useAnimatedValue(100, 1200))

    const values: number[] = [result.current]

    // Simulate animation at multiple time points
    const timePoints = [100, 200, 400, 600, 800, 1000, 1200]
    for (const time of timePoints) {
      vi.spyOn(performance, 'now').mockReturnValue(time)
      act(() => {
        rafCallbacks.forEach((cb) => cb(time))
        rafCallbacks = []
      })
      values.push(result.current)
    }

    // Verify monotonically non-decreasing
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
    }
  })
})


describe('Property-based tests', () => {
  let rafCallbacks: Array<(time: number) => void> = []
  let rafId = 0

  beforeEach(() => {
    rafCallbacks = []
    rafId = 0

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return ++rafId
    })

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    vi.spyOn(performance, 'now').mockReturnValue(0)

    // Default: no reduced motion preference
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Property 4: Animated value bounds and convergence
   *
   * For any target in [0, 100], verify values produced by useAnimatedValue are:
   * - Always integers
   * - Always in range [0, target]
   * - Starting at 0
   * - Monotonically non-decreasing
   * - Converging to exactly target when animation completes
   *
   * **Validates: Requirements 5.1, 5.3, 5.4**
   */
  it('Property 4: values are integers in [0, target], start at 0, monotonically non-decreasing, and converge to target', () => {
    const performanceNowMock = vi.spyOn(performance, 'now').mockReturnValue(0)

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (target) => {
        // Reset state for each property run
        rafCallbacks = []
        rafId = 0
        performanceNowMock.mockReturnValue(0)

        const duration = 1200
        const { result, unmount } = renderHook(() => useAnimatedValue(target, duration))

        // Should start at 0
        expect(result.current).toBe(0)

        if (target === 0) {
          unmount()
          return
        }

        const values: number[] = [result.current]

        // Simulate animation at multiple time points spread across the duration
        const timePoints = [50, 150, 300, 500, 700, 900, 1100, 1200]
        for (const time of timePoints) {
          performanceNowMock.mockReturnValue(time)
          act(() => {
            const cbs = [...rafCallbacks]
            rafCallbacks = []
            cbs.forEach((cb) => cb(time))
          })
          values.push(result.current)
        }

        unmount()

        // Verify all values are integers
        for (const v of values) {
          expect(Number.isInteger(v)).toBe(true)
        }

        // Verify all values are in [0, target]
        for (const v of values) {
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(target)
        }

        // Verify monotonically non-decreasing
        for (let i = 1; i < values.length; i++) {
          expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
        }

        // Verify convergence to exact target
        expect(values[values.length - 1]).toBe(target)
      }),
      { numRuns: 50 }
    )
  })

  /**
   * Property 5: Animation timing completion
   *
   * For any target in [0, 100] with 1200ms duration, verify the hook returns
   * the exact target value after 1200ms elapses.
   *
   * **Validates: Requirement 5.2**
   */
  it('Property 5: hook returns exact target value after 1200ms duration elapses', () => {
    const performanceNowMock = vi.spyOn(performance, 'now').mockReturnValue(0)

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (target) => {
        // Reset state for each property run
        rafCallbacks = []
        rafId = 0
        performanceNowMock.mockReturnValue(0)

        const duration = 1200
        const { result, unmount } = renderHook(() => useAnimatedValue(target, duration))

        if (target === 0) {
          expect(result.current).toBe(0)
          unmount()
          return
        }

        // Simulate time passing to exactly 1200ms
        performanceNowMock.mockReturnValue(1200)
        act(() => {
          const cbs = [...rafCallbacks]
          rafCallbacks = []
          cbs.forEach((cb) => cb(1200))
        })

        // After duration elapses, value must equal target exactly
        expect(result.current).toBe(target)

        unmount()
      }),
      { numRuns: 100 }
    )
  })
})
