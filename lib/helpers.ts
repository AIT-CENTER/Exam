export function toAbsoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }

  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin).href
  }

  return path
}
