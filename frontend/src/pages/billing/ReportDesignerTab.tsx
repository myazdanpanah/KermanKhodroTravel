import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, Barcode, Box, Eye, EyeOff, LayoutGrid,
  Image as ImageIcon, LayoutTemplate, Lock, Minus, MousePointer2, MoveVertical,
  PenTool, Plus, QrCode, Redo2, RotateCcw, Save, Settings2, Square, Stamp,
  Repeat, Table2, TableProperties, Trash2, Type, Undo2, Ungroup,
} from 'lucide-react'

/**
 * Settings → گزارش‌ساز
 *
 * A free-form WYSIWYG editor for the invoice PDF: a real A4 canvas where every
 * block (text, table, logo, signature, stamp) is dragged and resized in
 * millimetres. The stored design uses the same coordinates the server renders,
 * so the printed PDF matches the canvas exactly.
 */

type ElementType =
  | 'text' | 'table' | 'logo' | 'signature' | 'stamp' | 'line' | 'rect' | 'spacer'
  | 'qr' | 'barcode' | 'frame' | 'repeater' | 'subreport' | 'labels'
type FrameVariant = 'container' | 'row' | 'column' | 'grid'
type Orientation = 'landscape' | 'portrait'
type Align = 'right' | 'center' | 'left'

interface Column {
  key: string
  label: string
  visible: boolean
  width: number
}

interface DesignElement {
  id: string
  type: ElementType
  x: number
  y: number
  w: number
  h: number
  show: boolean
  // text
  text?: string
  size?: number
  bold?: boolean
  align?: Align
  color?: string
  box?: boolean
  bg?: string
  border?: boolean
  // table
  rows_per_page?: number
  show_page_totals?: boolean
  columns?: Column[]
  // line / rect
  thickness?: number
  // qr / barcode
  data?: string
  // frame
  variant?: FrameVariant
  title?: string
  // repeater / labels
  template?: string
  max_rows?: number
  cols?: number
  rows?: number
  // subreport
  source?: 'payer_summary' | 'payments' | 'invoices' | 'request'
}

interface Design {
  design_version: number
  font_family: string
  accent_color: string
  header_bg: string
  page_orientation: Orientation
  signature_label: string
  elements: DesignElement[]
}

interface SampleRow {
  row_number: string
  contract: string
  passenger: string
  description: string
  date: string
  notes: string
  debit_display: string
  credit_display: string
  balance_display: string
}

interface Sample {
  values: Record<string, string>
  rows: SampleRow[]
  columns: { key: string; label: string; width: number }[]
  rows_per_page: number
  subreports?: Record<string, string[]>
}

interface Payload {
  name: string
  design: Design
  sample: Sample
  updated_at?: string
}

const PAGE_MM: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 297, h: 210 },
  portrait: { w: 210, h: 297 },
}

const FONTS = ['KKT Vazirmatn', 'B Nazanin', 'B Titr']
const TYPE_LABELS: Record<ElementType, string> = {
  text: 'متن',
  table: 'جدول',
  logo: 'تصویر / لوگو',
  signature: 'امضا',
  stamp: 'مهر',
  line: 'خط',
  rect: 'مستطیل',
  spacer: 'فاصله‌گذار',
  qr: 'QR Code',
  barcode: 'بارکد',
  frame: 'قاب چیدمان',
  repeater: 'تکرارساز',
  subreport: 'زیرگزارش',
  labels: 'برگ برچسب',
}
const TYPE_ICONS: Record<ElementType, typeof Type> = {
  text: Type,
  table: Table2,
  logo: ImageIcon,
  signature: PenTool,
  stamp: Stamp,
  line: Minus,
  rect: Square,
  spacer: MoveVertical,
  qr: QrCode,
  barcode: Barcode,
  frame: Box,
  repeater: Repeat,
  subreport: TableProperties,
  labels: LayoutGrid,
}

const PALETTE: { group: string; items: { type: ElementType; label: string; single?: boolean; variant?: FrameVariant }[] }[] = [
  {
    group: 'پایه',
    items: [
      { type: 'text', label: 'متن' },
      { type: 'logo', label: 'تصویر / لوگو', single: true },
      { type: 'line', label: 'خط' },
      { type: 'rect', label: 'مستطیل' },
      { type: 'spacer', label: 'فاصله‌گذار' },
    ],
  },
  {
    group: 'داده',
    items: [
      { type: 'table', label: 'جدول', single: true },
      { type: 'qr', label: 'QR Code' },
      { type: 'barcode', label: 'بارکد' },
    ],
  },
  {
    group: 'چیدمان',
    items: [
      { type: 'frame', label: 'Container', variant: 'container' },
      { type: 'frame', label: 'Row', variant: 'row' },
      { type: 'frame', label: 'Column', variant: 'column' },
      { type: 'frame', label: 'Grid', variant: 'grid' },
    ],
  },
  {
    group: 'داده پیشرفته',
    items: [
      { type: 'subreport', label: 'Subreport' },
      { type: 'repeater', label: 'Repeater' },
      { type: 'labels', label: 'Label Sheet' },
    ],
  },
  {
    group: 'امضا و مهر',
    items: [
      { type: 'signature', label: 'امضا', single: true },
      { type: 'stamp', label: 'مهر', single: true },
    ],
  },
]

const FIELD_BY_KEY: Record<string, keyof SampleRow> = {
  rank: 'row_number',
  contract: 'contract',
  passenger: 'passenger',
  description: 'description',
  date: 'date',
  notes: 'notes',
  debit: 'debit_display',
  credit: 'credit_display',
  balance: 'balance_display',
}

const PANEL = 'rounded-2xl border border-nx-navy-border bg-nx-navy-elevated'
const INPUT =
  'w-full px-2.5 py-1.5 rounded-lg border border-nx-navy-border bg-nx-navy !text-white placeholder:!text-nx-mist/45 text-xs outline-none focus:ring-2 focus:ring-nx-blue'
const LABEL = 'block text-[11px] text-nx-mist mb-1'
const BTN =
  'inline-flex items-center gap-1.5 rounded-lg border border-nx-navy-border px-2.5 py-1.5 text-xs text-nx-mist hover:text-white hover:bg-nx-navy transition disabled:opacity-40'

let idCounter = 0
const newId = (type: ElementType) => `${type}-${Date.now().toString(36)}-${(idCounter += 1)}`

