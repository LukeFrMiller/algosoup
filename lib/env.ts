// ponytail: plain accessor, throws on missing. No schema lib.
export function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}
