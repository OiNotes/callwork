export const createRequest = (
  path: string,
  options?: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
    query?: Record<string, string>
  }
) => {
  const query = options?.query
    ? `?${new URLSearchParams(options.query).toString()}`
    : ''

  return new Request(`http://localhost${path}${query}`, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
}
