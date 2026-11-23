import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Responsive, WidthProvider } from 'react-grid-layout'
import { useDashboardStore, controlFiltersToQuery, type DashboardPageConfig, type DashboardFilterControl } from '../store/dashboardStore'
import api from '../api/client'
import ChartWidget from '../components/ChartWidget'
import WidgetConfigPanel from '../components/WidgetConfigPanel'
import DashboardFilterBar from '../components/DashboardFilterBar'
import PageNavBar from '../components/PageNavBar'
import ThemeToggle from '../components/ThemeToggle'
import NotificationBell from '../components/NotificationBell'
import DesignLockModal from '../components/DesignLockModal'
import FloatingChatWidget from '../components/FloatingChatWidget'
import ModuleSwitcherNav from '../components/ModuleSwitcherNav'
import MobileAppNavBar from '../components/MobileAppNavBar'
import { useBrandLogo, useBrandingStore } from '../store/brandingStore'
import { useToast } from '../components/Toast'
import { Plus, ArrowRight, Settings, Trash2, Share2, X, Undo2, Redo2, Filter, XCircle, Download, Maximize2, Minimize2, Play, FileText, Copy, RefreshCw, Clock, ChevronDown, Lock, Unlock, BarChart3, Monitor, Smartphone, EyeOff } from 'lucide-react'
import { ALL_ROLES } from '../utils/roles'
import { useAuthStore } from '../store/authStore'
import { computeResponsiveLayout } from '../utils/layoutUtils'
import { clampGridItem } from '../utils/widgetConstraints'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

// Cached Vazirmatn font base64 to avoid re-fetching on every PDF export
let cachedPersianFontBase64: string | null = null

