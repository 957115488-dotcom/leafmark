import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import {
  Bold, BookOpen, Check, ChevronLeft, Code2, FilePlus2, FolderOpen, Heading1, Heading2,
  Italic, List, ListOrdered, Menu, Moon, MoreHorizontal, Quote, Redo2, Save, Search,
  Sun, Type, Undo2, X, AlertTriangle, PanelLeftClose, PanelLeftOpen, FileText, Link2,
} from 'lucide-react'
import type { DocumentPayload, RecentFile, ThemeName } from '../shared'
import { decideExternalChange } from './lib/document-state'
import { extractToc, type TocItem } from './lib/toc'

const isMac = window.leafmark.platform === 'darwin'
const shortcutPrefix = isMac ? '⌘' : 'Ctrl+'

const welcome = `# 欢迎使用 Leafmark

这是一张可以直接书写的纸。

单击这里开始编辑。你看到的排版就是最终的阅读效果，内容仍会保存为标准 Markdown 文件。

## 阅读即编辑

选中文字可以设置 **粗体**、*斜体*、链接和其他格式。标题会自动出现在左侧目录中。

> 安静地阅读，自然地书写。

## 常用快捷键

- \`${shortcutPrefix}O\` 打开文件
- \`${shortcutPrefix}S\` 保存文件
- \`${shortcutPrefix}F\` 查找内容
- \`${shortcutPrefix}/\` 切换 Markdown 源码
`

const themeOrder: ThemeName[] = ['ink', 'paper', 'light']
const themeLabel: Record<ThemeName, string> = { ink: '墨夜', paper: '纸张', light: '明亮' }