const FIXED_TITLES: Record<string, string> = {
  title: 'عنوان صورت‌حساب',
  meta: 'تاریخ و شماره',
  totals: 'جمع کل نهایی',
  footer_note: 'یادداشت پایین',
}

function elementTitle(element: DesignElement): string {
  if (FIXED_TITLES[element.id]) return FIXED_TITLES[element.id]
  if (element.type === 'text') {
    const first = (element.text || '').split('\n')[0].trim()
    return first ? first.slice(0, 28) : 'متن خالی'
  }
  return TYPE_LABELS[element.type]
}

function substitute(text: string, values: Record<string, string>): string {
  return (text || '').replace(/\{([a-z_]+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  )
}

function zoneOf(element: DesignElement, height: number): 'header' | 'body' | 'footer' {
  if (element.y < height * 0.2) return 'header'
  if (element.y > height * 0.78) return 'footer'
  return 'body'
}

export default function ReportDesignerTab() {
  const { toast } = useToast()
  const [payload, setPayload] = useState<Payload | null>(null)
  const [design, setDesign] = useState<Design | null>(null)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [editingId, setEditingId] = useState<string>('')
  const [preview, setPreview] = useState(false)
  const [zoom, setZoom] = useState(2.2)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'page' | 'element'>('page')
  const [history, setHistory] = useState<Design[]>([])
  const [future, setFuture] = useState<Design[]>([])
  const [dbField, setDbField] = useState('buyer_name')
  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; x: number; y: number; w: number; h: number } | null>(null)
  const designRef = useRef<Design | null>(null)
  designRef.current = design

  const load = useCallback(() => {
    setLoading(true)
    api
      .get('/billing/report-design/')
      .then((response) => {
        setPayload(response.data)
        setDesign(response.data.design)
        setName(response.data.name)
        setSelectedId('')
        setDirty(false)
        setHistory([])
        setFuture([])
      })
      .catch(() => toast('خطا در دریافت گزارش‌ساز', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const page = PAGE_MM[design?.page_orientation || 'landscape']
  const selected = design?.elements.find((element) => element.id === selectedId) || null

  const pushHistory = useCallback((snapshot: Design) => {
    setHistory((items) => [...items.slice(-49), snapshot])
    setFuture([])
  }, [])

  const mutate = useCallback(
    (updater: (current: Design) => Design) => {
      setDesign((current) => {
        if (!current) return current
        pushHistory(current)
        setDirty(true)
        return updater(current)
      })
    },
    [pushHistory]
  )

  const updateElement = useCallback(
    (id: string, patch: Partial<DesignElement>, snapshot = true) => {
      setDesign((current) => {
        if (!current) return current
        if (snapshot) pushHistory(current)
        setDirty(true)
        return {
          ...current,
          elements: current.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
        }
      })
    },
    [pushHistory]
  )

  const addDataField = (field: string) => {
    if (!design || !field) return
    const element: DesignElement = {
      id: newId('text'),
      type: 'text',
      x: Math.max(5, Math.round((page.w - 90) / 2)),
      y: Math.max(5, Math.round(page.h / 2)),
      w: 90,
      h: 10,
      show: true,
      text: `{${field}}`,
      size: 10,
      bold: false,
      align: 'right',
      color: '#000000',
      box: false,
      bg: '',
      border: false,
    }
    setHistory((previous) => [...previous, design])
    setDesign({ ...design, elements: [...design.elements, element] })
    setSelectedId(element.id)
    setDirty(true)
  }

  const undo = () => {
    setHistory((items) => {
      if (!items.length || !design) return items
      const previous = items[items.length - 1]
      setFuture((next) => [design, ...next].slice(0, 50))
      setDesign(previous)
      setDirty(true)
      return items.slice(0, -1)
    })
  }

  const redo = () => {
    setFuture((items) => {
      if (!items.length || !design) return items
      const next = items[0]
      setHistory((previous) => [...previous, design])
      setDesign(next)
      setDirty(true)
      return items.slice(1)
    })
  }

  const addElement = (type: ElementType, variant?: FrameVariant) => {
    if (!design) return
    const sizes: Record<ElementType, [number, number]> = {
      text: [70, 10],
      table: [Math.min(page.w - 20, 240), 70],
      logo: [35, 18],
      signature: [60, 28],
      stamp: [60, 28],
      line: [120, 1],
      rect: [60, 24],
      spacer: [60, 10],
      qr: [30, 30],
      barcode: [50, 16],
      frame: type === 'frame' && variant === 'grid' ? [100, 50] : [80, 30],
      repeater: [90, 28],
      subreport: [80, 22],
      labels: [90, 50],
    }
    const [w, h] = sizes[type]
    const element: DesignElement = {
      id: newId(type),
      type,
      x: Math.max(5, Math.min(page.w - w - 5, Math.round((page.w - w) / 2) + ((design.elements.length * 6) % 48) - 24)),
      y: Math.max(5, Math.min(page.h - h - 5, Math.round((page.h - h) / 2) + ((design.elements.length * 6) % 48) - 24)),
      w,
      h,
      show: true,
    }
    if (type === 'text') {
      element.text = 'متن جدید'
      element.size = 11
      element.bold = false
      element.align = 'right'
      element.color = '#000000'
      element.box = false
      element.bg = ''
      element.border = false
    }
    if (type === 'line' || type === 'rect') {
      element.color = design.accent_color
      element.thickness = 0.4
      element.bg = ''
    }
    if (type === 'qr' || type === 'barcode') {
      element.data = '{number}'
    }
    if (type === 'frame') {
      element.variant = variant || 'container'
      element.title = TYPE_LABELS.frame
      element.border = true
      element.thickness = 0.3
      element.bg = ''
    }
    if (type === 'repeater') {
      element.template = '{passenger} — {debt}'
      element.max_rows = 6
      element.size = 10
      element.color = '#000000'
    }
    if (type === 'labels') {
      element.template = '{passenger}'
      element.cols = 2
      element.rows = 4
      element.size = 9
      element.border = true
    }
    if (type === 'subreport') {
      element.source = 'payer_summary'
      element.title = 'خلاصه حساب'
      element.size = 10
    }
    if (type === 'frame' && variant === 'row') element.title = 'Row'
    if (type === 'frame' && variant === 'column') element.title = 'Column'
    if (type === 'frame' && variant === 'grid') element.title = 'Grid'
    if (type === 'table') {
      element.rows_per_page = 8
      element.size = 10
      element.show_page_totals = true
      element.columns = design.elements.find((item) => item.type === 'table')?.columns || payload?.sample.columns.map((column) => ({
        key: column.key,
        label: column.label,
        visible: true,
        width: column.width,
      }))
    }
    mutate((current) => ({ ...current, elements: [...current.elements, element] }))
    setSelectedId(element.id)
    setSettingsTab('element')
  }

  const removeElement = (id: string) => {
    mutate((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== id) }))
    if (selectedId === id) setSelectedId('')
  }

  /** Drag / resize in page millimetres. */
  const startDrag = (event: React.PointerEvent, element: DesignElement, mode: 'move' | 'resize') => {
    if (editingId === element.id) return
    event.stopPropagation()
    event.preventDefault()
    setSelectedId(element.id)
    setSettingsTab('element')
    if (design) pushHistory(design)
    dragRef.current = {
      id: element.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      x: element.x,
      y: element.y,
      w: element.w,
      h: element.h,
    }
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = (event.clientX - drag.startX) / zoom
    const dy = (event.clientY - drag.startY) / zoom
    if (drag.mode === 'move') {
      updateElement(
        drag.id,
        {
          x: Math.round(Math.min(Math.max(0, drag.x + dx), page.w - drag.w)),
          y: Math.round(Math.min(Math.max(0, drag.y + dy), page.h - drag.h)),
        },
        false
      )
    } else {
      updateElement(
        drag.id,
        {
          w: Math.round(Math.min(Math.max(10, drag.w + dx), page.w - drag.x)),
          h: Math.round(Math.min(Math.max(6, drag.h + dy), page.h - drag.y)),
        },
        false
      )
    }
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const save = async () => {
    if (!design) return
    setSaving(true)
    try {
      const response = await api.put('/billing/report-design/', { name, design })
      setPayload(response.data)
      setDesign(response.data.design)
      setDirty(false)
      toast('گزارش‌ساز ذخیره شد؛ صورت‌حساب‌های بعدی با همین چیدمان ساخته می‌شوند.', 'success')
    } catch {
      toast('ذخیره گزارش‌ساز ناموفق بود.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (!window.confirm('طراحی به حالت پیش‌فرض برگردد؟')) return
    setSaving(true)
    try {
      const response = await api.post('/billing/report-design/reset/')
      setPayload(response.data)
      setDesign(response.data.design)
      setName(response.data.name)
      setSelectedId('')
      setDirty(false)
      toast('طراحی پیش‌فرض بازگردانده شد.', 'success')
    } catch {
      toast('بازگردانی طراحی ناموفق بود.', 'error')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (editingId) return
      if (!selectedId) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeElement(selectedId)
      } else if (event.key.startsWith('Arrow')) {
        const current = designRef.current?.elements.find((element) => element.id === selectedId)
        if (!current) return
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        const patch: Partial<DesignElement> = {}
        if (event.key === 'ArrowLeft') patch.x = Math.max(0, current.x - step)
        if (event.key === 'ArrowRight') patch.x = Math.min(page.w - current.w, current.x + step)
        if (event.key === 'ArrowUp') patch.y = Math.max(0, current.y - step)
        if (event.key === 'ArrowDown') patch.y = Math.min(page.h - current.h, current.y + step)
        updateElement(selectedId, patch, false)
      } else if (event.key === 'Escape') {
        setSelectedId('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, selectedId, page.w, page.h])

  const groups = useMemo(() => {
    const result = { header: [], body: [], footer: [] } as Record<'header' | 'body' | 'footer', DesignElement[]>
    for (const element of design?.elements || []) result[zoneOf(element, page.h)].push(element)
    return result
  }, [design, page.h])

  const savedLabel = useMemo(() => {
    if (!payload?.updated_at) return ''
    try {
      return new Date(payload.updated_at).toLocaleString('fa-IR')
    } catch {
      return ''
    }
  }, [payload?.updated_at])

  if (loading || !design || !payload) {
    return <div className="p-12 text-center text-nx-mist">در حال بارگذاری گزارش‌ساز…</div>
  }

  const canvasW = page.w * zoom
  const canvasH = page.h * zoom
  const tickStep = zoom > 2.6 ? 10 : 20

  return (
    <div className={`${PANEL} overflow-hidden`}>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-nx-navy-border px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-white">
          <LayoutTemplate className="w-4 h-4 text-nx-blue" /> گزارش‌ساز صورت‌حساب
        </span>
        <input
          className={`${INPUT} max-w-[220px]`}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setDirty(true)
          }}
        />
        <span className={`text-[11px] ${dirty ? 'text-amber-400' : 'text-nx-mist/60'}`}>
          {dirty ? 'ذخیره‌نشده' : savedLabel ? `آخرین ذخیره: ${savedLabel}` : 'ذخیره‌شده'}
        </span>
        <div className="mr-auto flex items-center gap-1.5">
          <button type="button" className={BTN} onClick={undo} disabled={!history.length} title="واگرد">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" className={BTN} onClick={redo} disabled={!future.length} title="ازنو">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className={`${BTN} ${preview ? 'bg-nx-blue/20 !text-white' : ''}`}
            onClick={() => setPreview((value) => !value)}
          >
            <Eye className="w-3.5 h-3.5" /> {preview ? 'ویرایش' : 'پیش‌نمایش'}
          </button>
          <button type="button" className={BTN} onClick={reset} disabled={saving}>
            <RotateCcw className="w-3.5 h-3.5" /> پیش‌فرض
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-nx-blue px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
        </div>
      </div>

      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_270px]">
        {/* Structure */}
        <aside className="border-l border-nx-navy-border bg-nx-navy/60">
          <div className="border-b border-nx-navy-border/70 px-2 py-2">
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-nx-mist/60">اجزا</p>
            <div className="space-y-2">
              {PALETTE.map((group) => (
                <div key={group.group}>
                  <p className="px-1 pb-1 text-[10px] text-nx-mist/50">{group.group}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {group.items.map((item) => {
                      const Icon = TYPE_ICONS[item.type]
                      const disabled = !!item.single && design.elements.some((element) => element.type === item.type)
                      return (
                        <button
                          key={`${item.type}-${item.variant || ''}`}
                          type="button"
                          disabled={disabled}
                          title={disabled ? 'این جزء قبلاً اضافه شده است' : `افزودن ${item.label}`}
                          onClick={() => addElement(item.type, item.variant)}
                          className="flex items-center gap-1 rounded-md border border-nx-navy-border/70 px-1.5 py-1.5 text-[10px] text-nx-mist hover:border-nx-blue hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Icon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="rounded-md border border-nx-navy-border/70 p-2">
                <p className="mb-1 text-[10px] text-nx-mist/50">کامپوننت از دیتابیس</p>
                <select
                  value={dbField}
                  onChange={(event) => setDbField(event.target.value)}
                  className="w-full rounded-md border border-nx-navy-border bg-nx-navy px-1.5 py-1 text-[10px] text-nx-mist outline-none"
                >
                  {Object.keys(payload.sample.values).map((field) => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => addDataField(dbField)}
                  className="mt-1 w-full rounded-md bg-nx-blue/20 px-1.5 py-1 text-[10px] text-white hover:bg-nx-blue/30"
                >
                  افزودن فیلد «{dbField}»
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Ungroup className="w-3.5 h-3.5 text-nx-mist" /> ساختار
            </span>
            <div className="relative group">
              <button type="button" className="rounded-md p-1 text-nx-mist hover:bg-nx-navy hover:text-white">
                <Plus className="w-4 h-4" />
              </button>
              <div className="invisible absolute left-0 top-full z-20 w-36 rounded-lg border border-nx-navy-border bg-nx-navy-elevated p-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                {(['text', 'table', 'logo', 'signature', 'stamp'] as ElementType[]).map((type) => {
                  const Icon = TYPE_ICONS[type]
                  const exists = design.elements.some((element) => element.type === type)
                  if (exists && type !== 'text') return null
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addElement(type)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-nx-mist hover:bg-nx-navy hover:text-white"
                    >
                      <Icon className="w-3.5 h-3.5" /> {TYPE_LABELS[type]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="space-y-2 px-2 pb-3">
            {(['header', 'body', 'footer'] as const).map((zone) => (
              <div key={zone}>
                <div className="flex items-center gap-1 px-1 py-1 text-[10px] font-bold uppercase tracking-wide text-nx-mist/60">
                  <ArrowDown className="w-3 h-3" />
                  {zone === 'header' ? 'سربرگ صفحه' : zone === 'body' ? 'بدنه' : 'پابرگ'}
                </div>
                {groups[zone].length === 0 && <p className="px-2 pb-1 text-[10px] text-nx-mist/40">خالی</p>}
                {groups[zone].map((element) => {
                  const Icon = TYPE_ICONS[element.type]
                  return (
                    <div
                      key={element.id}
                      onClick={() => {
                        setSelectedId(element.id)
                        setSettingsTab('element')
                      }}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] ${
                        selectedId === element.id ? 'bg-nx-blue/20 text-white' : 'text-nx-mist hover:bg-nx-navy'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{elementTitle(element)}</span>
                      <button
                        type="button"
                        title={element.show ? 'مخفی‌کردن' : 'نمایش'}
                        onClick={(event) => {
                          event.stopPropagation()
                          updateElement(element.id, { show: !element.show })
                        }}
                        className="text-nx-mist/70 hover:text-white"
                      >
                        {element.show ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <section className="flex min-w-0 flex-col bg-slate-200/70">
          <div className="flex items-center justify-between border-b border-nx-navy-border bg-nx-navy-elevated px-3 py-1.5 text-[11px] text-nx-mist">
            <span>
              صفحه {page.w}×{page.h} میلی‌متر · {design.page_orientation === 'landscape' ? 'افقی' : 'عمودی'}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" className={BTN} onClick={() => setZoom((value) => Math.max(1.2, Math.round((value - 0.2) * 10) / 10))}>
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-10 text-center">{Math.round((zoom / 2.2) * 100)}٪</span>
              <button type="button" className={BTN} onClick={() => setZoom((value) => Math.min(3.4, Math.round((value + 0.2) * 10) / 10))}>
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6" onClick={() => setSelectedId('')}>
            <div className="mx-auto" style={{ width: canvasW + 22 }}>
              {/* ruler */}
              <div className="mb-1 flex" style={{ paddingRight: 22 }}>
                <div className="relative h-4 flex-1 border-b border-slate-400 text-[8px] text-slate-500">
                  {Array.from({ length: Math.floor(page.w / tickStep) + 1 }).map((_, index) => (
                    <span key={index} className="absolute -translate-x-1/2" style={{ right: index * tickStep * zoom }}>
                      {index * tickStep}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex">
                <div className="relative mr-1 w-4 text-[8px] text-slate-500" style={{ height: canvasH }}>
                  {Array.from({ length: Math.floor(page.h / tickStep) + 1 }).map((_, index) => (
                    <span key={index} className="absolute" style={{ top: index * tickStep * zoom }}>
                      {index * tickStep}
                    </span>
                  ))}
                </div>
                <div
                  dir="ltr"
                  className="relative bg-white shadow-xl"
                  style={{ width: canvasW, height: canvasH, fontFamily: design.font_family === 'KKT Vazirmatn' ? 'Vazirmatn, Tahoma, sans-serif' : `'${design.font_family}', Tahoma, sans-serif` }}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerLeave={endDrag}
                >
                  {design.elements.filter((element) => element.show).map((element) => {
                    const common = {
                      className: `absolute ${selectedId === element.id && !preview ? 'ring-2 ring-blue-500' : ''}`,
                      style: {
                        left: element.x * zoom,
                        top: element.y * zoom,
                        width: element.w * zoom,
                        height: element.h * zoom,
                        direction: 'rtl' as const,
                      },
                      onPointerDown: (event: React.PointerEvent) => startDrag(event, element, 'move'),
                      onDoubleClick: (event: React.MouseEvent) => {
                        event.stopPropagation()
                        if (element.type === 'text') {
                          setEditingId(element.id)
                          setSelectedId(element.id)
                        }
                      },
                      onClick: (event: React.MouseEvent) => {
                        event.stopPropagation()
                        if (!preview) setSelectedId(element.id)
                      },
                    }

                    if (element.type === 'text') {
                      const content = substitute(element.text || '', payload.sample.values)
                      return (
                        <div
                          key={element.id} {...common}
                          className={`${common.className} overflow-hidden`}
                          style={{
                            ...common.style,
                            fontSize: (element.size || 11) * 0.3528 * zoom * 1.35,
                            fontWeight: element.bold ? 700 : 400,
                            textAlign: element.align || 'right',
                            color: element.color || '#000',
                            background: element.box ? element.bg || '#f0f0f0' : 'transparent',
                            border: element.border ? `${Math.max(1, 0.4 * zoom * 0.5)}px solid ${design.accent_color}` : 'none',
                            padding: element.border ? 3 : 0,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.45,
                          }}
                        >
                          {editingId === element.id && !preview ? (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              autoFocus
                              className="h-full w-full outline-none"
                              onBlur={(event) => {
                                updateElement(element.id, { text: event.currentTarget.innerText })
                                setEditingId('')
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  ;(event.currentTarget as HTMLElement).blur()
                                }
                              }}
                            >
                              {element.text}
                            </div>
                          ) : (
                            content
                          )}
                        </div>
                      )
                    }

                    if (element.type === 'table') {
                      const columns = (element.columns || []).filter((column) => column.visible)
                      const rows = payload.sample.rows.slice(0, element.rows_per_page || 8)
                      const fontSize = (element.size || 10) * 0.3528 * zoom * 1.35
                      return (
                        <div key={element.id} {...common} style={{ ...common.style, overflow: 'hidden' }}>
                          <table className="w-full table-fixed border-collapse" style={{ fontSize }}>
                            <colgroup>
                              {columns.map((column) => (
                                <col key={column.key} style={{ width: `${column.width}%` }} />
                              ))}
                            </colgroup>
                            <thead>
                              <tr>
                                {columns.map((column) => (
                                  <th
                                    key={column.key}
                                    className="overflow-hidden border text-center"
                                    style={{ borderColor: design.accent_color, background: design.header_bg, padding: '2px 3px' }}
                                  >
                                    {column.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, index) => (
                                <tr key={index}>
                                  {columns.map((column) => (
                                    <td
                                      key={column.key}
                                      className="overflow-hidden border text-center"
                                      style={{ borderColor: design.accent_color, padding: '2px 3px' }}
                                    >
                                      {row[FIELD_BY_KEY[column.key]]}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                              {element.show_page_totals && (
                                <tr style={{ fontWeight: 700 }}>
                                  {columns.map((column, index) => (
                                    <td key={column.key} className="border text-center" style={{ borderColor: design.accent_color, padding: '2px 3px' }}>
                                      {index === 0 ? 'جمع صفحه' : column.key === 'debit' ? payload.sample.values.page_debt : column.key === 'credit' ? payload.sample.values.page_credit : column.key === 'balance' ? payload.sample.values.page_balance : ''}
                                    </td>
                                  ))}
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )
                    }

                    if (element.type === 'frame') {
                      const variant = element.variant || 'container'
                      const lines =
                        variant === 'row'
                          ? 'repeating-linear-gradient(to left, transparent 0 24%, #94a3b822 24%, transparent 24.4%)'
                          : variant === 'column'
                            ? 'repeating-linear-gradient(to bottom, transparent 0 24%, #94a3b822 24%, transparent 24.4%)'
                            : variant === 'grid'
                              ? 'linear-gradient(to right, #94a3b822 0 1px, transparent 1px 25%), linear-gradient(to bottom, #94a3b822 0 1px, transparent 1px 25%)'
                              : 'none'
                      return (
                        <div
                          key={element.id} {...common}
                          style={{
                            ...common.style,
                            border: `${Math.max(1, (element.thickness || 0.3) * zoom * 0.5)}px dashed ${element.color || design.accent_color}`,
                            background: element.bg || 'transparent',
                            backgroundImage: lines,
                          }}
                        >
                          <span
                            className="absolute -top-2 right-2 px-1 text-[8px] font-semibold"
                            style={{                             background: design.header_bg, color: design.accent_color }}
                          >
                            {element.title || TYPE_LABELS.frame}
                          </span>
                        </div>
                      )
                    }

                    if (element.type === 'repeater') {
                      const rows = payload.sample.rows.slice(0, element.max_rows || 6)
                      return (
                        <div
                          key={element.id} {...common}
                          style={{
                            ...common.style,
                            color: element.color || '#111827',
                            fontSize: `${Math.max(7, (element.size || 10) * zoom * 0.34)}px`,
                          }}
                        >
                          {rows.map((row, index) => (
                            <div key={index} className="truncate border-b border-dotted border-slate-300 py-0.5">
                              {substitute(element.template || '', { ...payload.sample.values, ...row, debt: row.debit_display, credit: row.credit_display, balance: row.balance_display })}
                            </div>
                          ))}
                        </div>
                      )
                    }

                    if (element.type === 'subreport') {
                      const lines = payload.sample.subreports?.[element.source || 'payer_summary'] || []
                      return (
                        <div
                          key={element.id} {...common}
                          className={`${common.className} border border-slate-300 bg-white/70 p-1`}
                          style={{ ...common.style, fontSize: `${Math.max(7, (element.size || 10) * zoom * 0.34)}px` }}
                        >
                          {element.title && (
                            <div className="mb-1 border-b font-bold" style={{ borderColor: design.accent_color, color: design.accent_color }}>
                              {element.title}
                            </div>
                          )}
                          {lines.map((line, index) => <div key={index} className="truncate">{line}</div>)}
                        </div>
                      )
                    }

                    if (element.type === 'labels') {
                      const capacity = (element.cols || 2) * (element.rows || 4)
                      const cells = payload.sample.rows.slice(0, capacity)
                      return (
                        <div
                          key={element.id} {...common}
                          style={{
                            ...common.style,
                            display: 'grid',
                            gridTemplateColumns: `repeat(${element.cols || 2}, 1fr)`,
                            gridTemplateRows: `repeat(${element.rows || 4}, 1fr)`,
                            gap: 2,
                            fontSize: `${Math.max(6, (element.size || 9) * zoom * 0.3)}px`,
                          }}
                        >
                          {cells.map((row, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-center overflow-hidden text-center"
                              style={{ border: element.border === false ? 'none' : `1px solid ${design.accent_color}66` }}
                            >
                              {substitute(element.template || '', { ...payload.sample.values, ...row, debt: row.debit_display, credit: row.credit_display, balance: row.balance_display })}
                            </div>
                          ))}
                        </div>
                      )
                    }

                    if (element.type === 'line') {
                      return (
                        <div
                          key={element.id} {...common}
                          style={{ ...common.style, borderTop: `${Math.max(1, (element.thickness || 0.4) * zoom * 0.5)}px solid ${element.color || design.accent_color}` }}
                        />
                      )
                    }

                    if (element.type === 'rect') {
                      return (
                        <div
                          key={element.id} {...common}
                          style={{
                            ...common.style,
                            border: `${Math.max(1, (element.thickness || 0.4) * zoom * 0.5)}px solid ${element.color || design.accent_color}`,
                            background: element.bg || 'transparent',
                          }}
                        />
                      )
                    }

                    if (element.type === 'spacer') {
                      return (
                        <div
                          key={element.id} {...common}
                          className={`${common.className} flex items-center justify-center border border-dashed border-slate-400 text-[9px] text-slate-400`}
                          style={common.style}
                        >
                          فاصله‌گذار
                        </div>
                      )
                    }

                    if (element.type === 'qr' || element.type === 'barcode') {
                      const Icon = TYPE_ICONS[element.type]
                      return (
                        <div key={element.id} {...common} className={`${common.className} flex flex-col items-center justify-center border border-slate-300 bg-white/70 text-[8px] text-slate-500`} style={common.style}>
                          <Icon className="mb-1 h-4 w-4" />
                          <span className="max-w-full truncate px-1" dir="ltr">{substitute(element.data || '', payload.sample.values)}</span>
                        </div>
                      )
                    }

                    const label = element.type === 'logo' ? 'لوگو شرکت' : element.type === 'signature' ? 'امضای مدیر' : design.signature_label
                    return (
                      <div
                        key={element.id} {...common}
                        className={`${common.className} flex flex-col items-center justify-center border border-dashed border-slate-400 bg-slate-50/60 text-[10px] text-slate-500`}
                        style={common.style}
                      >
                        {element.type === 'logo' ? <ImageIcon className="mb-1 h-5 w-5" /> : element.type === 'signature' ? <PenTool className="mb-1 h-5 w-5" /> : <Stamp className="mb-1 h-5 w-5" />}
                        <span>{label}</span>
                        <span className="mt-1 text-[8px] text-slate-400">................................</span>
                      </div>
                    )
                  })}

                  {!preview && selected && (
                    <button
                      type="button"
                      onPointerDown={(event) => startDrag(event, selected, 'resize')}
                      className="absolute z-10 h-3 w-3 rounded-sm border border-white bg-blue-600"
                      style={{
                        left: selected.x * zoom + selected.w * zoom - 6,
                        top: selected.y * zoom + selected.h * zoom - 6,
                        cursor: 'nwse-resize',
                      }}
                      title="تغییر اندازه"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-nx-navy-border bg-nx-navy-elevated px-3 py-1 text-[10px] text-nx-mist">
            <span>{preview ? 'پیش‌نمایش با داده نمونه' : 'برای جابه‌جایی بکشید · دوبار کلیک روی متن = ویرایش · Delete = حذف'}</span>
            <span className="flex items-center gap-1">
              <MousePointer2 className="w-3 h-3" /> {design.elements.length} عنصر
            </span>
          </div>
        </section>

        {/* Properties */}
        <aside className="border-r border-nx-navy-border bg-nx-navy/60">
          <div className="flex items-center gap-2 border-b border-nx-navy-border px-3 py-2">
            <Settings2 className="w-3.5 h-3.5 text-nx-mist" />
            <button
              type="button"
              onClick={() => setSettingsTab('page')}
              className={`text-xs ${settingsTab === 'page' ? 'font-bold text-white' : 'text-nx-mist'}`}
            >
              تنظیمات صفحه
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab('element')}
              className={`text-xs ${settingsTab === 'element' ? 'font-bold text-white' : 'text-nx-mist'}`}
            >
              عنصر
            </button>
          </div>

          {settingsTab === 'page' || !selected ? (
            <div className="space-y-3 p-3">
              <div>
                <label className={LABEL}>اندازه و جهت</label>
                <select
                  className={INPUT}
                  value={design.page_orientation}
                  onChange={(event) => {
                    const orientation = event.target.value as Orientation
                    mutate((current) => ({
                      ...current,
                      page_orientation: orientation,
                      elements: current.elements.map((element) => {
                        const size = PAGE_MM[orientation]
                        return {
                          ...element,
                          x: Math.min(element.x, Math.max(0, size.w - element.w)),
                          y: Math.min(element.y, Math.max(0, size.h - element.h)),
                          w: Math.min(element.w, size.w),
                          h: Math.min(element.h, size.h),
                        }
                      }),
                    }))
                  }}
                >
                  <option value="landscape">A4 افقی (۲۹۷×۲۱۰)</option>
                  <option value="portrait">A4 عمودی (۲۱۰×۲۹۷)</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>فونت</label>
                <select className={INPUT} value={design.font_family} onChange={(event) => mutate((current) => ({ ...current, font_family: event.target.value }))}>
                  {FONTS.map((font) => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={LABEL}>رنگ خطوط</label>
                  <input type="color" className="h-8 w-full rounded-lg border border-nx-navy-border bg-nx-navy" value={design.accent_color} onChange={(event) => mutate((current) => ({ ...current, accent_color: event.target.value }))} />
                </div>
                <div>
                  <label className={LABEL}>رنگ سرستون</label>
                  <input type="color" className="h-8 w-full rounded-lg border border-nx-navy-border bg-nx-navy" value={design.header_bg} onChange={(event) => mutate((current) => ({ ...current, header_bg: event.target.value }))} />
                </div>
              </div>
              <div>
                <label className={LABEL}>برچسب مهر</label>
                <input className={INPUT} value={design.signature_label} onChange={(event) => mutate((current) => ({ ...current, signature_label: event.target.value }))} />
              </div>
              <div className="rounded-lg border border-nx-navy-border/70 p-2 text-[10px] leading-5 text-nx-mist/80">
                متغیرهای متن: <br />
                <code>{'{service_type}'}</code> · <code>{'{buyer_name}'}</code> · <code>{'{number}'}</code> · <code>{'{date}'}</code> · <code>{'{grand_debt}'}</code> · <code>{'{grand_credit}'}</code> · <code>{'{grand_balance}'}</code> · <code>{'{manager_name}'}</code>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  {elementTitle(selected)} <span className="font-normal text-nx-mist/60">({TYPE_LABELS[selected.type]})</span>
                </span>
                <button type="button" className="text-rose-400 hover:text-rose-300" onClick={() => removeElement(selected.id)} title="حذف">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'w', 'h'] as const).map((key) => (
                  <div key={key}>
                    <label className={LABEL}>{key === 'x' ? 'X (mm)' : key === 'y' ? 'Y (mm)' : key === 'w' ? 'عرض' : 'ارتفاع'}</label>
                    <input
                      type="number"
                      className={INPUT}
                      value={Math.round(selected[key])}
                      onChange={(event) => updateElement(selected.id, { [key]: Number(event.target.value) || 0 })}
                    />
                  </div>
                ))}
              </div>

              {selected.type === 'text' && (
                <>
                  <div>
                    <label className={LABEL}>متن</label>
                    <textarea
                      rows={3}
                      className={INPUT}
                      value={selected.text || ''}
                      onChange={(event) => updateElement(selected.id, { text: event.target.value }, false)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LABEL}>اندازه (pt)</label>
                      <input type="number" className={INPUT} value={selected.size || 11} onChange={(event) => updateElement(selected.id, { size: Number(event.target.value) || 10 })} />
                    </div>
                    <div>
                      <label className={LABEL}>رنگ متن</label>
                      <input type="color" className="h-8 w-full rounded-lg border border-nx-navy-border bg-nx-navy" value={selected.color || '#000000'} onChange={(event) => updateElement(selected.id, { color: event.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {([['right', AlignRight], ['center', AlignCenter], ['left', AlignLeft]] as const).map(([align, Icon]) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => updateElement(selected.id, { align })}
                        className={`rounded-md border px-2 py-1 ${selected.align === align ? 'border-nx-blue bg-nx-blue/20 text-white' : 'border-nx-navy-border text-nx-mist'}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateElement(selected.id, { bold: !selected.bold })}
                      className={`rounded-md border px-2 py-1 text-xs font-bold ${selected.bold ? 'border-nx-blue bg-nx-blue/20 text-white' : 'border-nx-navy-border text-nx-mist'}`}
                    >
                      B
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-nx-mist">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={!!selected.box} onChange={(event) => updateElement(selected.id, { box: event.target.checked })} className="accent-nx-blue" /> کادر رنگی
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={!!selected.border} onChange={(event) => updateElement(selected.id, { border: event.target.checked })} className="accent-nx-blue" /> حاشیه
                    </label>
                  </div>
                  {selected.box && (
                    <div>
                      <label className={LABEL}>رنگ پس‌زمینه</label>
                      <input type="color" className="h-8 w-full rounded-lg border border-nx-navy-border bg-nx-navy" value={selected.bg || '#f0f0f0'} onChange={(event) => updateElement(selected.id, { bg: event.target.value })} />
                    </div>
                  )}
                </>
              )}

              {selected.type === 'table' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LABEL}>سطر در صفحه</label>
                      <input type="number" min={1} max={20} className={INPUT} value={selected.rows_per_page || 8} onChange={(event) => updateElement(selected.id, { rows_per_page: Math.max(1, Math.min(20, Number(event.target.value) || 8)) })} />
                    </div>
                    <div>
                      <label className={LABEL}>اندازه فونت</label>
                      <input type="number" className={INPUT} value={selected.size || 10} onChange={(event) => updateElement(selected.id, { size: Number(event.target.value) || 10 })} />
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-nx-mist">
                    <input type="checkbox" checked={!!selected.show_page_totals} onChange={(event) => updateElement(selected.id, { show_page_totals: event.target.checked })} className="accent-nx-blue" /> جمع هر صفحه
                  </label>
                  <div>
                    <label className={LABEL}>ستون‌ها (برچسب · عرض ٪)</label>
                    <div className="space-y-1.5">
                      {(selected.columns || []).map((column) => (
                        <div key={column.key} className="flex items-center gap-1">
                          <input type="checkbox" checked={column.visible} onChange={(event) => updateElement(selected.id, { columns: (selected.columns || []).map((item) => item.key === column.key ? { ...item, visible: event.target.checked } : item) })} className="accent-nx-blue" />
                          <input
                            className={`${INPUT} flex-1`}
                            value={column.label}
                            onChange={(event) => updateElement(selected.id, { columns: (selected.columns || []).map((item) => item.key === column.key ? { ...item, label: event.target.value } : item) }, false)}
                          />
                          <input
                            type="number"
                            className={`${INPUT} w-14`}
                            value={column.width}
                            onChange={(event) => updateElement(selected.id, { columns: (selected.columns || []).map((item) => item.key === column.key ? { ...item, width: Math.max(3, Math.min(60, Number(event.target.value) || 10)) } : item) })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(selected.type === 'line' || selected.type === 'rect') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>رنگ</label>
                    <input type="color" className="h-8 w-full rounded-lg border border-nx-navy-border bg-nx-navy" value={selected.color || design.accent_color} onChange={(event) => updateElement(selected.id, { color: event.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL}>ضخامت (mm)</label>
                    <input type="number" step="0.1" min={0.1} max={3} className={INPUT} value={selected.thickness || 0.4} onChange={(event) => updateElement(selected.id, { thickness: Number(event.target.value) || 0.4 })} />
                  </div>
                  {selected.type === 'rect' && (
                    <div className="col-span-2">
                      <label className={LABEL}>رنگ داخل (خالی = بدون رنگ)</label>
                      <div className="flex items-center gap-2">
                        <input type="color" className="h-8 w-16 rounded-lg border border-nx-navy-border bg-nx-navy" value={selected.bg || '#ffffff'} onChange={(event) => updateElement(selected.id, { bg: event.target.value })} />
                        <button type="button" className={BTN} onClick={() => updateElement(selected.id, { bg: '' })}>بدون رنگ</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(selected.type === 'qr' || selected.type === 'barcode') && (
                <div>
                  <label className={LABEL}>مقدار (می‌تواند متغیر داشته باشد)</label>
                  <input className={INPUT} dir="ltr" value={selected.data || ''} onChange={(event) => updateElement(selected.id, { data: event.target.value }, false)} />
                  <p className="mt-1 text-[10px] text-nx-mist/60">مثال: {'{number}'} یا {'{buyer_name}'}</p>
                </div>
              )}

              {selected.type === 'frame' && (
                <>
                  <div>
                    <label className={LABEL}>نوع چیدمان</label>
                    <select className={INPUT} value={selected.variant || 'container'} onChange={(event) => updateElement(selected.id, { variant: event.target.value as FrameVariant })}>
                      <option value="container">Container</option>
                      <option value="row">Row</option>
                      <option value="column">Column</option>
                      <option value="grid">Grid</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>عنوان قاب</label>
                    <input className={INPUT} value={selected.title || ''} onChange={(event) => updateElement(selected.id, { title: event.target.value }, false)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LABEL}>ضخامت (mm)</label>
                      <input type="number" step="0.1" min={0.1} max={2} className={INPUT} value={selected.thickness || 0.3} onChange={(event) => updateElement(selected.id, { thickness: Number(event.target.value) || 0.3 })} />
                    </div>
                    <label className="mt-4 flex items-center gap-1.5 text-[11px] text-nx-mist">
                      <input type="checkbox" checked={selected.border !== false} onChange={(event) => updateElement(selected.id, { border: event.target.checked })} className="accent-nx-blue" /> خط‌چین
                    </label>
                  </div>
                  <div>
                    <label className={LABEL}>رنگ پس‌زمینه (خالی = بدون رنگ)</label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="h-8 w-16 rounded-lg border border-nx-navy-border bg-nx-navy" value={selected.bg || '#ffffff'} onChange={(event) => updateElement(selected.id, { bg: event.target.value })} />
                      <button type="button" className={BTN} onClick={() => updateElement(selected.id, { bg: '' })}>بدون رنگ</button>
                    </div>
                  </div>
                </>
              )}

              {selected.type === 'repeater' && (
                <>
                  <div>
                    <label className={LABEL}>قالب هر سطر</label>
                    <textarea rows={3} className={`${INPUT} resize-y`} value={selected.template || ''} onChange={(event) => updateElement(selected.id, { template: event.target.value }, false)} />
                    <p className="mt-1 text-[10px] text-nx-mist/60">مثال: {'{passenger}'} — {'{debt}'} ریال</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LABEL}>حداکثر سطر</label>
                      <input type="number" min={1} max={20} className={INPUT} value={selected.max_rows || 6} onChange={(event) => updateElement(selected.id, { max_rows: Math.max(1, Math.min(20, Number(event.target.value) || 6)) })} />
                    </div>
                    <div>
                      <label className={LABEL}>اندازه فونت</label>
                      <input type="number" min={6} max={20} className={INPUT} value={selected.size || 10} onChange={(event) => updateElement(selected.id, { size: Number(event.target.value) || 10 })} />
                    </div>
                  </div>
                </>
              )}

              {selected.type === 'labels' && (
                <>
                  <div>
                    <label className={LABEL}>متن هر برچسب</label>
                    <textarea rows={2} className={`${INPUT} resize-y`} value={selected.template || ''} onChange={(event) => updateElement(selected.id, { template: event.target.value }, false)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={LABEL}>ستون</label>
                      <input type="number" min={1} max={6} className={INPUT} value={selected.cols || 2} onChange={(event) => updateElement(selected.id, { cols: Math.max(1, Math.min(6, Number(event.target.value) || 2)) })} />
                    </div>
                    <div>
                      <label className={LABEL}>سطر</label>
                      <input type="number" min={1} max={12} className={INPUT} value={selected.rows || 4} onChange={(event) => updateElement(selected.id, { rows: Math.max(1, Math.min(12, Number(event.target.value) || 4)) })} />
                    </div>
                    <div>
                      <label className={LABEL}>فونت</label>
                      <input type="number" min={6} max={20} className={INPUT} value={selected.size || 9} onChange={(event) => updateElement(selected.id, { size: Number(event.target.value) || 9 })} />
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-nx-mist">
                    <input type="checkbox" checked={selected.border !== false} onChange={(event) => updateElement(selected.id, { border: event.target.checked })} className="accent-nx-blue" /> حاشیه برچسب‌ها
                  </label>
                </>
              )}

              {selected.type === 'subreport' && (
                <>
                  <div>
                    <label className={LABEL}>منبع داده</label>
                    <select className={INPUT} value={selected.source || 'payer_summary'} onChange={(event) => updateElement(selected.id, { source: event.target.value as DesignElement['source'] })}>
                      <option value="payer_summary">خلاصه حساب شرکت (دیتابیس)</option>
                      <option value="payments">آخرین پرداخت‌ها (دیتابیس)</option>
                      <option value="invoices">جمع صورتحساب‌ها (دیتابیس)</option>
                      <option value="request">اطلاعات نامه</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>عنوان</label>
                    <input className={INPUT} value={selected.title || ''} onChange={(event) => updateElement(selected.id, { title: event.target.value }, false)} />
                  </div>
                  <div>
                    <label className={LABEL}>اندازه فونت</label>
                    <input type="number" min={6} max={20} className={INPUT} value={selected.size || 10} onChange={(event) => updateElement(selected.id, { size: Number(event.target.value) || 10 })} />
                  </div>
                </>
              )}

              {(selected.type === 'logo' || selected.type === 'signature' || selected.type === 'stamp') && (
                <p className="rounded-lg border border-nx-navy-border/70 p-2 text-[10px] leading-5 text-nx-mist/80">
                  تصویر این بخش از «تنظیمات → سربرگ و اطلاعات نامه» خوانده می‌شود. اگر تصویری بارگذاری نشده باشد، جای امضا با نقطه‌چین چاپ می‌شود.
                </p>
              )}

              <label className="flex items-center gap-1.5 text-[11px] text-nx-mist">
                <input type="checkbox" checked={selected.show} onChange={(event) => updateElement(selected.id, { show: event.target.checked })} className="accent-nx-blue" /> نمایش در PDF
              </label>
            </div>
          )}
          <div className="border-t border-nx-navy-border/70 px-3 py-2 text-[10px] text-nx-mist/60">
            <Lock className="ml-1 inline h-3 w-3" /> تغییرات پس از ذخیره روی صورت‌حساب‌های بعدی اعمال می‌شود.
          </div>
        </aside>
      </div>
    </div>
  )
}