export default function DashboardBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const {
    pages, activePageId, setPages, setActivePage,
    layout, widgets, setLayout, setWidgets, addWidget, removeWidget, updateWidget,
    setDashboard, filters,    setFilter, removeCrossFilter, filterControls,
    setFilterControls, canUndo, canRedo, undo, redo, pushLayoutSnapshot,
    isDesignLocked, sessionUnlocked, setDesignLockState,
  } = useDashboardStore()

  // Compute active control filters from filterControls state
  const controlFilters = controlFiltersToQuery(filterControls)

  // Derived: active page (must be declared before effects that reference it)
  const activePage = pages.find((p) => p.id === activePageId)
  const { toast } = useToast()
  const brandLogo = useBrandLogo()
  const branding = useBrandingStore((s) => s.branding)
  const currentUser = useAuthStore((s) => s.user)
  const canEdit = currentUser && ['admin', 'ceo', 'finance', 'sales'].includes(currentUser.role)
  const [showConfig, setShowConfig] = useState(false)
  const [editingWidget, setEditingWidget] = useState<string | null>(null)
  const [mobileSettingsWidget, setMobileSettingsWidget] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  // Builder device mode: 'auto' follows viewport; 'desktop'/'mobile' force a layout for editing.
  const [deviceMode, setDeviceMode] = useState<'auto' | 'desktop' | 'mobile'>('auto')
  const [showLockModal, setShowLockModal] = useState(false)
  const isEffectiveDesignLocked = Boolean(isDesignLocked && !sessionUnlocked)

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareRoles, setShareRoles] = useState<string[]>([])
  // Drill-down state
  const [drillState, setDrillState] = useState<Record<string, Array<{ col: string; value: string }>>>({})
  // Track drag/resize state to toggle grid line visibility
  const [isDragging, setIsDragging] = useState(false)
  // Full-screen single widget state
  const [fullScreenWidget, setFullScreenWidget] = useState<string | null>(null)
  // Export dropdown state
  const [exportDropdown, setExportDropdown] = useState<string | null>(null)
  // Presentation mode (no edit controls)
  const [presentMode, setPresentMode] = useState(false)
  // PDF export progress
  const [pdfExporting, setPdfExporting] = useState(false)
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 })
  // Refresh interval config (stored in localStorage)
  const [refreshInterval, setRefreshInterval] = useState(() => {
    return parseInt(localStorage.getItem('nexivo_refresh_interval') || '15')
  })
  const [showRefreshMenu, setShowRefreshMenu] = useState(false)
  const refreshMenuRef = useRef<HTMLDivElement>(null)
  // Last refreshed timestamp
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  // Silent refresh mode (no toast)
  const [silentRefresh, setSilentRefresh] = useState(() => {
    return localStorage.getItem('nexivo_silent_refresh') === 'true'
  })

  // Load per-page filter controls when active page changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activePage) {
      setFilterControls(activePage.filterControls || [])
    }
  }, [activePageId])
  const refreshIntervalRef = useRef(refreshInterval)
  refreshIntervalRef.current = refreshInterval
  const silentRefreshRef = useRef(silentRefresh)
  silentRefreshRef.current = silentRefresh
  useEffect(() => {
    if (!id) return
    const interval = setInterval(() => {
      loadDashboard(parseInt(id), activePageIdRef.current).then(() => {
        setLastRefreshed(new Date())
        if (!silentRefreshRef.current) toast('داده‌ها به‌روزرسانی شد', 'success')
      })
    }, refreshIntervalRef.current * 60 * 1000)
    return () => clearInterval(interval)
  }, [id, refreshInterval])

  // Manual refresh handler
  const handleManualRefresh = async () => {
    if (!id) return
    await loadDashboard(parseInt(id), activePageIdRef.current)
    setLastRefreshed(new Date())
    toast('داده‌ها به‌روزرسانی شد', 'success')
  }

  // Change refresh interval
  const handleChangeRefreshInterval = (minutes: number) => {
    setRefreshInterval(minutes)
    localStorage.setItem('nexivo_refresh_interval', String(minutes))
    setShowRefreshMenu(false)
    toast(`بازه به‌روزرسانی: ${minutes} دقیقه`, 'info')
  }

  // Close refresh menu on outside click
  useEffect(() => {
    if (!showRefreshMenu) return
    const handler = (e: MouseEvent) => {
      if (refreshMenuRef.current && !refreshMenuRef.current.contains(e.target as Node)) {
        setShowRefreshMenu(false)
      }
    }
    const timer = setTimeout(() => window.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); window.removeEventListener('mousedown', handler) }
  }, [showRefreshMenu])

  // Detect mobile/tablet viewport using matchMedia for reliable orientation-aware detection
  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)')
    const check = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches)
    check(mobileQuery)
    mobileQuery.addEventListener('change', check)
    return () => mobileQuery.removeEventListener('change', check)
  }, [])

  // Undo/Redo keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z) with toast
  const handleUndo = useCallback(() => {
    if (canUndo) {
      undo()
      toast('چیدمان بازگردانده شد', 'info')
    }
  }, [canUndo, undo, toast])

  const handleRedo = useCallback(() => {
    if (canRedo) {
      redo()
      toast('چیدمان بازاعمال شد', 'info')
    }
  }, [canRedo, redo, toast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        handleRedo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        handleRedo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()
        handleManualRefresh()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo, handleManualRefresh])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
    }
  }, [])

  const loadDashboard = useCallback(async (dashboardId: number, restorePageId?: string | null) => {
    try {
      const res = await api.get(`/dashboards/${dashboardId}/`)
      setDashboard(res.data.id, res.data.name)
      if (res.data.is_design_locked !== undefined) {
        setDesignLockState(Boolean(res.data.is_design_locked), Boolean(res.data.has_design_password))
      }

      // Load persisted filter controls
      if (res.data.filter_controls) {
        setFilterControls(res.data.filter_controls)
      }

      // Load pages — build layout from raw server data before mapping widgets
      const serverPages: DashboardPageConfig[] = (res.data.pages || []).map((p: Record<string, unknown>) => {
        const rawWidgets = (p.widgets as Array<Record<string, unknown>>) || []
        let pageLayout = (p.layout as Array<Record<string, unknown>> || []).map((l) => ({
          i: String(l.i),
          x: l.x as number,
          y: l.y as number,
          w: l.w as number,
          h: l.h as number,
        }))

        // Backward compat: build layout from widget grid positions when layout is empty
        if (pageLayout.length === 0 && rawWidgets.length > 0) {
          pageLayout = rawWidgets.map((w) => ({
            i: String(w.id),
            x: (w.grid_x as number) ?? 0,
            y: (w.grid_y as number) ?? 0,
            w: (w.grid_w as number) ?? 6,
            h: (w.grid_h as number) ?? 4,
          }))
        }

        // Mobile layout: prefer persisted, else derive a stacked full-width grid
        // from the desktop layout (one widget per row, w=12).
        let mobileLayout = ((p.mobile_layout as Array<Record<string, unknown>>) || []).map((l) => ({
          i: String(l.i),
          x: l.x as number,
          y: l.y as number,
          w: l.w as number,
          h: l.h as number,
        }))
        if (mobileLayout.length === 0) {
          mobileLayout = computeResponsiveLayout(pageLayout, 12)
        }

        return {
          id: String(p.id),
          name: p.name as string,
          order: p.order as number,
          layout: pageLayout,
          mobileLayout,
          filterControls: (p.filter_controls as DashboardFilterControl[]) || [],
          allowedRoles: (p.allowed_roles as string[]) || [],
          widgets: rawWidgets.map((w) => ({
            id: String(w.id),
            title: w.title as string,
            chartType: w.chart_type as string,
            datasetId: w.dataset as number | null,
            chartConfig: (w.chart_config as Record<string, unknown>) || {},
            queryConfig: (w.query_config as Record<string, unknown>) || {},
            columnTypes: (w.column_types as Record<string, string>) || {},
          })),
        }
      })

      if (serverPages.length > 0) {
        setPages(serverPages)
        const pageToSet = restorePageId && serverPages.some((p) => p.id === restorePageId)
          ? restorePageId
          : serverPages[0].id
        setActivePage(pageToSet)
      } else {
        // Legacy: widgets without pages
        const serverWidgets = (res.data.widgets || []).map((w: Record<string, unknown>) => ({
          id: String(w.id),
          title: w.title as string,
          chartType: w.chart_type as string,
          datasetId: w.dataset as number | null,
          chartConfig: (w.chart_config as Record<string, unknown>) || {},
          queryConfig: (w.query_config as Record<string, unknown>) || {},
          columnTypes: (w.column_types as Record<string, string>) || {},
        }))

        const serverLayout = (res.data.widgets || []).map((w: Record<string, unknown>) => ({
          i: String(w.id),
          x: w.grid_x as number,
          y: w.grid_y as number,
          w: w.grid_w as number,
          h: w.grid_h as number,
        }))

        setWidgets(serverWidgets)
        setLayout(serverLayout)
      }
    } catch {
      // ignore
    }
  }, []) // stable Zustand setters don't change

  // Activate loadDashboard effect
  useEffect(() => {
    if (id) loadDashboard(parseInt(id))
  }, [id, loadDashboard])

  // Auto-refresh dashboard at configured interval, preserving the active page
  const activePageIdRef = useRef(activePageId)
  activePageIdRef.current = activePageId
  const currentPageWidgets = (activePage?.widgets || widgets) as Array<{
    id: string
    title: string
    chartType: string
    datasetId: number | null
    chartConfig: Record<string, unknown>
    queryConfig: Record<string, unknown>
    columnTypes?: Record<string, string>
  }>
  // Effective device: builder override beats viewport auto-detection.
  const editingMobile = deviceMode === 'mobile' || (deviceMode === 'auto' && isMobile)
  const desktopLayout = activePage?.layout || layout
  const mobileLayout = activePage?.mobileLayout || computeResponsiveLayout(desktopLayout, 12)
  const currentPageLayout = editingMobile ? mobileLayout : desktopLayout

  // Device visibility helpers
  const isWidgetVisibleOnDevice = useCallback(
    (w: { chartConfig?: Record<string, unknown> }) => {
      const cfg = (w.chartConfig || {}) as Record<string, unknown>
      return editingMobile ? cfg.showOnMobile !== false : cfg.showOnDesktop !== false
    },
    [editingMobile]
  )

  const isViewOnlyMode = presentMode || isEffectiveDesignLocked || !canEdit

  const displayedWidgets = useMemo(() => {
    if (isViewOnlyMode) {
      return currentPageWidgets.filter(isWidgetVisibleOnDevice)
    }
    return currentPageWidgets
  }, [currentPageWidgets, isViewOnlyMode, isWidgetVisibleOnDevice])

  const displayedLayout = useMemo(() => {
    if (isViewOnlyMode) {
      const visibleIds = new Set(displayedWidgets.map((w) => w.id))
      return currentPageLayout.filter((item) => visibleIds.has(item.i))
    }
    return currentPageLayout
  }, [currentPageLayout, displayedWidgets, isViewOnlyMode])

  const toggleWidgetDeviceVisibility = useCallback(
    async (widgetId: string, device: 'desktop' | 'mobile') => {
      if (isEffectiveDesignLocked || !canEdit) return
      const widget = currentPageWidgets.find((w) => w.id === widgetId)
      if (!widget) return
      const currentChartConfig = (widget.chartConfig || {}) as Record<string, unknown>
      const key = device === 'desktop' ? 'showOnDesktop' : 'showOnMobile'
      const currentVal = currentChartConfig[key] !== false
      const nextVal = !currentVal
      const newChartConfig = { ...currentChartConfig, [key]: nextVal }

      updateWidget(widgetId, { chartConfig: newChartConfig })

      if (id) {
        try {
          await api.put(`/dashboards/${id}/widgets/${widgetId}/`, {
            title: widget.title,
            chart_type: widget.chartType,
            dataset: widget.datasetId,
            chart_config: newChartConfig,
            query_config: widget.queryConfig,
          })
          toast(
            nextVal
              ? `نمایش در ${device === 'desktop' ? 'دسکتاپ' : 'موبایل'} فعال شد`
              : `نمایش در ${device === 'desktop' ? 'دسکتاپ' : 'موبایل'} غیرفعال شد`,
            'success'
          )
        } catch {
          toast('خطا در ذخیره وضعیت نمایش دستگاه', 'error')
        }
      }
    },
    [isEffectiveDesignLocked, canEdit, currentPageWidgets, updateWidget, id, toast]
  )

  // Debounced snapshot push — only fires once per drag/resize session
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pushSnapshotDebounced = useCallback(() => {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
    snapshotTimerRef.current = setTimeout(() => {
      pushLayoutSnapshot()
      snapshotTimerRef.current = null
    }, 300)
  }, [pushLayoutSnapshot])

  const handleLayoutChange = useCallback(
    (newLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
      if (isEffectiveDesignLocked) return
      // Push debounced snapshot for undo (fires once per drag/resize session)
      pushSnapshotDebounced()
      // Clamp each widget to its chart type's size constraints
      const clampedLayout = newLayout.map((item) => {
        const widget = currentPageWidgets.find((w) => w.id === item.i)
        return widget ? clampGridItem(item, widget.chartType) : item
      })
      if (activePage && activePageId) {
        const { updatePage } = useDashboardStore.getState()
        if (editingMobile) {
          updatePage(activePageId, { mobileLayout: clampedLayout })
        } else {
          updatePage(activePageId, { layout: clampedLayout })
        }
      } else {
        setLayout(clampedLayout)
      }
      // Persist layout to backend
      if (id) {
        api.put(`/dashboards/${id}/layout/`, {
          layout: newLayout,
          page_id: activePageId || undefined,
          device: editingMobile ? 'mobile' : 'desktop',
        }).catch(() => {})
      }
    },
    [activePageId, id, setLayout, editingMobile, pushSnapshotDebounced, currentPageWidgets, isEffectiveDesignLocked]
  )

  const addNewWidget = async () => {
    if (!id || isEffectiveDesignLocked) return
    try {
      const payload: Record<string, unknown> = {
        title: 'نمودار جدید',
        chart_type: 'bar',
        chart_config: {},
        query_config: {},
        grid_x: 0,
        grid_y: 0,
        grid_w: 6,
        grid_h: 5,
      }
      // Assign widget to active page
      if (activePageId) {
        payload.page = parseInt(activePageId)
      }
      const res = await api.post(`/dashboards/${id}/widgets/`, payload)
      addWidget({
        id: String(res.data.id),
        title: res.data.title,
        chartType: res.data.chart_type,
        datasetId: res.data.dataset,
        chartConfig: res.data.chart_config,
        queryConfig: res.data.query_config,
      })
      setEditingWidget(String(res.data.id))
      setShowConfig(true)
    } catch {
      // ignore
    }
  }

  const openShareModal = async () => {
    if (!id) return
    try {
      const res = await api.get(`/dashboards/${id}/`)
      setShareRoles(res.data.allowed_roles || [])
      setShowShareModal(true)
    } catch {
      toast('خطا در دریافت اطلاعات', 'error')
    }
  }

  const handleShareSave = async () => {
    if (!id) return
    try {
      await api.put(`/dashboards/${id}/share/`, { allowed_roles: shareRoles })
      setShowShareModal(false)
      toast('دسترسی‌ها به‌روز شد', 'success')
    } catch {
      toast('خطا در به‌روزرسانی دسترسی‌ها', 'error')
    }
  }

  const deleteWidget = async (widgetId: string) => {
    if (!id || isEffectiveDesignLocked) return
    if (!window.confirm('آیا از حذف این نمودار اطمینان دارید؟')) return
    try {
      await api.delete(`/dashboards/${id}/widgets/${widgetId}/`)
      removeWidget(widgetId)
      setShowConfig(false)
      setEditingWidget(null)
      toast('نمودار حذف شد', 'success')
    } catch {
      toast('خطا در حذف نمودار', 'error')
    }
  }

  // Copy chart to clipboard
  const handleCopyChart = async (w: { id: string; title: string }) => {
    if (!navigator.clipboard || !window.ClipboardItem) {
      toast('کپی در مرورگر شما پشتیبانی نمی‌شود (HTTPS لازم است)', 'error')
      return
    }
    try {
      const container = document.getElementById(`chart-${w.id}`)
      if (!container) { toast('امکان کپی وجود ندارد', 'error'); return }
      const echarts = await import('echarts')
      const instance = echarts.getInstanceByDom(container)
      if (!instance) { toast('امکان کپی وجود ندارد', 'error'); return }
      const dataUrl = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      toast('نمودار در کلیپبورد کپی شد', 'success')
    } catch {
      toast('خطا در کپی نمودار', 'error')
    }
  }

  // Dashboard-level PDF export (all pages)
  const handleExportPdf = async () => {
    // Collect all pages and their widgets
    const allPages = pages.length > 0 ? pages : [{ id: activePageId || '0', name: activePage?.name || 'داشبورد', widgets: currentPageWidgets }]
    const totalWidgets = allPages.reduce((sum, p) => sum + p.widgets.length, 0)
    if (totalWidgets === 0) {
      toast('نموداری برای خروجی وجود ندارد', 'error')
      return
    }
    setPdfExporting(true)
    setPdfProgress({ current: 0, total: totalWidgets })
    try {
      const { default: jsPDF } = await import('jspdf')
      const echartsLib = await import('echarts')

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      // Register Vazirmatn Persian font for proper Farsi text in PDF (cached after first load)
      if (!cachedPersianFontBase64) {
        try {
          const fontRes = await fetch('https://cdn.jsdelivr.net/gh/nicehash/Vazirmatn@master/fonts/ttf/Vazirmatn-Regular.ttf')
          if (fontRes.ok) {
            const fontBlob = await fontRes.arrayBuffer()
            const bytes = new Uint8Array(fontBlob)
            let binary = ''
            const chunkSize = 8192
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
            }
            cachedPersianFontBase64 = btoa(binary)
          }
        } catch {
          // Fallback: PDF will use default font for titles
        }
      }
      let persianFontLoaded = false
      if (cachedPersianFontBase64) {
        try {
          doc.addFileToVFS('Vazirmatn-Regular.ttf', cachedPersianFontBase64)
          doc.addFont('Vazirmatn-Regular.ttf', 'Vazirmatn', 'normal')
          persianFontLoaded = true
        } catch {
          // ignore — fallback to default font
        }
      }
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 10
      const usableWidth = pageWidth - margin * 2
      const usableHeight = pageHeight - margin * 2

      let processedCount = 0

      for (let pageIdx = 0; pageIdx < allPages.length; pageIdx++) {
        const page = allPages[pageIdx]

        // Add new page for each page after the first
        if (pageIdx > 0) {
          doc.addPage()
        }

        // Page title & branding
        if (persianFontLoaded) doc.setFont('Vazirmatn', 'normal')
        doc.setFontSize(14)
        doc.text(`${branding.name || 'نکسیو'} — ${page.name || `صفحه ${pageIdx + 1}`}`, pageWidth / 2, margin + 6, { align: 'center' })
        doc.setFontSize(8)
        doc.setTextColor(120)
        const now = new Date()
        doc.text(`${now.toLocaleDateString('fa-IR')} ${now.toLocaleTimeString('fa-IR')} — صفحه ${pageIdx + 1}/${allPages.length}`, pageWidth / 2, margin + 12, { align: 'center' })
        doc.setTextColor(0)

        // Embed organizational logo if available
        if (brandLogo) {
          try {
            doc.addImage(brandLogo, 'PNG', pageWidth - margin - 22, margin + 1, 20, 10, undefined, 'FAST')
          } catch {
            // skip if format is not supported by jsPDF
          }
        }

        // Collect chart images from this page's widgets
        const chartImages: Array<{ title: string; dataUrl: string }> = []
        for (const w of page.widgets) {
          processedCount++
          setPdfProgress({ current: processedCount, total: totalWidgets })
          // Small delay for UI update
          await new Promise((r) => setTimeout(r, 50))

          const container = document.getElementById(`chart-${w.id}`)
          if (!container) continue
          const instance = echartsLib.getInstanceByDom(container)
          if (!instance) continue
          const dataUrl = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
          chartImages.push({ title: w.title, dataUrl })
        }

        if (chartImages.length === 0) continue

        // Layout: 2 columns with pagination
        const cols = chartImages.length === 1 ? 1 : 2
        const cellWidth = usableWidth / cols
        const cellPadding = 4
        const titleArea = 8
        const cellHeight = cols === 1 ? Math.min(usableHeight - titleArea - 20, 140) : Math.min((usableHeight - titleArea - 20) / 2, 120)

        let curY = margin + titleArea + cellPadding
        let colCount = 0

        for (const img of chartImages) {
          if (colCount >= cols) {
            colCount = 0
            curY += cellHeight + cellPadding
          }
          if (colCount === 0 && curY + cellHeight + titleArea > pageHeight - margin) {
            doc.addPage()
            curY = margin + cellPadding
          }

          const curX = margin + colCount * cellWidth
          const imgWidth = cellWidth - 4
          const imgHeight = cellHeight - 4
          try {
            doc.addImage(img.dataUrl, 'PNG', curX + 2, curY, imgWidth, imgHeight, undefined, 'FAST')
          } catch {
            // skip broken images
          }

          colCount++
        }
      }

      doc.save(`${activePage?.name || 'dashboard'}-all.pdf`)
      toast('PDF همه صفحات دانلود شد', 'success')
    } catch (err) {
      console.error('PDF export error:', err)
      toast('خطا در ساخت PDF', 'error')
    } finally {
      setPdfExporting(false)
      setPdfProgress({ current: 0, total: 0 })
    }
  }

  // Reusable widget card renderer (used in both edit mode and preview modes)
  const renderWidgetCard = (w: { id: string; title: string; chartType: string; datasetId: number | null; chartConfig: Record<string, unknown>; queryConfig: Record<string, unknown>; columnTypes?: Record<string, string> }) => {
    const cfg = (w.chartConfig || {}) as Record<string, unknown>
    const isVisibleOnDevice = editingMobile ? cfg.showOnMobile !== false : cfg.showOnDesktop !== false
    const isHiddenOnCurrentDevice = !isVisibleOnDevice
    const ws = cfg.widgetStyle as { shadow?: string; borderRadius?: number } | undefined
    const shadow = ws?.shadow === 'none' ? '' : ws?.shadow === 'md' ? 'shadow-md' : ws?.shadow === 'lg' ? 'shadow-lg' : 'shadow-sm'
    const radius = ws?.borderRadius ?? 16
    // Check if this widget has active cross-chart filters applied to it
    const activeFilters = filters.filter((f) => f.sourceWidgetId !== w.id)
    const hasActiveFilter = activeFilters.length > 0
    return (
      <div key={w.id} className="group h-full" style={{ direction: 'rtl', textAlign: 'right' }}>
        <div className={`bg-white dark:bg-nx-navy border h-full flex flex-col overflow-hidden ${shadow} hover:shadow-md transition ${
          isHiddenOnCurrentDevice
            ? 'border-dashed border-amber-400 dark:border-amber-500 bg-amber-50/15 dark:bg-amber-950/20'
            : hasActiveFilter
            ? 'border-nx-blue dark:border-nx-blue ring-1 ring-nx-blue/10 dark:ring-nx-blue'
            : 'border-nx-border dark:border-nx-navy-border'
        }`} style={{ borderRadius: radius }}>
          <div className="relative flex items-center px-4 py-2 border-b border-nx-border dark:border-nx-navy-border shrink-0">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-sm font-medium text-nx-navy dark:text-slate-100 truncate max-w-[50%] text-center">
                {w.title}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Active filter indicator */}
              {hasActiveFilter && (
                <div className="flex items-center gap-0.5">
                  {activeFilters.map((f) => (
                    <div
                      key={`${f.col}-${f.sourceWidgetId}`}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 bg-nx-blue/10 dark:bg-nx-blue/40 text-nx-blue dark:text-nx-blue rounded text-[10px] font-medium"
                    >
                      <Filter className="w-2.5 h-2.5" />
                      <span className="max-w-[60px] truncate">{String(f.val)}</span>
                      <button
                        onClick={() => removeCrossFilter(f.col, f.sourceWidgetId)}
                        className="ml-0.5 text-nx-blue hover:text-nx-blue"
                      >
                        <XCircle className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Hidden on current device badge */}
              {isHiddenOnCurrentDevice && (
                <div
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 shrink-0"
                  title={`این نمودار در نمای ${editingMobile ? 'موبایل' : 'دسکتاپ'} برای بینندگان مخفی است`}
                >
                  <EyeOff className="w-2.5 h-2.5" />
                  <span>مخفی در {editingMobile ? 'موبایل' : 'دسکتاپ'}</span>
                </div>
              )}
              {/* Drag handle — hidden when design is locked */}
              {!isEffectiveDesignLocked && (
                <div className="drag-handle p-1 text-slate-600 dark:text-slate-200 cursor-grab active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                </div>
              )}
              {/* Export dropdown — hidden on mobile */}
              {!editingMobile && (
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setExportDropdown(exportDropdown === w.id ? null : w.id)}
                    className="p-1 text-nx-mist hover:text-nx-teal active:text-nx-teal transition opacity-0 group-hover:opacity-100"
                    title="خروجی"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {exportDropdown === w.id && (
                    <div className="absolute left-0 top-full mt-1 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
                      <button
                        onClick={() => {
                          setExportDropdown(null)
                          const container = document.getElementById(`chart-${w.id}`)
                          if (!container) { toast('امکان خروجی وجود ندارد', 'error'); return }
                          import('echarts').then((echarts) => {
                            const instance = echarts.getInstanceByDom(container)
                            if (!instance) { toast('امکان خروجی وجود ندارد', 'error'); return }
                            const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
                            const link = document.createElement('a')
                            link.download = `${w.title || 'chart'}.png`
                            link.href = url
                            link.click()
                            toast('تصویر PNG دانلود شد', 'success')
                          })
                        }}
                        className="w-full px-3 py-2 text-right text-sm text-nx-navy dark:text-nx-mist hover:bg-nx-mist/10 dark:hover:bg-nx-navy transition flex items-center gap-2"
                      >
                        <span className="text-xs font-mono bg-nx-mist/10 dark:bg-nx-navy px-1.5 py-0.5 rounded">PNG</span>
                        <span>تصویر</span>
                      </button>
                      <button
                        onClick={() => {
                          setExportDropdown(null)
                          const container = document.getElementById(`chart-${w.id}`)
                          if (!container) { toast('امکان خروجی وجود ندارد', 'error'); return }
                          import('echarts').then((echarts) => {
                            const instance = echarts.getInstanceByDom(container)
                            if (!instance) { toast('امکان خروجی وجود ندارد', 'error'); return }
                            const url = instance.getDataURL({ type: 'svg', pixelRatio: 2 })
                            const link = document.createElement('a')
                            link.download = `${w.title || 'chart'}.svg`
                            link.href = url
                            link.click()
                            toast('تصویر SVG دانلود شد', 'success')
                          })
                        }}
                        className="w-full px-3 py-2 text-right text-sm text-nx-navy dark:text-nx-mist hover:bg-nx-mist/10 dark:hover:bg-nx-navy transition flex items-center gap-2"
                      >
                        <span className="text-xs font-mono bg-nx-mist/10 dark:bg-nx-navy px-1.5 py-0.5 rounded">SVG</span>
                        <span>برداری</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {/* Copy chart to clipboard — hidden on mobile */}
              {!editingMobile && (
                <button
                  onClick={() => handleCopyChart(w)}
                  className="hidden md:block p-1 text-nx-mist hover:text-nx-blue active:text-nx-blue transition opacity-0 group-hover:opacity-100"
                  title="کپی نمودار"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Full-screen button — hidden on mobile */}
              {!editingMobile && (
                <button
                  onClick={() => setFullScreenWidget(w.id)}
                  className="hidden md:block p-1 text-nx-mist hover:text-nx-blue active:text-nx-blue transition opacity-0 group-hover:opacity-100"
                  title="تمام صفحه"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
              {!isEffectiveDesignLocked && canEdit && (
                <>
                  {/* Quick Device Visibility Switches */}
                  <div className="flex items-center gap-0.5 ml-0.5 border-l border-slate-200 dark:border-nx-navy-border/80 pl-1">
                    <button
                      type="button"
                      onClick={() => toggleWidgetDeviceVisibility(w.id, 'desktop')}
                      className={`p-1 rounded transition text-xs ${
                        cfg.showOnDesktop !== false
                          ? 'text-nx-blue dark:text-nx-teal hover:bg-nx-blue/10'
                          : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'
                      }`}
                      title={`نمایش در دسکتاپ: ${cfg.showOnDesktop !== false ? 'فعال (کلیک برای غیرفعال‌سازی)' : 'غیرفعال (کلیک برای فعال‌سازی)'}`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWidgetDeviceVisibility(w.id, 'mobile')}
                      className={`p-1 rounded transition text-xs ${
                        cfg.showOnMobile !== false
                          ? 'text-nx-blue dark:text-nx-teal hover:bg-nx-blue/10'
                          : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'
                      }`}
                      title={`نمایش در موبایل: ${cfg.showOnMobile !== false ? 'فعال (کلیک برای غیرفعال‌سازی)' : 'غیرفعال (کلیک برای فعال‌سازی)'}`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (isMobile) {
                        setMobileSettingsWidget(w.id)
                      } else {
                        setEditingWidget(w.id)
                        setShowConfig(true)
                      }
                    }}
                    className="p-1 text-nx-mist hover:text-nx-blue active:text-nx-blue transition md:opacity-0 md:group-hover:opacity-100"
                    title="تنظیمات نمودار"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteWidget(w.id)}
                    className="p-1 text-nx-mist hover:text-nx-danger-500 active:text-nx-danger-600 transition md:opacity-0 md:group-hover:opacity-100"
                    title="حذف نمودار"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 w-full min-h-0 p-1 overflow-hidden" id={`chart-${w.id}`}>
            <ChartWidget
              widget={w}
              dashboardFilters={filters}
              dashboardControlFilters={controlFilters}
              onFilter={setFilter}
              drillBreadcrumb={drillState[w.id] || []}
              onDrillDown={(col, value) => {
                setDrillState((prev) => ({
                  ...prev,
                  [w.id]: [...(prev[w.id] || []), { col, value }],
                }))
              }}
              onDrillUp={(index) => {
                setDrillState((prev) => ({
                  ...prev,
                  [w.id]: (prev[w.id] || []).slice(0, index + 1),
                }))
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportDropdown) return
    const handler = () => {
      setExportDropdown(null)
    }
    // Delay to avoid catching the click that opened it
    const timer = setTimeout(() => window.addEventListener('click', handler), 0)
    return () => { clearTimeout(timer); window.removeEventListener('click', handler) }
  }, [exportDropdown])

  // Presentation mode — clean view without edit controls
  if (presentMode) {
    return (
      <div className="min-h-screen bg-white dark:bg-nx-navy" dir="rtl">
        {/* Floating exit button */}
        <button
          onClick={() => setPresentMode(false)}
          className="fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-nx-navy dark:bg-white text-white dark:text-nx-navy rounded-full shadow-lg hover:scale-105 transition text-sm font-medium"
        >
          <Minimize2 className="w-4 h-4" />
          خروج از ارائه
        </button>
        {/* Dashboard title */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold text-nx-navy dark:text-slate-100">{activePage?.name || 'داشبورد'}</h1>
        </div>
        {/* Grid without editing controls */}
        <main className="px-4 sm:px-6 pb-[calc(112px+env(safe-area-inset-bottom,0px))] lg:pb-12">
          {displayedWidgets.length > 0 && (
            <div className="react-grid-layout-wrapper">
              <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: displayedLayout, md: displayedLayout, sm: displayedLayout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768 }}
                cols={{ lg: 12, md: 9, sm: 6 }}
                rowHeight={60}
                isDraggable={false}
                isResizable={false}
                useCSSTransforms
                compactType="vertical"
              >
                {displayedWidgets.map((w) => {
                  const ws = (w.chartConfig as Record<string, unknown>)?.widgetStyle as { shadow?: string; borderRadius?: number } | undefined
                  const shadow = ws?.shadow === 'none' ? '' : ws?.shadow === 'md' ? 'shadow-md' : ws?.shadow === 'lg' ? 'shadow-lg' : 'shadow-sm'
                  const radius = ws?.borderRadius ?? 16
                  return (
                    <div key={w.id} className="h-full" style={{ direction: 'rtl', textAlign: 'right' }}>
                      <div className={`bg-white dark:bg-nx-navy border h-full flex flex-col overflow-hidden ${shadow} border-nx-border dark:border-nx-navy-border`} style={{ borderRadius: radius }}>
                        <div className="px-4 py-2 border-b border-nx-border dark:border-nx-navy-border shrink-0">
                          <span className="text-sm font-medium text-nx-navy dark:text-slate-100">{w.title}</span>
                        </div>
                        <div className="flex-1 w-full min-h-0 p-1 overflow-hidden" id={`chart-${w.id}`}>
                          <ChartWidget
                            widget={w}
                            dashboardFilters={filters}
                            dashboardControlFilters={controlFilters}
                            onFilter={setFilter}
                            drillBreadcrumb={drillState[w.id] || []}
                            onDrillDown={(col, value) => {
                              setDrillState((prev) => ({
                                ...prev,
                                [w.id]: [...(prev[w.id] || []), { col, value }],
                              }))
                            }}
                            onDrillUp={(index) => {
                              setDrillState((prev) => ({
                                ...prev,
                                [w.id]: (prev[w.id] || []).slice(0, index + 1),
                              }))
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </ResponsiveGridLayout>
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-nx-navy" dir="rtl">
      {/* Header — with iPhone notch safe-area & identical style to DashboardListPage */}
      <header className="bg-white dark:bg-nx-navy border-b border-nx-border dark:border-nx-navy-border px-4 sm:px-6 pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-3 transition-all">
        <div className="max-w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboards"
              className="p-1.5 text-nx-mist hover:text-slate-800 dark:hover:text-white transition rounded-xl hover:bg-slate-100 dark:hover:bg-nx-navy-elevated flex items-center justify-center shrink-0"
              title="بازگشت به فهرست داشبوردها"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link to="/dashboards" className="flex items-center gap-2.5 transition hover:opacity-85">
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={branding.name || 'Brand Logo'}
                  className="h-9 w-auto max-w-[120px] object-contain select-none shrink-0"
                />
              ) : (
                <div className="w-9 h-9 bg-nx-blue rounded-xl flex items-center justify-center text-white shadow-xs shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
              )}

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-extrabold text-nx-navy dark:text-slate-100 tracking-tight truncate max-w-[140px] sm:max-w-xs">
                    {activePage?.name || branding.name || 'هوش تجاری'}
                  </h1>
                  <span className="rounded-full bg-nx-blue/10 px-2 py-0.5 text-[10px] font-bold text-nx-blue dark:bg-nx-blue/20 shrink-0">
                    هوش تجاری
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-nx-mist truncate">
                  پلتفرم داشبوردهای تحلیلی
                </p>
              </div>
            </Link>

            {/* Vertical Separator — Desktop only */}
            <div className="hidden h-5 w-px bg-slate-200 lg:block dark:bg-nx-navy-border mx-1" />

            {/* Quick Cross-Module Navigation Switcher — Desktop only */}
            <div className="hidden lg:block">
              <ModuleSwitcherNav active="bi" />
            </div>

            {/* Device mode toggle — only on desktop for editors */}
            {canEdit && (
              <div className="hidden lg:flex items-center gap-1 mr-2 p-1 bg-nx-mist/10 dark:bg-nx-navy rounded-lg">
                {(['desktop', 'mobile'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDeviceMode(mode)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                      deviceMode === mode
                        ? 'bg-white dark:bg-nx-navy text-nx-blue dark:text-nx-blue shadow-sm'
                        : 'text-slate-600 dark:text-slate-200 hover:text-nx-navy dark:hover:text-nx-mist/20'
                    }`}
                    title={mode === 'mobile' ? 'ویرایش چیدمان موبایل' : 'ویرایش چیدمان دسکتاپ'}
                  >
                    {mode === 'mobile' ? '📱 موبایل' : '🖥️ دسکتاپ'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Only Actions Toolbar */}
            <div className="hidden md:flex items-center gap-2">
              {/* Undo/Redo buttons */}
              <div className="flex items-center gap-0.5 mr-1 p-1 bg-nx-mist/10 dark:bg-nx-navy rounded-lg">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="p-1.5 rounded-md transition text-slate-600 dark:text-slate-200 hover:text-nx-mist dark:hover:text-nx-mist disabled:opacity-30 disabled:cursor-not-allowed"
                  title="بازگشت (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className="p-1.5 rounded-md transition text-slate-600 dark:text-slate-200 hover:text-nx-mist dark:hover:text-nx-mist disabled:opacity-30 disabled:cursor-not-allowed"
                  title="بازگشت (Ctrl+Shift+Z)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Manual refresh + interval selector */}
              <div className="relative" ref={refreshMenuRef}>
                <div className="flex items-center gap-1 p-1 bg-nx-mist/10 dark:bg-nx-navy rounded-lg">
                  <button
                    onClick={handleManualRefresh}
                    className="p-1.5 rounded-md transition text-slate-600 dark:text-slate-200 hover:text-nx-mist dark:hover:text-nx-mist"
                    title="به‌روزرسانی دستی"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowRefreshMenu(!showRefreshMenu)}
                    className="flex items-center gap-0.5 px-1.5 py-1 rounded-md transition text-[10px] text-slate-600 dark:text-slate-200 hover:text-nx-navy dark:hover:text-nx-mist"
                    title="تنظیم بازه به‌روزرسانی"
                  >
                    <Clock className="w-3 h-3" />
                    <span>{refreshInterval} دقیقه</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                {showRefreshMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                    <div className="px-3 py-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-200">بازه به‌روزرسانی</div>
                    {([1, 5, 15, 30] as const).map((min) => (
                      <button
                        key={min}
                        onClick={() => handleChangeRefreshInterval(min)}
                        className={`w-full px-3 py-1.5 text-right text-sm hover:bg-white dark:hover:bg-nx-navy transition ${
                          refreshInterval === min
                            ? 'text-nx-blue dark:text-nx-blue font-medium bg-nx-blue/10 dark:bg-nx-blue/20'
                            : 'text-nx-navy dark:text-nx-mist'
                        }`}
                      >
                        {min} دقیقه
                      </button>
                    ))}
                    <div className="border-t border-nx-border dark:border-nx-navy-border mt-1 pt-1">
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-xs text-slate-600 dark:text-slate-200">بی‌صدا</span>
                        <button
                          onClick={() => {
                            const next = !silentRefresh
                            setSilentRefresh(next)
                            localStorage.setItem('nexivo_silent_refresh', String(next))
                          }}
                          className={`relative w-8 h-4 rounded-full transition ${silentRefresh ? 'bg-nx-blue' : 'bg-nx-mist dark:bg-nx-muted'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition transform ${silentRefresh ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>
                    </div>
                    {lastRefreshed && (
                      <div className="px-3 py-1.5 text-[10px] text-slate-600 dark:text-slate-200 border-t border-nx-border dark:border-nx-navy-border mt-1">
                        آخرین به‌روزرسانی: {lastRefreshed.toLocaleTimeString('fa-IR')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Presentation mode toggle */}
              <button
                onClick={() => setPresentMode(!presentMode)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg transition text-sm ${
                  presentMode
                    ? 'bg-nx-warning-500 text-white border-nx-warning-500 hover:bg-nx-warning-600'
                    : 'bg-white dark:bg-nx-navy border-nx-border dark:border-nx-muted text-nx-navy dark:text-nx-mist hover:bg-white dark:hover:bg-nx-navy'
                }`}
                title={presentMode ? 'خروج از حالت ارائه' : 'حالت ارائه'}
              >
                <Play className="w-4 h-4" />
                {presentMode ? 'خروج' : 'ارائه'}
              </button>

              {/* PDF Export */}
              <button
                onClick={handleExportPdf}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted text-nx-navy dark:text-nx-mist rounded-lg hover:bg-white dark:hover:bg-nx-navy transition text-sm"
                title="خروجی PDF"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>

              {/* Design Lock Button */}
              {canEdit && (
                <button
                  onClick={() => setShowLockModal(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition text-xs font-semibold ${
                    isEffectiveDesignLocked
                      ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-100'
                      : sessionUnlocked
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                      : 'bg-white dark:bg-nx-navy border-nx-border dark:border-nx-muted text-nx-navy dark:text-nx-mist hover:bg-slate-50'
                  }`}
                  title="قفل طراحی و چینش داشبورد"
                >
                  {isEffectiveDesignLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>چینش قفل است</span>
                    </>
                  ) : sessionUnlocked ? (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>قفل‌گشایی شده</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      <span>قفل طراحی</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={openShareModal}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-muted text-nx-navy dark:text-nx-mist rounded-lg hover:bg-white dark:hover:bg-nx-navy transition text-sm"
                title="اشتراک‌گذاری و دسترسی"
              >
                <Share2 className="w-4 h-4" />
                اشتراک‌گذاری
              </button>

              {canEdit && !isEffectiveDesignLocked && (
                <button
                  onClick={addNewWidget}
                  className="flex items-center gap-2 px-3 py-1.5 bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition text-sm"
                >
                  <Plus className="w-4 h-4" />
                  افزودن نمودار
                </button>
              )}
            </div>

            {/* Common Elements — Identical to DashboardListPage */}
            <NotificationBell />
            <ThemeToggle />

            {/* Mobile-only compact Add Button */}
            {canEdit && !isEffectiveDesignLocked && (
              <button
                onClick={addNewWidget}
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl bg-nx-blue text-white shadow-xs active:scale-95 transition"
                title="افزودن نمودار جدید"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Page Navigation Bar */}
      <PageNavBar />

      {/* Dashboard-level Filter Bar */}
      {currentPageWidgets.length > 0 && <DashboardFilterBar />}

      {/* Dashboard Grid */}
      <main className="px-4 sm:px-6 pt-4 pb-[calc(130px+env(safe-area-inset-bottom,0px))] lg:pb-16">
        {displayedWidgets.length === 0 ? (
          <div className="text-center py-20">
            <Settings className="w-16 h-16 text-slate-600 dark:text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-nx-navy dark:text-slate-100 mb-2">
              {currentPageWidgets.length > 0
                ? `نموداری برای نمایش در حالت ${editingMobile ? 'موبایل' : 'دسکتاپ'} فعال نیست`
                : activePage ? `${activePage.name} خالی است` : 'داشبورد خالی است'}
            </h3>
            <p className="text-slate-600 dark:text-slate-200 mb-6 text-sm">
              {currentPageWidgets.length > 0
                ? `تمامی نمودارهای این صفحه برای حالت ${editingMobile ? 'موبایل' : 'دسکتاپ'} غیرفعال شده‌اند.`
                : isEffectiveDesignLocked ? 'چینش این داشبورد قفل است و افزودن نمودار بدون رمز امکان‌پذیر نیست.' : 'اولین نمودار خود را اضافه کنید'}
            </p>
            {!isEffectiveDesignLocked && canEdit && (
              <button
                onClick={addNewWidget}
                className="px-6 py-3 bg-nx-blue text-white rounded-xl hover:bg-nx-blue transition font-medium"
              >
                افزودن نمودار
              </button>
            )}
          </div>
        ) : (
          <div className="react-grid-layout-wrapper">
            <ResponsiveGridLayout
              className={`layout ${isDragging ? 'is-dragging' : ''}`}
              layouts={{ lg: displayedLayout, md: displayedLayout, sm: displayedLayout }}
              breakpoints={{ lg: 1200, md: 996, sm: 768 }}
              cols={{ lg: 12, md: 9, sm: 6 }}
              rowHeight={60}
              onLayoutChange={handleLayoutChange}
              onDragStart={() => setIsDragging(true)}
              onDragStop={() => setIsDragging(false)}
              onResizeStart={() => setIsDragging(true)}
              onResizeStop={() => setIsDragging(false)}
              isDraggable={!isEffectiveDesignLocked && !presentMode}
              isResizable={!isEffectiveDesignLocked && !presentMode}
              useCSSTransforms
              compactType="vertical"
              draggableHandle='.drag-handle'
            >
              {displayedWidgets.map((w) => fullScreenWidget === w.id ? null : renderWidgetCard(w))}
            </ResponsiveGridLayout>

            {/* Bottom Buffer & Growth Area for Mobile/Touch Designer */}
            <div className="mt-8 mb-4 min-h-[85px] w-full flex items-center justify-center">
              {!isEffectiveDesignLocked && canEdit && (
                <div className="w-full max-w-md mx-auto py-3 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-nx-navy-border/60 bg-slate-50/50 dark:bg-nx-navy/30 text-center text-xs text-slate-400 dark:text-nx-mist">
                  <span>فضای آزاد انتهای داشبورد جهت کشیدن، جابجایی و تغییر اندازه نمودارها</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Widget Config Panel (desktop) */}
      {showConfig && editingWidget && !isMobile && (
        <WidgetConfigPanel
          widgetId={editingWidget}
          onClose={() => {
            setShowConfig(false)
            setEditingWidget(null)
          }}
        />
      )}

      {/* Mobile Settings Modal — full panel, same as desktop */}
      {mobileSettingsWidget && isMobile && (
        <WidgetConfigPanel
          widgetId={mobileSettingsWidget}
          onClose={() => setMobileSettingsWidget(null)}
        />
      )}

      {/* Full-screen Widget Modal */}
      {fullScreenWidget && (() => {
        const w = currentPageWidgets.find((widget) => widget.id === fullScreenWidget)
        if (!w) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
            <div className="relative w-full h-full bg-white dark:bg-nx-navy overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-6 py-3 border-b border-nx-border dark:border-nx-navy-border">
                <h3 className="font-bold text-nx-navy dark:text-slate-100 text-lg">{w.title}</h3>
                <button
                  onClick={() => setFullScreenWidget(null)}
                  className="p-2 text-nx-mist hover:text-nx-mist dark:hover:text-nx-mist hover:bg-nx-mist/10 dark:hover:bg-nx-navy rounded-lg transition"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 p-3 min-h-0 pb-[calc(80px+env(safe-area-inset-bottom,0px))] lg:pb-3">
                <ChartWidget
                  widget={w}
                  dashboardFilters={filters}
                  dashboardControlFilters={controlFilters}
                  onFilter={setFilter}
                  drillBreadcrumb={drillState[w.id] || []}
                  onDrillDown={(col, value) => {
                    setDrillState((prev) => ({
                      ...prev,
                      [w.id]: [...(prev[w.id] || []), { col, value }],
                    }))
                  }}
                  onDrillUp={(index) => {
                    setDrillState((prev) => ({
                      ...prev,
                      [w.id]: (prev[w.id] || []).slice(0, index + 1),
                    }))
                  }}
                />
              </div>
            </div>
          </div>
        )
      })()}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowShareModal(false)} />
          <div className="relative bg-white dark:bg-nx-navy rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nx-border dark:border-nx-navy-border">
              <h3 className="font-bold text-nx-navy dark:text-slate-100">اشتراک‌گذاری و دسترسی</h3>
              <button onClick={() => setShowShareModal(false)} className="p-1 text-nx-mist hover:text-nx-mist dark:hover:text-nx-mist">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-200 mb-4">نقش‌هایی که به این داشبورد دسترسی دارند:</p>
              <div className="space-y-2">
                {ALL_ROLES.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-center gap-3 p-3 rounded-xl border border-nx-border dark:border-nx-muted hover:bg-white dark:hover:bg-nx-navy-elevated cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={shareRoles.includes(r.value)}
                      onChange={() => setShareRoles((prev) => prev.includes(r.value) ? prev.filter((v) => v !== r.value) : [...prev, r.value])}
                      className="w-4 h-4 text-nx-blue rounded border-nx-mist dark:border-nx-muted focus:ring-nx-blue"
                    />
                    <span className="text-sm font-medium text-nx-navy dark:text-slate-100">{r.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-nx-mist mt-3">بدون انتخاب = همه نقش‌ها مجازند</p>
            </div>
            <div className="px-6 py-4 border-t border-nx-border dark:border-nx-navy-border flex items-center justify-end gap-3">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-200 hover:bg-nx-mist/10 dark:hover:bg-nx-navy rounded-xl transition"
              >
                انصراف
              </button>
              <button
                onClick={handleShareSave}
                className="px-6 py-2 bg-nx-blue text-white text-sm rounded-xl hover:bg-nx-blue transition font-medium"
              >
                ذخیره دسترسی‌ها
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Progress Overlay */}
      {pdfExporting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-nx-navy rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="w-16 h-16 bg-nx-blue/10 dark:bg-nx-blue/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-nx-blue dark:text-nx-blue animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-nx-navy dark:text-slate-100 mb-2">در حال ساخت PDF</h3>
            <p className="text-sm text-slate-600 dark:text-slate-200 mb-4">
              صفحه {pdfProgress.current} از {pdfProgress.total} نمودار...
            </p>
            <div className="w-full bg-nx-mist/20 dark:bg-nx-navy rounded-full h-2.5 mb-2">
              <div
                className="bg-nx-blue h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${pdfProgress.total > 0 ? (pdfProgress.current / pdfProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-200">لطفاً صبر کنید...</p>
          </div>
        </div>
      )}
      {/* Design Lock Modal */}
      {id && (
        <DesignLockModal
          isOpen={showLockModal}
          onClose={() => setShowLockModal(false)}
          dashboardId={parseInt(id)}
        />
      )}

      {/* Floating Chat Widget */}
      <FloatingChatWidget positionClass="bottom-7 left-8" />

      {/* Mobile Navigation Dock */}
      <MobileAppNavBar />
    </div>
  )
}
