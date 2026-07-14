import type { LeafmarkAPI } from '../shared'

declare global { interface Window { leafmark: LeafmarkAPI } }
declare module '*.css'
export {}
