import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { promises as fs, watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import type { AppPreferences, DocumentPayload, PersistedState, SaveResult } from '../shared'

const markdownExtensions = new Set(['.md', '.markdown', '.mdown'])
const defaults: PersistedState = {
  recent: [],
  preferences: { theme: 'ink', autoSave: true, tocVisible: true, tocWidth: 278 },
}
let state: PersistedState = structuredClone(defaults)
let mainWindow: BrowserWindow | null = null
let watcher: FSWatcher | null = null
let watchedPath: string | null = null
let suppressWatchUntil = 0
let watchTimer: NodeJS.Timeout | null = null
let initialPath: string | null = null

const stateFile = () => path.join(app.getPath('userData'), 'state.json')

async function loadState() {
  try {
    const raw = JSON.parse(await fs.readFile(stateFile(), 'utf8')) as Partial<PersistedState>
    state = {
      ...defaults,
      ...raw,
      recent: Array.isArray(raw.recent) ? raw.recent : [],
      preferences: { ...defaults.preferences, ...raw.preferences },
    }
  } catch { state = structuredClone(defaults) }
}

async function persistState() {
  await fs.mkdir(path.dirname(stateFile()), { recursive: true })
  await fs.writeFile(stateFile(), JSON.stringify(state, null, 2), 'utf8')
}

function validateMarkdownPath(filePath: string) {
  if (!markdownExtensions.has(path.extname(filePath).toLowerCase())) throw new Error('请选择 .md、.markdown 或 .mdown 文件')
}

async function readDocument(filePath: string): Promise<DocumentPayload> {
  validateMarkdownPath(filePath)
  const [content, info] = await Promise.all([fs.readFile(filePath, 'utf8'), fs.stat(filePath)])
  return { path: filePath, name: path.basename(filePath), content: content.replace(/^\uFEFF/, ''), modifiedAt: info.mtimeMs }
}

async function remember(filePath: string) {
  state.lastFile = filePath
  state.recent = [
    { path: filePath, name: path.basename(filePath), openedAt: Date.now() },
    ...state.recent.filter((item) => item.path.toLowerCase() !== filePath.toLowerCase()),
  ].slice(0, 12)
  await persistState()
}

function beginWatch(filePath: string) {
  watcher?.close()
  watcher = null
  watchedPath = filePath
  try {
    watcher = watch(filePath, () => {
      if (Date.now() < suppressWatchUntil) return
      if (watchTimer) clearTimeout(watchTimer)
      watchTimer = setTimeout(async () => {
        if (!mainWindow || !watchedPath) return
        try { mainWindow.webContents.send('document:external-change', await readDocument(watchedPath)) } catch { /* transient rename/save */ }
      }, 220)
    })
  } catch { /* watch is best-effort */ }
}

async function openPath(filePath: string, emit = false) {
  const document = await readDocument(filePath)
  await remember(filePath)
  beginWatch(filePath)
  if (emit) mainWindow?.webContents.send('document:open', document)
  return document
}

function candidateFromArgv(argv: string[]) {
  return argv.find((arg) => markdownExtensions.has(path.extname(arg).toLowerCase()))
}

function registerIpc() {
  ipcMain.handle('document:initial', async () => {
    if (!initialPath) return null
    const filePath = initialPath
    initialPath = null
    try { return await openPath(filePath) } catch { return null }
  })
  ipcMain.handle('document:open-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown'] }] })
    return result.canceled ? null : openPath(result.filePaths[0])
  })
  ipcMain.handle('document:open-path', (_event, filePath: string) => openPath(filePath))
  ipcMain.handle('document:save', async (_event, filePath: string, content: string): Promise<SaveResult> => {
    try {
      validateMarkdownPath(filePath)
      suppressWatchUntil = Date.now() + 1000
      await fs.writeFile(filePath, content, 'utf8')
      const info = await fs.stat(filePath)
      await remember(filePath)
      beginWatch(filePath)
      return { ok: true, path: filePath, modifiedAt: info.mtimeMs }
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : '保存失败' } }
  })
  ipcMain.handle('document:save-as', async (_event, content: string, suggestedName = '未命名.md'): Promise<SaveResult> => {
    const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: suggestedName, filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    let filePath = result.filePath
    if (!markdownExtensions.has(path.extname(filePath).toLowerCase())) filePath += '.md'
    return await (async () => {
      try {
        suppressWatchUntil = Date.now() + 1000
        await fs.writeFile(filePath, content, 'utf8')
        const info = await fs.stat(filePath)
        await remember(filePath); beginWatch(filePath)
        return { ok: true, path: filePath, modifiedAt: info.mtimeMs } as SaveResult
      } catch (error) { return { ok: false, message: error instanceof Error ? error.message : '保存失败' } as SaveResult }
    })()
  })
  ipcMain.handle('state:get', () => state)
  ipcMain.handle('state:update-preferences', async (_event, preferences: Partial<AppPreferences>) => {
    state.preferences = { ...state.preferences, ...preferences }
    await persistState()
    return state
  })
}

async function createWindow() {
  const saved = state.window
  mainWindow = new BrowserWindow({
    width: saved?.width ?? 1260,
    height: saved?.height ?? 790,
    minWidth: 820,
    minHeight: 560,
    x: saved?.x,
    y: saved?.y,
    show: false,
    backgroundColor: '#15120e',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#b9ae9d', height: 58 },
    webPreferences: { preload: path.join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  if (saved?.maximized) mainWindow.maximize()
  mainWindow.setMenuBarVisibility(false)
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', () => {
    if (!mainWindow) return
    const bounds = mainWindow.getBounds()
    state.window = { ...bounds, maximized: mainWindow.isMaximized() }
    void persistState()
  })
  mainWindow.on('closed', () => { mainWindow = null; watcher?.close() })

  if (process.env.ELECTRON_RENDERER_URL) await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))

}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()
else {
  app.on('second-instance', (_event, argv) => {
    const file = candidateFromArgv(argv)
    if (file) void openPath(path.resolve(file), true)
    mainWindow?.show(); mainWindow?.focus()
  })
  app.whenReady().then(async () => {
    nativeTheme.themeSource = 'dark'
    await loadState()
    const candidate = candidateFromArgv(process.argv.slice(1))
    initialPath = candidate ? path.resolve(candidate) : null
    registerIpc()
    await createWindow()
  })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
