/**
 * Recruitment Page
 */
import { useState, useEffect } from 'react';
import { Plus, Search, Briefcase, Users } from 'lucide-react';
import { hrApi, Recruitment, Candidate } from '../../api/hr';
import { useToast } from '../../components/Toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: 'باز', color: 'bg-nx-teal/10 text-nx-teal' },
  on_hold: { label: 'متوقف', color: 'bg-nx-warning-100 text-nx-warning-700' },
  closed: { label: 'بسته', color: 'bg-nx-mist/10 text-nx-navy' },
  cancelled: { label: 'لغو شده', color: 'bg-nx-danger-100 text-nx-danger-700' },
};

const CANDIDATE_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: 'جدید', color: 'bg-nx-blue/10 text-nx-blue' },
  screening: { label: 'غربالگری', color: 'bg-nx-blue/10 text-nx-blue' },
  interview: { label: 'مصاحبه', color: 'bg-nx-blue/10 text-nx-blue' },
  offer: { label: 'پیشنهاد', color: 'bg-nx-teal/10 text-nx-teal' },
  hired: { label: 'استخدام شده', color: 'bg-nx-teal/10 text-nx-teal' },
  rejected: { label: 'رد شده', color: 'bg-nx-danger-100 text-nx-danger-700' },
};

export default function RecruitmentPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Recruitment[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [jobForm, setJobForm] = useState({ title: '', description: '', positions_count: 1 });
  const [candidateForm, setCandidateForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });

  useEffect(() => {
    hrApi.getRecruitments().then(r => setJobs(r.data.data)).catch(() => toast("خطا", "error")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedJob) {
      hrApi.getCandidates(selectedJob).then(r => setCandidates(r.data.data)).catch(() => {});
    }
  }, [selectedJob]);

  const filteredJobs = jobs.filter(j => !search || j.title.includes(search));

  const handleCreateJob = async () => {
    if (!jobForm.title) return;
    try {
      const res = await hrApi.createRecruitment(jobForm);
      setJobs(prev => [res.data.data, ...prev]);
      setShowJobForm(false);
      setJobForm({ title: '', description: '', positions_count: 1 });
    } catch { toast("خطا", "error"); }
  };

  const handleAddCandidate = async () => {
    if (!selectedJob || !candidateForm.first_name || !candidateForm.last_name) return;
    try {
      const res = await hrApi.addCandidate(selectedJob, candidateForm);
      setCandidates(prev => [res.data.data, ...prev]);
      setShowCandidateForm(false);
      setCandidateForm({ first_name: '', last_name: '', email: '', phone: '' });
    } catch { toast("خطا", "error"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Briefcase className="h-6 w-6 text-nx-blue" /> استخدام
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-200 mt-1">{filteredJobs.length} آگهی شغلی</p>
        </div>
        <button onClick={() => setShowJobForm(!showJobForm)} className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue">
          <Plus className="h-4 w-4" /> آگهی جدید
        </button>
      </div>

      {showJobForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-nx-mist mb-1">عنوان *</label><input type="text" value={jobForm.title} onChange={e => setJobForm({ ...jobForm, title: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">توضیحات</label><input type="text" value={jobForm.description} onChange={e => setJobForm({ ...jobForm, description: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">تعداد پست</label><input type="number" value={jobForm.positions_count} onChange={e => setJobForm({ ...jobForm, positions_count: Number(e.target.value) })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowJobForm(false)} className="px-4 py-2 text-sm text-nx-mist">انصراف</button>
            <button onClick={handleCreateJob} className="px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nx-mist" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs */}
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
          <div className="p-4 border-b border-nx-border dark:border-nx-navy-border">
            <h3 className="text-sm font-semibold text-nx-navy dark:text-white">آگهی‌های شغلی</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-nx-blue" /></div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-nx-mist text-sm">هیچ آگهی‌ای یافت نشد</div>
          ) : (
            <div className="divide-y divide-nx-border dark:divide-nx-navy">
              {filteredJobs.map(job => (
                <div key={job.id} onClick={() => setSelectedJob(job.id)}
                  className={`p-4 cursor-pointer hover:bg-white dark:hover:bg-nx-navy transition ${selectedJob === job.id ? 'bg-nx-blue/10 dark:bg-nx-warning-950' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-nx-navy dark:text-white">{job.title}</p>
                      <p className="text-xs text-nx-mist mt-1">{job.positions_count} پست — {job.posted_date || '—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${(STATUS_MAP[job.status] || STATUS_MAP.open).color}`}>
                      {(STATUS_MAP[job.status] || STATUS_MAP.open).label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Candidates */}
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
          <div className="p-4 border-b border-nx-border dark:border-nx-navy-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-nx-navy dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-nx-mist" /> داوطلبان
            </h3>
            {selectedJob && (
              <button onClick={() => setShowCandidateForm(!showCandidateForm)} className="text-xs text-nx-blue hover:text-nx-blue">+ افزودن</button>
            )}
          </div>

          {showCandidateForm && selectedJob && (
            <div className="p-4 border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="نام *" value={candidateForm.first_name} onChange={e => setCandidateForm({ ...candidateForm, first_name: e.target.value })} className="px-3 py-1.5 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
                <input type="text" placeholder="نام خانوادگی *" value={candidateForm.last_name} onChange={e => setCandidateForm({ ...candidateForm, last_name: e.target.value })} className="px-3 py-1.5 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setShowCandidateForm(false)} className="text-xs text-nx-mist">انصراف</button>
                <button onClick={handleAddCandidate} className="text-xs text-nx-blue hover:text-nx-blue">ذخیره</button>
              </div>
            </div>
          )}

          {!selectedJob ? (
            <div className="text-center py-8 text-nx-mist text-sm">یک آگهی شغلی انتخاب کنید</div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-8 text-nx-mist text-sm">هیچ داوطلبی یافت نشد</div>
          ) : (
            <div className="divide-y divide-nx-border dark:divide-nx-navy">
              {candidates.map(c => (
                <div key={c.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-nx-navy dark:text-white">{c.full_name}</p>
                      <p className="text-xs text-nx-mist mt-0.5">{c.email || '—'} — {c.phone || '—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${(CANDIDATE_STATUS[c.status] || CANDIDATE_STATUS.new).color}`}>
                      {(CANDIDATE_STATUS[c.status] || CANDIDATE_STATUS.new).label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
