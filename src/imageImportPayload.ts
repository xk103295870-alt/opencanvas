export type ImageImportPayloadInput = {
  fileName: string
  bytes: Uint8Array
  title?: string
  gridId?: string
  mimeType: string
}

export type ImageImportPayload = {
  name: string
  type: string
  dataUrl: string
  title?: string
  gridId?: string
}

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary)
}

export function inferImageMimeType(fileName: string) {
  const normalized = fileName.trim().toLowerCase()
  const extension = Object.keys(IMAGE_MIME_BY_EXTENSION).find((item) => normalized.endsWith(item))
  return extension ? IMAGE_MIME_BY_EXTENSION[extension] : null
}

export function buildImageImportPayload(input: ImageImportPayloadInput): ImageImportPayload {
  const name = input.fileName.trim()
  const title = input.title?.trim()
  const gridId = input.gridId?.trim()
  return {
    name,
    type: input.mimeType,
    dataUrl: `data:${input.mimeType};base64,${bytesToBase64(input.bytes)}`,
    ...(title ? { title } : {}),
    ...(gridId ? { gridId } : {}),
  }
}
