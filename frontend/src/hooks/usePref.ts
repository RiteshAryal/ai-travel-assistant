import { useState } from 'react'

/** Boolean preference in localStorage; falls back to false (and stays in memory) when storage is unavailable. */
export function usePref(key: string): [boolean, () => void] {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  const toggle = () =>
    setValue((v) => {
      try {
        localStorage.setItem(key, v ? '0' : '1')
      } catch {
        /* storage unavailable: preference just won't persist */
      }
      return !v
    })
  return [value, toggle]
}
