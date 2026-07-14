import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AppPreferences, DocumentPayload, LeafmarkAPI } from '../shared'

const api: LeafmarkAPI = {
  getInitialDocument: () => ipcRenderer.invoke('document:initial'),
  openDialog: () => ipcRenderer.invoke('document:open-dialog'),
  openPath: (path) => ipcRenderer.invoke('document:open-path', path),
  save: (path, content) => ipcRenderer.invoke('document:save', path, content),
  saveAs: (content, suggestedName) => ipcRenderer.invoke('document:save-as', content, suggestedName),
  getState: () => ipcRenderer.invoke('state:get'),
  updatePreferences: (preferences: Partial<AppPreferences>) => ipcRenderer.invoke('state:update-preferences', preferences),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  onExternalChange: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: DocumentPayload) => callback(payload)
    ipcRenderer.on('document:external-change', listener)
    return () => ipcRenderer.removeListener('document:external-change', listener)
  },
  onOpenDocument: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: DocumentPayload) => callback(payload)
    ipcRenderer.on('document:open', listener)
    return () => ipcRenderer.removeListener('document:open', listener)
  },
}

contextBridge.exposeInMainWorld('leafmark', api)
