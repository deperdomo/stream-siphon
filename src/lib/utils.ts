import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isYoutubeUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value)
    return /^https?:$/.test(protocol) && /(^|\.)(youtube\.com|youtu\.be)$/.test(hostname)
  } catch {
    return false
  }
}
