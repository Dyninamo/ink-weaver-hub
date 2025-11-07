export function generateShareToken(): string {
  // Generate a secure random token (base62: alphanumeric)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const length = 12
  let token = ''
  
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  
  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i] % chars.length]
  }
  
  return token
}

export function buildShareUrl(token: string): string {
  const baseUrl = window.location.origin
  return `${baseUrl}/share/${token}`
}

export function buildShareMessage(
  venue: string,
  date: string,
  shareUrl: string
): string {
  return `🎣 ${venue} Fishing Advice - ${new Date(date).toLocaleDateString()}

Weather conditions, recommended spots, and expert advice included.

View full report: ${shareUrl}

Powered by Fishing Intelligence Advisor`
}
