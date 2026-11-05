export interface SseEvent {
  event: string
  data: string
}

/**
 * Incremental Server-Sent Events parser for fetch() streams.
 * Feed it decoded text chunks in any size; it emits complete events.
 */
export function createSseParser(onEvent: (event: SseEvent) => void) {
  let buffer = ''

  return {
    push(chunk: string) {
      buffer = (buffer + chunk).replace(/\r\n/g, '\n')
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const parsed = parseBlock(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
        if (parsed) onEvent(parsed)
        boundary = buffer.indexOf('\n\n')
      }
    },
  }
}

function parseBlock(block: string): SseEvent | null {
  let event = 'message'
  const data: string[] = []

  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }

  return data.length ? { event, data: data.join('\n') } : null
}
