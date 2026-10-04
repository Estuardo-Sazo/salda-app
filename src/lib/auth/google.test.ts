import { describe, expect, it } from 'vitest'
import { createNonce, sha256Hex } from './google'

describe('nonce para Google', () => {
  it('sha256Hex coincide con el vector conocido', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('cada intento genera un nonce distinto y su hash corresponde', async () => {
    const a = await createNonce()
    const b = await createNonce()
    expect(a.raw).not.toBe(b.raw)
    expect(a.raw.length).toBeGreaterThanOrEqual(40)
    expect(a.hashed).toBe(await sha256Hex(a.raw))
    expect(a.hashed).toMatch(/^[0-9a-f]{64}$/)
  })
})
