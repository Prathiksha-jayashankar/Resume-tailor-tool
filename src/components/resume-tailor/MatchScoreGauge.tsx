/**
 * MatchScoreGauge — displays the overall resume-to-job match score (0–100)
 * with a circular SVG gauge and per-category breakdown bars.
 *
 * Animates from 0 to target values over 1200ms using useAnimatedValue hook.
 * Respects prefers-reduced-motion: reduce by showing final values immediately.
 *
 * Color coding:
 *   - Red (< 40): Poor alignment
 *   - Yellow (40–70): Moderate alignment
 *   - Green (> 70): Strong alignment
 *
 * Requirements: 3.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import React from 'react'
import type { MatchScore } from '../../shared/types'
import { useAnimatedValue } from './useAnimatedValue'

export interface MatchScoreGaugeProps {
  score: MatchScore
}

/** Category metadata for display */
const CATEGORIES = [
  { key: 'technical' as const, label: 'Technical', weight: '40%' },
  { key: 'experience' as const, label: 'Experience', weight: '30%' },
  { key: 'softSkills' as const, label: 'Soft Skills', weight: '20%' },
  { key: 'education' as const, label: 'Education', weight: '10%' },
]

/** Animation duration in milliseconds */
const ANIMATION_DURATION = 1200

/** Returns color based on score threshold */
function getScoreColor(value: number): string {
  if (value < 40) return '#ef4444'
  if (value <= 70) return '#f59e0b'
  return '#10b981'
}

export function MatchScoreGauge({ score }: MatchScoreGaugeProps) {
  const { overall, breakdown } = score

  // Animate overall score from 0 to target over 1200ms
  const animatedOverall = useAnimatedValue(overall, ANIMATION_DURATION)

  // Animate each category breakdown bar from 0 to target over 1200ms
  const animatedTechnical = useAnimatedValue(breakdown.technical, ANIMATION_DURATION)
  const animatedExperience = useAnimatedValue(breakdown.experience, ANIMATION_DURATION)
  const animatedSoftSkills = useAnimatedValue(breakdown.softSkills, ANIMATION_DURATION)
  const animatedEducation = useAnimatedValue(breakdown.education, ANIMATION_DURATION)

  const animatedBreakdown = {
    technical: animatedTechnical,
    experience: animatedExperience,
    softSkills: animatedSoftSkills,
    education: animatedEducation,
  }

  // Use animated value for color so it reflects current displayed value
  const color = getScoreColor(animatedOverall)

  // SVG circular gauge geometry
  const cx = 100
  const cy = 100
  const r = 80
  const strokeWidth = 12
  const circumference = 2 * Math.PI * r
  // Show gauge as 270° arc (three-quarter circle)
  const arcLength = (270 / 360) * circumference
  const filledLength = (animatedOverall / 100) * arcLength

  // Rotation to center the gap at the bottom
  const rotationOffset = 135 // start from bottom-left

  return (
    <div
      data-testid="match-score-gauge"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
      }}
    >
      {/* Title */}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-secondary, #64748b)',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Match Score
      </div>

      {/* Circular Gauge */}
      <div
        style={{ position: 'relative', width: 200, height: 200 }}
        aria-label={`Match score: ${overall} out of 100`}
      >
        <svg
          width={200}
          height={200}
          viewBox="0 0 200 200"
          role="img"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--border, #e2e8f0)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeLinecap="round"
            transform={`rotate(${rotationOffset} ${cx} ${cy})`}
          />
          {/* Filled arc — animated from 0 to target */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${filledLength} ${circumference - filledLength}`}
            strokeLinecap="round"
            transform={`rotate(${rotationOffset} ${cx} ${cy})`}
            role="progressbar"
            aria-valuenow={overall}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </svg>

        {/* Score number in center — shows interpolated integer during animation */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 40,
            fontWeight: 800,
            color: color,
            lineHeight: 1,
          }}>
            {animatedOverall}
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted, #94a3b8)',
            marginTop: 4,
          }}>
            / 100
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div style={{
        width: '100%',
        maxWidth: 320,
        marginTop: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary, #64748b)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}>
          Category Breakdown
        </div>

        {CATEGORIES.map(({ key, label, weight }) => {
          const animatedValue = animatedBreakdown[key]
          const barColor = getScoreColor(animatedValue)

          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Label row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{
                  fontSize: 12,
                  color: 'var(--text-primary, #1e293b)',
                  fontWeight: 500,
                }}>
                  {label} <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 400 }}>({weight})</span>
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: barColor,
                }}>
                  {animatedValue}
                </span>
              </div>

              {/* Progress bar — animated from 0% to target width */}
              <div
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--border, #e2e8f0)',
                  overflow: 'hidden',
                }}
                role="progressbar"
                aria-label={`${label} score`}
                aria-valuenow={breakdown[key]}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div style={{
                  width: `${animatedValue}%`,
                  height: '100%',
                  borderRadius: 3,
                  background: barColor,
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
