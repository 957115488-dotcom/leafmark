export type ExternalChangeDecision = 'reload' | 'conflict' | 'ignore'

export function decideExternalChange(dirty: boolean, incomingModifiedAt: number, currentModifiedAt: number): ExternalChangeDecision {
  if (incomingModifiedAt <= currentModifiedAt) return 'ignore'
  return dirty ? 'conflict' : 'reload'
}

export function displayName(filePath: string | null, fallback = '未命名.md') {
  if (!filePath) return fallback
  return filePath.split(/[\\/]/).filter(Boolean).at(-1) || fallback
}
