export function getLocalStore(key: string): string | null {
  try {
    const result = localStorage.getItem(key)
    return result
  } catch (_error) {
    return null
  }
}

export function setLocalStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (_error) {
    return
  }
}

export function delLocalStore(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (_error) {
    return
  }
}
