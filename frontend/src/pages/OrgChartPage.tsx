import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { Building2, FolderTree, Users, ChevronDown, ChevronRight, User, Crown } from 'lucide-react'

interface OrgMember {
  id: number
  username: string
  first_name: string
  last_name: string
  role: string
  email: string
}

interface OrgTeam {
  id: number
  name: string
  manager: OrgMember | null
  members: OrgMember[]
}

interface OrgDivision {
  id: number
  name: string
  manager: OrgMember | null
  teams: OrgTeam[]
  direct_employees: OrgMember[]
}

interface OrgCompany {
  id: number
  name: string
  divisions: OrgDivision[]
  unassigned: OrgMember[]
}

const ROLE_COLORS: Record<string, string> = {
  ceo: 'bg-nx-warning-100 text-nx-warning-700 border-nx-warning-200',
  admin: 'bg-nx-blue/10 text-nx-blue border-nx-blue/10',
  finance: 'bg-nx-blue/10 text-nx-blue border-nx-blue/10',
  sales: 'bg-nx-teal/10 text-nx-teal border-nx-teal/10',
}

const ROLE_LABELS: Record<string, string> = {
  ceo: 'مدیرعامل',
  admin: 'مدیر سیستم',
  finance: 'مالی',
  sales: 'فروش',
}

