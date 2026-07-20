function parsePort(raw: string | undefined): number {
  if (!raw) return 3001
  const port = Number(raw)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT env var: ${JSON.stringify(raw)}`)
  }
  return port
}

export const env = {
  port: parsePort(process.env.PORT),
}