function IconButton({ title, active, onClick, children, disabled }: { title: string; active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <button className={`icon-button ${active ? 'active' : ''}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>{children}</button>
}

export function App() {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState('未命名.md')
  const [markdown, setMarkdown] = useState(welcome)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modifiedAt, setModifiedAt] = useState(0)
  const [theme, setTheme] = useState<ThemeName>('ink')
  const [tocVisible, setTocVisible] = useState(true)
  const [tocWidth, setTocWidth] = useState(278)
  const [autoSave, setAutoSave] = useState(true)
  const [toc, setToc] = useState<TocItem[]>([])
  const [sourceMode, setSourceMode] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [recentOpen, setRecentOpen] = useState(false)
  const [recent, setRecent] = useState<RecentFile[]>([])
  const [conflict, setConflict] = useState<DocumentPayload | null>(null)
  const [dragging, setDragging] = useState(false)
  const [toolbar, setToolbar] = useState<{ left: number; top: number } | null>(null)
  const lastSaved = useRef(welcome)
  const loading = useRef(false)
  const documentRef = useRef({ filePath, dirty, modifiedAt })

  const extensions = useMemo(() => [
    StarterKit,
    Markdown.configure({ markedOptions: { gfm: true, breaks: false } }),
    Image.configure({ allowBase64: true, inline: false }),
    TableKit.configure({ table: { resizable: true } }),
  ], [])

  const editor = useEditor({
    extensions,
    content: welcome,
    contentType: 'markdown',
    autofocus: false,
    editorProps: { attributes: { class: 'leaf-editor', spellcheck: 'true', 'aria-label': 'Markdown 正文编辑区' } },
    onUpdate: ({ editor }) => {
      if (loading.current) return
      const next = editor.getMarkdown()
      setMarkdown(next)
      setDirty(next !== lastSaved.current)
      setToc(extractToc(editor.getJSON()))
    },
    onCreate: ({ editor }) => setToc(extractToc(editor.getJSON())),
  })

  useEffect(() => { documentRef.current = { filePath, dirty, modifiedAt } }, [filePath, dirty, modifiedAt])

  const loadDocument = useCallback((openedDocument: DocumentPayload) => {
    if (!editor) return
    loading.current = true
    editor.commands.setContent(openedDocument.content || '\n', { contentType: 'markdown' })
    loading.current = false
    setFilePath(openedDocument.path)
    setFileName(openedDocument.name)
    setMarkdown(openedDocument.content)
    lastSaved.current = openedDocument.content
    setDirty(false)
    setModifiedAt(openedDocument.modifiedAt)
    setToc(extractToc(editor.getJSON()))
    setConflict(null)
    setRecentOpen(false)
    document.title = `${openedDocument.name} — Leafmark`
  }, [editor])

  useEffect(() => {
    void window.leafmark.getState().then((state) => {
      setTheme(state.preferences.theme)
      setAutoSave(state.preferences.autoSave)
      setTocVisible(state.preferences.tocVisible)
      setTocWidth(state.preferences.tocWidth)
      setRecent(state.recent)
    })
    void window.leafmark.getInitialDocument().then((document) => document && loadDocument(document))
    const offOpen = window.leafmark.onOpenDocument(loadDocument)
    const offExternal = window.leafmark.onExternalChange((document) => {
      const current = documentRef.current
      if (current.filePath?.toLowerCase() !== document.path.toLowerCase()) return
      const decision = decideExternalChange(current.dirty, document.modifiedAt, current.modifiedAt)
      if (decision === 'reload') loadDocument(document)
      if (decision === 'conflict') setConflict(document)
    })
    return () => { offOpen(); offExternal() }
  }, [loadDocument])

  useEffect(() => {
    if (!editor) return
    const sync = () => {
      const { from, to } = editor.state.selection
      if (from === to || !editor.isFocused) return setToolbar(null)
      const start = editor.view.coordsAtPos(from)
      const end = editor.view.coordsAtPos(to)
      setToolbar({ left: Math.max(190, (start.left + end.right) / 2), top: Math.max(70, Math.min(start.top, end.top) - 52) })
    }
    editor.on('selectionUpdate', sync)
    editor.on('blur', () => setTimeout(() => !editor.isFocused && setToolbar(null), 120))
    return () => { editor.off('selectionUpdate', sync) }
  }, [editor])

  const refreshState = useCallback(async () => setRecent((await window.leafmark.getState()).recent), [])

  const save = useCallback(async (forceAs = false) => {
    if (!editor) return
    const content = sourceMode ? markdown : editor.getMarkdown()
    setSaving(true)
    const result = forceAs || !filePath
      ? await window.leafmark.saveAs(content, fileName)
      : await window.leafmark.save(filePath, content)
    setSaving(false)
    if (result.ok) {
      setFilePath(result.path)
      setFileName(result.path.split(/[\\/]/).at(-1) || fileName)
      setModifiedAt(result.modifiedAt)
      lastSaved.current = content
      setDirty(false)
      document.title = `${result.path.split(/[\\/]/).at(-1)} — Leafmark`
      await refreshState()
    } else if (!result.canceled) window.alert(result.message || '保存失败')
  }, [editor, sourceMode, markdown, filePath, fileName, refreshState])

  useEffect(() => {
    if (!autoSave || !dirty || !filePath || conflict) return
    const timer = setTimeout(() => void save(false), 1300)
    return () => clearTimeout(timer)
  }, [autoSave, dirty, filePath, markdown, conflict, save])

  const openDialog = useCallback(async () => {
    if (dirty && !window.confirm('当前修改尚未保存，仍然打开其他文件吗？')) return
    const document = await window.leafmark.openDialog()
    if (document) loadDocument(document)
  }, [dirty, loadDocument])

  const openRecent = useCallback(async (path: string) => {
    if (dirty && !window.confirm('当前修改尚未保存，仍然打开其他文件吗？')) return
    try { loadDocument(await window.leafmark.openPath(path)) } catch (error) { window.alert(error instanceof Error ? error.message : '无法打开文件') }
  }, [dirty, loadDocument])

  const newDocument = useCallback(() => {
    if (dirty && !window.confirm('当前修改尚未保存，仍然新建文件吗？')) return
    if (!editor) return
    const content = '# 未命名文稿\n\n从这里开始书写……\n'
    loading.current = true
    editor.commands.setContent(content, { contentType: 'markdown' })
    loading.current = false
    setFilePath(null); setFileName('未命名.md'); setMarkdown(content)
    lastSaved.current = content; setDirty(false); setModifiedAt(0); setConflict(null)
    setToc(extractToc(editor.getJSON())); document.title = '未命名.md — Leafmark'
  }, [dirty, editor])

  const toggleSource = useCallback(() => {
    if (!editor) return
    if (sourceMode) {
      loading.current = true
      editor.commands.setContent(markdown || '\n', { contentType: 'markdown' })
      loading.current = false
      setToc(extractToc(editor.getJSON()))
    } else setMarkdown(editor.getMarkdown())
    setSourceMode((value) => !value)
  }, [editor, sourceMode, markdown])

  const cycleTheme = useCallback(() => {
    const next = themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length]
    setTheme(next)
    void window.leafmark.updatePreferences({ theme: next })
  }, [theme])

  const toggleToc = useCallback(() => {
    const next = !tocVisible
    setTocVisible(next)
    void window.leafmark.updatePreferences({ tocVisible: next })
  }, [tocVisible])

  const jumpToHeading = useCallback((item: TocItem) => {
    const headings = document.querySelectorAll('.leaf-editor h1, .leaf-editor h2, .leaf-editor h3, .leaf-editor h4, .leaf-editor h5, .leaf-editor h6')
    headings[item.index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const findNext = useCallback((backward = false) => {
    if (!searchTerm) return
    const find = (window as unknown as { find?: (text: string, caseSensitive?: boolean, backward?: boolean, wrap?: boolean) => boolean }).find
    find?.(searchTerm, false, backward, true)
  }, [searchTerm])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 's') { event.preventDefault(); void save(event.shiftKey) }
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); void openDialog() }
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); newDocument() }
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); setSearchOpen(true) }
      if (event.key === '/') { event.preventDefault(); toggleSource() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save, openDialog, newDocument, toggleSource])

  const changeTocWidth = (event: React.PointerEvent) => {
    const startX = event.clientX, startWidth = tocWidth
    let finalWidth = startWidth
    const move = (e: PointerEvent) => { finalWidth = Math.min(420, Math.max(220, startWidth + e.clientX - startX)); setTocWidth(finalWidth) }
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      void window.leafmark.updatePreferences({ tocWidth: finalWidth })
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault(); setDragging(false)
    const file = event.dataTransfer.files[0]
    if (!file) return
    const path = window.leafmark.getPathForFile(file)
    if (path) await openRecent(path)
  }

  const sourceChanged = (value: string) => {
    setMarkdown(value); setDirty(value !== lastSaved.current)
  }

  return <div className="app" data-theme={theme} data-platform={window.leafmark.platform} onDragEnter={(e) => { e.preventDefault(); setDragging(true) }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false) }} onDrop={handleDrop}>
    <header className="titlebar">
      <div className="brand-block">
        <button className="brand" onClick={() => { void refreshState(); setRecentOpen(true) }} aria-label="最近文件">LEAFMARK</button>
        <span className="brand-leaf">◇</span>
      </div>
      <div className="document-title"><span>{fileName.replace(/\.md(?:own)?$|\.markdown$/i, '')}</span><i className={dirty ? 'dirty' : ''}>{saving ? '保存中' : dirty ? '未保存' : '已保存'}</i></div>
      <nav className="top-actions">
        <IconButton title={`新建 ${shortcutPrefix}N`} onClick={newDocument}><FilePlus2 /></IconButton>
        <IconButton title={`打开 ${shortcutPrefix}O`} onClick={() => void openDialog()}><FolderOpen /></IconButton>
        <IconButton title={`保存 ${shortcutPrefix}S`} onClick={() => void save()}><Save /></IconButton>
        <span className="toolbar-divider" />
        <IconButton title={`查找 ${shortcutPrefix}F`} active={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Search /></IconButton>
        <IconButton title={sourceMode ? '返回阅读编辑' : `Markdown 源码 ${shortcutPrefix}/`} active={sourceMode} onClick={toggleSource}><Code2 /></IconButton>
        <IconButton title={`${themeLabel[theme]}主题`} onClick={cycleTheme}>{theme === 'ink' ? <Moon /> : <Sun />}</IconButton>
        <IconButton title={tocVisible ? '隐藏目录' : '显示目录'} onClick={toggleToc}>{tocVisible ? <PanelLeftClose /> : <PanelLeftOpen />}</IconButton>
      </nav>
    </header>

    {searchOpen && <div className="search-popover">
      <Search /><input autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && findNext(e.shiftKey)} placeholder="查找文稿内容" />
      <button onClick={() => findNext(true)}>↑</button><button onClick={() => findNext(false)}>↓</button><button onClick={() => setSearchOpen(false)}><X /></button>
    </div>}

    {conflict && <div className="conflict-banner"><AlertTriangle /><span>文件在其他应用中发生了变化。</span><button onClick={() => loadDocument(conflict)}>载入磁盘版本</button><button onClick={() => setConflict(null)}>保留我的修改</button></div>}

    <div className="workspace">
      {tocVisible && <aside className="toc" style={{ width: tocWidth }}>
        <div className="toc-heading"><span>CONTENTS</span><small>{toc.length} 节</small></div>
        <div className="toc-list">
          {toc.length ? toc.map((item) => <button key={item.id} className={`toc-item level-${item.level}`} onClick={() => jumpToHeading(item)}><span className="toc-marker">{item.level === 1 ? '◆' : '·'}</span><span>{item.text}</span></button>) : <p className="toc-empty">添加标题后，这里会自动生成目录。</p>}
        </div>
        <div className="toc-footer"><BookOpen /><span>{sourceMode ? '源码模式' : '阅读即编辑'}</span></div>
        <div className="toc-resizer" onPointerDown={changeTocWidth} />
      </aside>}

      <main className={`page-scroll ${sourceMode ? 'source-active' : ''}`}>
        <article className="paper">
          {sourceMode ? <textarea className="source-editor" spellCheck={false} value={markdown} onChange={(e) => sourceChanged(e.target.value)} aria-label="Markdown 源码" /> : <EditorContent editor={editor} />}
          {!sourceMode && <div className="writing-hint"><Type /><span>单击正文即可编辑</span></div>}
        </article>
      </main>
    </div>

    {toolbar && editor && !sourceMode && <div className="selection-toolbar" style={{ left: toolbar.left, top: toolbar.top }} onMouseDown={(e) => e.preventDefault()}>
      <button className={editor.isActive('bold') ? 'active' : ''} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></button>
      <button className={editor.isActive('italic') ? 'active' : ''} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></button>
      <span />
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></button>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></button>
      <button className={editor.isActive('link') ? 'active' : ''} onClick={() => {
        const previous = editor.getAttributes('link').href as string | undefined
        const href = window.prompt('输入链接地址', previous || 'https://')
        if (href === null) return
        if (!href.trim()) editor.chain().focus().unsetLink().run()
        else editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
      }}><Link2 /></button>
    </div>}

    {recentOpen && <div className="drawer-scrim" onMouseDown={() => setRecentOpen(false)}>
      <section className="recent-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <header><div><span>LIBRARY</span><h2>最近文稿</h2></div><button onClick={() => setRecentOpen(false)}><X /></button></header>
        <button className="open-large" onClick={() => void openDialog()}><FolderOpen /><span><b>打开 Markdown</b><small>.md · .markdown · .mdown</small></span></button>
        <div className="recent-list">{recent.length ? recent.map((item) => <button key={item.path} onClick={() => void openRecent(item.path)}><FileText /><span><b>{item.name}</b><small>{item.path}</small></span><ChevronLeft /></button>) : <p>还没有最近打开的文稿。</p>}</div>
        <footer><label><input type="checkbox" checked={autoSave} onChange={(e) => { setAutoSave(e.target.checked); void window.leafmark.updatePreferences({ autoSave: e.target.checked }) }} /> 自动保存</label></footer>
      </section>
    </div>}

    {dragging && <div className="drop-overlay"><div><FolderOpen /><strong>松开以打开 Markdown</strong><span>当前文稿不会被覆盖</span></div></div>}
  </div>
}
