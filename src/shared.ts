export type ThemeName = 'ink' | 'paper' | 'light'

export interface DocumentPayload {
  path: string
  name: string
  content: string
  modifiedAt: number
}

export interface RecentFile {
  path: string
  name: string
  openedAt: number
}

export interface AppPreferences {
  theme: ThemeName
  autoSave: boolean
  tocVisible: boolean
  tocWidth: number
}

export interface PersistedState {
  recent: RecentFile[]
  preferences: AppPreferences
  lastFile?: string
  window?: { width: number; height: number; x?: number; y?: number; maximized?: boolean }
}

export type SaveResult = { ok: true; path: string; modifiedAt: number } | { ok: false; canceled?: boolean; message?: string }

export interface LeafmarkAPI {
  platform: NodeJS.Platform
  getInitialDocument(): Promise<DocumentPayload | null>
  openDialog(): Promise<DocumentPayload | null>
  openPath(path: string): Promise<DocumentPayload>
  save(path: string, content: string): Promise<SaveResult>
  saveAs(content: string, suggestedName?: string): Promise<SaveResult>
  getState(): Promise<PersistedState>
  updatePreferences(preferences: Partial<AppPreferences>): Promise<PersistedState>
  getPathForFile(file: File): string
  onExternalChange(callback: (document: DocumentPayload) => void): () => void
  onOpenDocument(callback: (document: DocumentPayload) => void): () => void
}
