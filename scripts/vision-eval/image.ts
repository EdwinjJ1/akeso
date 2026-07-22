import type { EncodedImage } from './providers'

const startsWith = (bytes: Uint8Array, signature: number[]): boolean =>
  signature.every((byte, index) => bytes[index] === byte)

export function hasValidImageSignature(
  mimeType: EncodedImage['mimeType'],
  bytes: Uint8Array
): boolean {
  if (mimeType === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff])
  if (mimeType === 'image/png') {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  }
  return (
    Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'RIFF' &&
    Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WEBP'
  )
}
