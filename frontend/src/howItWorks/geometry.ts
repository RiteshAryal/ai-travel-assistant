import { NODE_H, NODE_W, type PipelineStep } from './steps'

/** SVG path from the edge of one node to the edge of the next (nodes are axis-aligned). */
export function edgePath(from: PipelineStep, to: PipelineStep): string {
  if (from.y === to.y) {
    const y = from.y + NODE_H / 2
    const goingRight = to.x > from.x
    const x1 = goingRight ? from.x + NODE_W : from.x
    const x2 = goingRight ? to.x : to.x + NODE_W
    return `M ${x1} ${y} L ${x2} ${y}`
  }
  const x = from.x + NODE_W / 2
  const goingDown = to.y > from.y
  const y1 = goingDown ? from.y + NODE_H : from.y
  const y2 = goingDown ? to.y : to.y + NODE_H
  return `M ${x} ${y1} L ${x} ${y2}`
}
