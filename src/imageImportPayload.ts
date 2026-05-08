export type ImageImportPayloadInput = {
  fileName: string
  bytes: Buffer
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
    dataUrl: `data:${input.mimeType};base64,${input.bytes.toString('base64')}`,
    ...(title ? { title } : {}),
    ...(gridId ? { gridId } : {}),
  }
}
