export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function nameKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase('es')
}
