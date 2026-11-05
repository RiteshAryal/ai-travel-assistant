import { describe, expect, it } from 'vitest'
import { edgePath } from './geometry'
import { DIAGRAM_H, DIAGRAM_W, NODE_H, NODE_W, QUERY_STEPS } from './steps'

describe('QUERY_STEPS', () => {
  it('has unique ids and fits inside the diagram', () => {
    expect(new Set(QUERY_STEPS.map((s) => s.id)).size).toBe(QUERY_STEPS.length)
    for (const s of QUERY_STEPS) {
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.x + NODE_W).toBeLessThanOrEqual(DIAGRAM_W)
      expect(s.y + NODE_H).toBeLessThanOrEqual(DIAGRAM_H)
    }
  })

  it('connects every consecutive pair with a straight edge', () => {
    for (let i = 1; i < QUERY_STEPS.length; i++) {
      const [a, b] = [QUERY_STEPS[i - 1], QUERY_STEPS[i]]
      expect(a.x === b.x || a.y === b.y).toBe(true)
      expect(edgePath(a, b)).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/)
    }
  })
})

describe('edgePath', () => {
  const a = { ...QUERY_STEPS[0], x: 0, y: 0 }

  it('runs between facing edges for horizontal links in both directions', () => {
    expect(edgePath(a, { ...a, x: 400 })).toBe(`M ${NODE_W} ${NODE_H / 2} L 400 ${NODE_H / 2}`)
    expect(edgePath({ ...a, x: 400 }, a)).toBe(`M 400 ${NODE_H / 2} L ${NODE_W} ${NODE_H / 2}`)
  })

  it('runs between facing edges for a downward link', () => {
    expect(edgePath(a, { ...a, y: 200 })).toBe(`M ${NODE_W / 2} ${NODE_H} L ${NODE_W / 2} 200`)
  })
})
