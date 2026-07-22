/**
 * Recruitment Page
 */
import { useState, useEffect } from 'react';
import { Plus, Search, Briefcase, Users } from 'lucide-react';
import { hrApi, Recruitment, Candidate } from '../../api/hr';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: 'باز', color: 'bg-green-100 text-green-700' },
  on_hold: { label: 'متوقف', color: 'bg-yellow-100 text-yellow-700' },
  closed: { label: 'بسته', color: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'لغو شده', color: 'bg-red-100 text-red-700' },
};

const CANDIDATE_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: 'جدید', color: 'bg-blue-100 text-blue-700' },
  screening: { label: 'غربالگری', color: 'bg-purple-100 text-purple-700' },
  interview: { label: 'مصاحبه', color: 'bg-orange-100 text-orange-700' },
  offer: { label: 'پیشنهاد', color: 'bg-teal-100 text-teal-700' },
  hired: { label: ' استخدام شده', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'رد شده', color: 'bg-red-100 text-red-700' },
};

export default function RecruitmentPage() {
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
    hrApi.getRecruitments().then(r => setJobs(r.data.data)).catch(() => {}).finally(() => setLoading(false));
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
    } catch {}
  };

  const handleAddCandidate = async () => {
    if (!selectedJob || !candidateForm.first_name || !candidateForm.last_name) return;
    try {
      const res = await hrApi.addCandidate(selectedJob, candidateForm);
      setCandidates(prev => [res.data.data, ...prev]);
      setShowCandidateForm(false);
      setCandidateForm({ first_name: '', last_name: '', email: '', phone: '' });
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Briefcase className="h-6 w-6 text-indigo-500" /> استخدام
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filteredJobs.length} آگهی شغلی</p>
        </div>
        <button onClick={() => setShowJobForm(!showJobForm)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
          <Plus className="h-4 w-4" /> آگهی جدید
        </button>
      </div>

      {showJobForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">عنوان *</label><input type="text" value={jobForm.title} onChange={e => setJobForm({ ...jobForm, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">توضیحات</label><input type="text" value={jobForm.description} onChange={e => setJobForm({ ...jobForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">تعداد پست</label><input type="number" value={jobForm.positions_count} onChange={e => setJobForm({ ...jobForm, positions_count: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowJobForm(false)} className="px-4 py-2 text-sm text-gray-600">انصراف</button>
            <button onClick={handleCreateJob} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">آگهی‌های شغلی</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" /></div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">هیچ آگهی‌ای یافت نشد</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredJobs.map(job => (
                <div key={job.id} onClick={() => setSelectedJob(job.id)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition ${selectedJob === job.id ? 'bg-orange-50 dark:bg-orange-950' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{job.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{job.positions_count} پست — {job.posted_date || '—'}</p>
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" /> داوطلبان
            </h3>
            {selectedJob && (
              <button onClick={() => setShowCandidateForm(!showCandidateForm)} className="text-xs text-orange-500 hover:text-orange-700">+ افزودن</button>
            )}
          </div>

          {showCandidateForm && selectedJob && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="نام *" value={candidateForm.first_name} onChange={e => setCandidateForm({ ...candidateForm, first_name: e.target.value })} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                <input type="text" placeholder="نام خانوادگی *" value={candidateForm.last_name} onChange={e => setCandidateForm({ ...candidateForm, last_name: e.target.value })} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setShowCandidateForm(false)} className="text-xs text-gray-500">انصراف</button>
                <button onClick={handleAddCandidate} className="text-xs text-orange-500 hover:text-orange-700">ذخیره</button>
              </div>
            </div>
          )}

          {!selectedJob ? (
            <div className="text-center py-8 text-gray-500 text-sm">یک آگهی شغلی انتخاب کنید</div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">هیچ داوطلبی یافت نشد</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {candidates.map(c => (
                <div key={c.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{c.full_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.email || '—'} — {c.phone || '—'}</p>
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
