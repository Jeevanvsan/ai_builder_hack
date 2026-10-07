// Node loader hook for the AI test: web/src code reads Vite's import.meta.env, which Node doesn't have. Rewrites it
// to process.env for files under web/src so the app's own modules (post-call consolidation etc.) run unchanged.
export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context)
  if (url.includes('/web/src/') && r.source) {
    const src = r.source.toString()
    if (src.includes('import.meta.env')) return { ...r, source: src.replaceAll('import.meta.env', 'process.env'), shortCircuit: true }
  }
  return r
}

// Vite resolves extensionless relative imports ('../firebase'); Node doesn't. Try .ts / .tsx for web/src files.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (e) {
    if (!specifier.startsWith('.') || !context.parentURL?.includes('/web/src/')) throw e
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      try { return await nextResolve(specifier + ext, context) } catch { /* next */ }
    }
    throw e
  }
}
