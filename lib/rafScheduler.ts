type RafCallback = (timestamp: number) => void

const callbacks = new Set<RafCallback>()
let rafId: number | null = null

function loop(timestamp: number) {
  for (const cb of callbacks) {
    cb(timestamp)
  }
  rafId = callbacks.size > 0 ? requestAnimationFrame(loop) : null
}

export function subscribeRaf(callback: RafCallback): () => void {
  callbacks.add(callback)

  if (rafId === null) {
    rafId = requestAnimationFrame(loop)
  }

  return () => {
    callbacks.delete(callback)
    if (callbacks.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }
}
