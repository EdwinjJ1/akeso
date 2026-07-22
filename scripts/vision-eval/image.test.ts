import { describe, expect, it } from 'vitest'
import { hasValidImageSignature } from './image'

describe('evaluation image signature validation', () => {
  it('accepts JPEG, PNG and WebP magic bytes', () => {
    expect(
      hasValidImageSignature('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00]))
    ).toBe(true)
    expect(
      hasValidImageSignature(
        'image/png',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe(true)
    expect(
      hasValidImageSignature('image/webp', Buffer.from('RIFF0000WEBP'))
    ).toBe(true)
  })

  it('rejects content whose magic bytes disagree with the MIME type', () => {
    expect(hasValidImageSignature('image/jpeg', Buffer.from('<html>'))).toBe(false)
    expect(
      hasValidImageSignature('image/png', Buffer.from([0xff, 0xd8, 0xff, 0x00]))
    ).toBe(false)
  })
})
