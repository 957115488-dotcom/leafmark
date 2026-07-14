export interface TocItem { id: string; level: number; text: string; index: number }
export interface JSONNode { type?: string; attrs?: Record<string, unknown>; text?: string; content?: JSONNode[] }

export function slugify(value: string, index = 0) {
  const slug = value.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').replace(/-+/g, '-')
  return slug || `section-${index + 1}`
}

function textOf(node: JSONNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.content ?? []).map(textOf).join('')
}

export function extractToc(document: JSONNode): TocItem[] {
  const result: TocItem[] = []
  const seen = new Map<string, number>()
  const visit = (node: JSONNode) => {
    if (node.type === 'heading') {
      const text = textOf(node).trim() || '未命名标题'
      const base = slugify(text, result.length)
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      result.push({ id: count ? `${base}-${count + 1}` : base, level: Number(node.attrs?.level) || 1, text, index: result.length })
    }
    node.content?.forEach(visit)
  }
  visit(document)
  return result
}
