import { useState, useEffect } from 'react'
import { getChartOfAccountsTree } from '../../api/finance'
import { useToast } from '../../components/Toast'
import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'

interface TafziliItem {
  id: number
  code: string
  name: string
  entity_type: string
}

interface MoinItem {
  id: number
  code: string
  name: string
  tafzilis: TafziliItem[]
}

interface KolItem {
  id: number
  code: string
  name: string
  account_type: string
  normal_balance: string
  moins: MoinItem[]
}

interface GroupItem {
  id: number
  code: string
  name: string
  kols: KolItem[]
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'دارایی',
  liability: 'بدهی',
  equity: 'سرمایه',
  revenue: 'درآمد',
  expense: 'هزینه',
}

const BALANCE_LABELS: Record<string, string> = {
  debit: 'بدهکار',
  credit: 'بستانکار',
}

export default function ChartOfAccountsPage() {
  const { toast } = useToast()
  const [tree, setTree] = useState<GroupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [expandedKols, setExpandedKols] = useState<Set<number>>(new Set())
  const [expandedMoins, setExpandedMoins] = useState<Set<number>>(new Set())

  useEffect(() => { fetchTree() }, [])

  const fetchTree = async () => {
    try {
      const res = await getChartOfAccountsTree()
      setTree(res.data)
    } catch {
      toast('خطا در دریافت حساب‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleGroup = (id: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleKol = (id: number) => {
    setExpandedKols(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleMoin = (id: number) => {
    setExpandedMoins(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-nx-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">سرفصل حساب‌ها</h1>
          <p className="text-nx-mist mt-1">گروه ← کل ← معین ← تفصیلی</p>
        </div>
      </div>

      {tree.length === 0 ? (
        <div className="text-center py-16 text-nx-mist">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-nx-mist" />
          <p className="text-lg">هنوز حسابی تعریف نشده</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tree.map(group => (
            <div key={group.id} className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-nx-navy-elevated transition text-right"
              >
                {expandedGroups.has(group.id)
                  ? <ChevronDown className="w-5 h-5 text-nx-mist" />
                  : <ChevronRight className="w-5 h-5 text-nx-mist" />
                }
                <span className="w-8 h-8 bg-nx-teal rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  {group.code}
                </span>
                <span className="text-lg font-bold text-white">{group.name}</span>
                <span className="text-xs text-nx-mist mr-auto">{group.kols.length} حساب کل</span>
              </button>

              {/* Kol Accounts */}
              {expandedGroups.has(group.id) && (
                <div className="border-t border-nx-navy-border pr-12">
                  {group.kols.map(kol => (
                    <div key={kol.id}>
                      <button
                        onClick={() => toggleKol(kol.id)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-nx-navy-elevated transition text-right"
                      >
                        {expandedKols.has(kol.id)
                          ? <ChevronDown className="w-4 h-4 text-nx-mist" />
                          : <ChevronRight className="w-4 h-4 text-nx-mist" />
                        }
                        <span className="text-sm font-mono text-nx-teal">{kol.code}</span>
                        <span className="text-white">{kol.name}</span>
                        <span className="text-xs text-nx-mist px-2 py-0.5 bg-nx-navy rounded-full">
                          {ACCOUNT_TYPE_LABELS[kol.account_type] || kol.account_type}
                        </span>
                        <span className="text-xs text-nx-mist px-2 py-0.5 bg-nx-navy-elevated rounded-full">
                          {BALANCE_LABELS[kol.normal_balance] || kol.normal_balance}
                        </span>
                      </button>

                      {/* Moin Accounts */}
                      {expandedKols.has(kol.id) && (
                        <div className="pr-8">
                          {kol.moins.map(moin => (
                            <div key={moin.id}>
                              <button
                                onClick={() => toggleMoin(moin.id)}
                                className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-nx-navy/20 transition text-right"
                              >
                                {expandedMoins.has(moin.id)
                                  ? <ChevronDown className="w-3.5 h-3.5 text-nx-mist" />
                                  : <ChevronRight className="w-3.5 h-3.5 text-nx-mist" />
                                }
                                <span className="text-xs font-mono text-nx-blue">{moin.code}</span>
                                <span className="text-nx-mist">{moin.name}</span>
                                <span className="text-xs text-nx-mist mr-auto">
                                  {moin.tafzilis.length} تفصیلی
                                </span>
                              </button>

                              {/* Tafzili Accounts */}
                              {expandedMoins.has(moin.id) && moin.tafzilis.length > 0 && (
                                <div className="pr-8 pb-2">
                                  {moin.tafzilis.map(t => (
                                    <div key={t.id} className="flex items-center gap-3 px-5 py-1.5 text-right">
                                      <span className="text-xs font-mono text-nx-blue">{t.code}</span>
                                      <span className="text-nx-mist text-sm">{t.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