function MemberCard({ member, compact = false }: { member: OrgMember; compact?: boolean }) {
  const initials = (member.first_name?.[0] || member.username[0] || '').toUpperCase()
  const fullName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-navy-border rounded-xl hover:shadow-sm transition">
        <div className="w-8 h-8 bg-nx-mist/10 rounded-full flex items-center justify-center text-xs font-bold text-nx-mist flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-nx-navy dark:text-nx-mist/20 truncate">{fullName}</p>
          <p className="text-[10px] text-nx-mist">{ROLE_LABELS[member.role] || member.role}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-nx-navy border border-nx-border dark:border-nx-navy-border rounded-2xl p-4 hover:shadow-lg transition group">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-nx-blue/10 rounded-full flex items-center justify-center text-lg font-bold text-nx-blue group-hover:bg-nx-blue/10 transition">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-nx-navy dark:text-nx-mist/10 truncate">{fullName}</p>
          <p className="text-xs text-nx-mist dark:text-nx-mist">@{member.username}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border ${ROLE_COLORS[member.role] || 'bg-nx-mist/10 text-nx-mist border-nx-border'}`}>
            {ROLE_LABELS[member.role] || member.role}
          </span>
        </div>
      </div>
      {member.email && (
        <p className="text-[10px] text-nx-mist mt-2 truncate">{member.email}</p>
      )}
    </div>
  )
}

function TeamNode({ team }: { team: OrgTeam }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-nx-border dark:border-nx-navy-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-nx-navy-elevated hover:bg-nx-mist/10 dark:hover:bg-nx-navy transition text-right"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-nx-blue" />
          <span className="text-sm font-bold text-nx-navy dark:text-nx-mist/20">{team.name}</span>
          <span className="text-[10px] bg-nx-mist/20 dark:bg-nx-muted text-nx-mist dark:text-nx-mist px-1.5 py-0.5 rounded-full">{team.members.length}</span>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-nx-mist" /> : <ChevronRight className="w-4 h-4 text-nx-mist" />}
      </button>

      {expanded && (
        <div className="p-3 space-y-2 border-t border-nx-border dark:border-nx-navy-border">
          {team.manager && (
            <div>
              <p className="text-[10px] font-medium text-nx-warning-600 mb-1 flex items-center gap-1">
                <Crown className="w-3 h-3" /> سرپرست تیم
              </p>
              <MemberCard member={team.manager} compact />
            </div>
          )}
          {team.members.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-nx-mist mb-1">اعضا ({team.members.length})</p>
              <div className="space-y-1">
                {team.members.filter(m => m.id !== team.manager?.id).map(m => (
                  <MemberCard key={m.id} member={m} compact />
                ))}
              </div>
            </div>
          )}
          {team.members.length === 0 && !team.manager && (
            <p className="text-xs text-nx-mist dark:text-nx-mist text-center py-2">بدون عضو</p>
          )}
        </div>
      )}
    </div>
  )
}

function DivisionNode({ division }: { division: OrgDivision }) {
  const [expanded, setExpanded] = useState(true)
  const totalMembers = (division.direct_employees?.length || 0) +
    division.teams.reduce((sum, t) => sum + t.members.length, 0)

  return (
    <div className="border border-nx-border dark:border-nx-navy-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 bg-nx-blue dark:from-nx-blue/30 dark:to-nx-navy hover:from-nx-blue/10 transition text-right"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-nx-blue rounded-xl flex items-center justify-center">
            <FolderTree className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-nx-navy dark:text-nx-mist/10">{division.name}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-nx-mist">{totalMembers} نفر</span>
              <span className="text-[10px] text-nx-mist">·</span>
              <span className="text-[10px] text-nx-mist">{division.teams.length} تیم</span>
            </div>
          </div>
        </div>
        {expanded ? <ChevronDown className="w-5 h-5 text-nx-mist" /> : <ChevronRight className="w-5 h-5 text-nx-mist" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3 border-t border-nx-border dark:border-nx-navy-border">
          {division.manager && (
            <div className="mb-3">
              <p className="text-[10px] font-medium text-nx-warning-600 mb-1 flex items-center gap-1">
                <Crown className="w-3 h-3" /> مدیر واحد
              </p>
              <MemberCard member={division.manager} />
            </div>
          )}

          {division.direct_employees && division.direct_employees.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-medium text-nx-mist mb-1">کارکنان مستقیم</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {division.direct_employees.filter(m => m.id !== division.manager?.id).map(m => (
                  <MemberCard key={m.id} member={m} compact />
                ))}
              </div>
            </div>
          )}

          {division.teams.length > 0 && (
            <div>                  <p className="text-[10px] font-medium text-nx-mist dark:text-nx-mist mb-2">تیم‌ها ({division.teams.length})</p>
                  <div className="space-y-2 pl-4 border-r-2 border-nx-blue/10 dark:border-nx-blue">
                {division.teams.map(team => (
                  <TeamNode key={team.id} team={team} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function OrgChartPage() {
  const [orgTree, setOrgTree] = useState<OrgCompany[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchOrgTree()
  }, [])

  const fetchOrgTree = async () => {
    try {
      const res = await api.get('/auth/org-tree/')
      setOrgTree(res.data.companies || [])
    } catch {
      toast('خطا در دریافت ساختار سازمانی', 'error')
    } finally {
      setLoading(false)
    }
  }

  const totalStats = orgTree.reduce(
    (acc, company) => {
      acc.companies++
      acc.divisions += company.divisions.length
      acc.teams += company.divisions.reduce((s, d) => s + d.teams.length, 0)
      acc.members += company.divisions.reduce(
        (s, d) => s + (d.direct_employees?.length || 0) + d.teams.reduce((ts, t) => ts + t.members.length, 0),
        0
      )
      acc.members += company.unassigned?.length || 0
      return acc
    },
    { companies: 0, divisions: 0, teams: 0, members: 0 }
  )

  return (
    <div className="p-6 dark:bg-nx-navy" dir="rtl">

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'شرکت', count: totalStats.companies, icon: Building2, color: 'bg-nx-blue/10 text-nx-blue' },
            { label: 'واحد', count: totalStats.divisions, icon: FolderTree, color: 'bg-nx-blue/10 text-nx-blue' },
            { label: 'تیم', count: totalStats.teams, icon: Users, color: 'bg-nx-blue/10 text-nx-blue' },
            { label: 'کارمند', count: totalStats.members, icon: User, color: 'bg-nx-teal/10 text-nx-teal' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>                    <p className="text-2xl font-bold text-nx-navy dark:text-nx-mist/10">{stat.count}</p>
                    <p className="text-xs text-nx-mist dark:text-nx-mist">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-nx-mist">در حال بارگذاری...</div>
        ) : orgTree.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-16 h-16 text-nx-mist mx-auto mb-4" />
            <h3 className="text-lg font-medium text-nx-navy dark:text-nx-mist/10 mb-2">هنوز ساختار سازمانی تعریف نشده</h3>
            <p className="text-nx-mist dark:text-nx-mist mb-6">از بخش مدیریت سازمانی شرکت، واحد و تیم اضافه کنید</p>
            <Link
              to="/admin/org"
              className="px-6 py-3 bg-nx-blue text-white rounded-xl hover:bg-nx-blue transition font-medium inline-block"
            >
              رفتن به مدیریت سازمانی
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orgTree.map((company) => (
              <div key={company.id} className="bg-white dark:bg-nx-navy rounded-2xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
                <div className="px-6 py-4 bg-nx-blue">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-white" />
                    <div>
                      <h2 className="text-lg font-bold text-white">{company.name}</h2>
                      <p className="text-xs text-nx-blue/10">
                        {company.divisions.length} واحد ·{' '}
                        {company.divisions.reduce((s, d) => s + d.teams.length, 0)} تیم
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {company.divisions.map((division) => (
                    <DivisionNode key={division.id} division={division} />
                  ))}

                  {company.unassigned && company.unassigned.length > 0 && (
                    <div className="border border-dashed border-nx-mist dark:border-nx-muted rounded-2xl p-4">
                      <p className="text-xs font-medium text-nx-mist mb-2">بدون واحد سازمانی ({company.unassigned.length})</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {company.unassigned.map((m) => (
                          <MemberCard key={m.id} member={m} compact />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
