export function createId(): string {
  return crypto.randomUUID()
}

export function timestamp(): string {
  return new Date().toISOString()
}
