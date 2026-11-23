/**
 * Cross-module management dashboard: combined KPIs from finance, CRM, office,
 * HR and sales, with a monthly invoiced/collected bar chart, an activity pie,
 * top debtors donut chart, and live ERP database connectivity.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import api from '../api/client';
import { rial, num, toPersianDigits } from './billing/shared';
import PayerStatementModal from './billing/PayerStatementModal';
import { useToast } from '../components/Toast';
import { useBrandLogo, useBrandingStore } from '../store/brandingStore';
import {
  Wallet, AlertCircle, ReceiptText, Users, FileSignature, Target, Building2, UserRound,
  PieChart as PieIcon, LayoutDashboard, Calendar, Loader2
} from 'lucide-react';

const CARD = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-nx-navy-border dark:bg-nx-navy';

interface DBStatus {
  connected: boolean;
  engine: string;
  name: string;
  host: string;
  port: string;
  response_time_ms: number;
  table_count: number;
  version: string;
  error?: string;
}

interface Summary {
  kpis: {
    invoiced: number; paid: number; outstanding: number; payers: number; invoices: number;
    leads?: number; opportunities?: number; pipeline?: number; campaigns?: number;
    letters?: number; contracts?: number; contract_value?: number;
    employees?: number; sales_orders?: number; sales_value?: number;
  };
  monthly: { label: string; invoiced: number; paid: number }[];
  mix: { name: string; value: number }[];
  top_payers: { payer_code?: string; payer: string; amount: number }[];
  db_status?: DBStatus;
}

const PALETTE = ['#24C6B2', '#3678F6', '#F59E0B', '#8B5CF6', '#EF4444', '#0EA5E9'];
const DEBTOR_PALETTE = ['#EF4444', '#F97316', '#F59E0B', '#3678F6', '#8B5CF6', '#24C6B2', '#EC4899', '#0EA5E9', '#14B8A6', '#64748B'];

export default function ManagementDashboardPage() {
  const { toast } = useToast();
  const brandLogo = useBrandLogo();
  const branding = useBrandingStore((s) => s.branding);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayer, setSelectedPayer] = useState<{ code: string; name: string } | null>(null);

  const barRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  const payerPieRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api.get('/billing/management-summary/')
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch((err) => {
        console.error('Error fetching management summary:', err);
        if (active) toast('دریافت شاخص‌های مدیریتی انجام نشد', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1. Monthly invoiced vs collected bar chart
  useEffect(() => {
    if (!barRef.current || !data?.monthly?.length) return;
    const dark = document.documentElement.classList.contains('dark');
    const axis = dark ? '#94A3B8' : '#64748B';
    const split = dark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)';
    const text = dark ? '#E2E8F0' : '#1E293B';

    const bar = echarts.getInstanceByDom(barRef.current) || echarts.init(barRef.current);
    bar.setOption({
      textStyle: { fontFamily: 'Vazirmatn' },
      tooltip: {
        trigger: 'axis',
        textStyle: { fontFamily: 'Vazirmatn' },
        valueFormatter: (value: number) => `${num(value)} ریال`,
      },
      legend: { data: ['صورت‌حساب صادره', 'وصول‌شده'], textStyle: { color: text, fontFamily: 'Vazirmatn' }, top: 0 },
      grid: { right: 16, left: 16, bottom: 8, top: 42, containLabel: true },
      xAxis: {
        type: 'category',
        data: data.monthly.map((row) => toPersianDigits(row.label)),
        axisLabel: { color: axis, fontFamily: 'Vazirmatn', formatter: (val: string) => toPersianDigits(val) },
        axisLine: { lineStyle: { color: split } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: axis, fontFamily: 'Vazirmatn', formatter: (value: number) => num(value) },
        splitLine: { lineStyle: { color: split } },
      },
      series: [
        { name: 'صورت‌حساب صادره', type: 'bar', data: data.monthly.map((row) => row.invoiced), itemStyle: { color: '#3678F6', borderRadius: [6, 6, 0, 0] }, barMaxWidth: 28 },
        { name: 'وصول‌شده', type: 'bar', data: data.monthly.map((row) => row.paid), itemStyle: { color: '#24C6B2', borderRadius: [6, 6, 0, 0] }, barMaxWidth: 28 },
      ],
    });

    const onResize = () => bar.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      bar.dispose();
    };
  }, [data?.monthly]);

  // 2. Organization Activity Mix
  const mixData = useMemo(() => {
    return data?.mix?.filter((item) => item.value > 0) || [];
  }, [data?.mix]);

  useEffect(() => {
    if (!pieRef.current || mixData.length === 0) return;
    const dark = document.documentElement.classList.contains('dark');
    const text = dark ? '#E2E8F0' : '#1E293B';

    const pie = echarts.getInstanceByDom(pieRef.current) || echarts.init(pieRef.current);
    pie.setOption({
      textStyle: { fontFamily: 'Vazirmatn' },
      tooltip: {
        trigger: 'item',
        textStyle: { fontFamily: 'Vazirmatn' },
        valueFormatter: (value: number) => `${num(value)} مورد`,
      },
      legend: { bottom: 0, textStyle: { color: text, fontFamily: 'Vazirmatn' } },
      color: PALETTE,
      series: [{
        type: 'pie',
        radius: ['46%', '72%'],
        center: ['50%', '44%'],
        itemStyle: { borderColor: dark ? '#0F1B2E' : '#FFFFFF', borderWidth: 2 },
        label: {
          color: text,
          fontFamily: 'Vazirmatn',
          formatter: (p: any) => `${p.name}\n${num(p.value)}`,
        },
        data: mixData,
      }],
    });

    const onResize = () => pie.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      pie.dispose();
    };
  }, [mixData]);

  // 3. Top Debtors Donut Chart (padAngle: 3, borderRadius: 8)
  useEffect(() => {
    if (!payerPieRef.current || !data?.top_payers?.length) return;
    const dark = document.documentElement.classList.contains('dark');
    const text = dark ? '#E2E8F0' : '#1E293B';

    const payerPie = echarts.getInstanceByDom(payerPieRef.current) || echarts.init(payerPieRef.current);
    payerPie.setOption({
      textStyle: { fontFamily: 'Vazirmatn' },
      tooltip: {
        trigger: 'item',
        textStyle: { fontFamily: 'Vazirmatn' },
        formatter: (params: any) => {
          return `<div dir="rtl" class="text-xs p-1 leading-5" style="font-family: Vazirmatn, sans-serif;">
            <strong>${params.name}</strong><br/>
            مانده حساب: <span class="font-bold text-rose-500">${num(params.value)} ریال</span><br/>
            سهم از بدهی‌های برتر: <span class="font-bold">${toPersianDigits(Number(params.percent).toFixed(1))}٪</span>
          </div>`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: text, fontFamily: 'Vazirmatn', fontSize: 11 },
        type: 'scroll',
      },
      color: DEBTOR_PALETTE,
      series: [
        {
          name: '۱۰ بدهکار برتر',
          type: 'pie',
          radius: ['42%', '70%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: true,
          padAngle: 3,
          itemStyle: {
            borderRadius: 8,
            borderColor: dark ? '#0F1B2E' : '#FFFFFF',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: (p: any) => `${p.name}: ${toPersianDigits(Number(p.percent).toFixed(0))}٪`,
            color: text,
            fontFamily: 'Vazirmatn',
            fontSize: 10,
          },
          emphasis: {
            label: { show: true, fontSize: 12, fontWeight: 'bold' },
          },
          data: data.top_payers.map((p) => ({
            name: p.payer,
            value: p.amount,
          })),
        },
      ],
    });

    payerPie.on('click', (params: any) => {
      const match = data.top_payers.find((p) => p.payer === params.name);
      if (match) {
        setSelectedPayer({ code: match.payer_code || match.payer, name: match.payer });
      }
    });

    const onResize = () => payerPie.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      payerPie.dispose();
    };
  }, [data?.top_payers]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500 dark:text-nx-mist gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-nx-blue" />
        <p className="text-sm">در حال بارگذاری داشبورد مدیریتی…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500 dark:text-nx-mist gap-2">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-sm">داده‌ای برای نمایش داشبورد مدیریتی دریافت نشد.</p>
      </div>
    );
  }

  const k = data.kpis;
  const cards = [
    { label: 'وصول‌شده', value: k.paid, money: true, icon: Wallet, tone: 'text-emerald-500 bg-emerald-500/10' },
    { label: 'مطالبات باز', value: k.outstanding, money: true, icon: AlertCircle, tone: 'text-rose-500 bg-rose-500/10' },
    { label: 'صورت‌حساب صادره', value: k.invoiced, money: true, icon: ReceiptText, tone: 'text-nx-blue bg-nx-blue/10' },
    { label: 'شرکت‌های طرف حساب', value: k.payers, icon: Building2, tone: 'text-nx-teal bg-nx-teal/10' },
    { label: 'قراردادها', value: k.contracts ?? 0, icon: FileSignature, tone: 'text-violet-500 bg-violet-500/10' },
    { label: 'فرصت‌های فروش', value: k.opportunities ?? 0, icon: Target, tone: 'text-amber-500 bg-amber-500/10' },
    { label: 'نامه‌ها', value: k.letters ?? 0, icon: Users, tone: 'text-sky-500 bg-sky-500/10' },
    { label: 'کارکنان', value: k.employees ?? 0, icon: UserRound, tone: 'text-slate-500 bg-slate-500/10' },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {brandLogo ? (
            <img
              src={brandLogo}
              alt={branding.name || 'Logo'}
              className="h-10 w-auto max-w-[120px] object-contain select-none"
            />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-nx-blue/10 text-nx-blue">
              <LayoutDashboard className="h-5 w-5" />
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-nx-navy dark:text-white">داشبورد مدیریتی</h1>
              {branding.name && (
                <span className="rounded-full bg-nx-blue/10 px-2 py-0.5 text-[11px] font-bold text-nx-blue dark:bg-nx-blue/20">
                  {branding.name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-nx-mist">تصویر یکپارچه از شاخص‌های کلیدی مالی، فروش، CRM، اداری و منابع انسانی</p>
          </div>
        </div>
      </div>

      {/* 8 Primary KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={`${CARD} flex items-center gap-3`}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${card.tone}`}>
              <card.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 dark:text-nx-mist">{card.label}</p>
              <p className="truncate text-base font-bold text-nx-navy dark:text-white">
                {card.money ? rial(card.value) : num(card.value)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Row 1: Monthly Financial Bar Chart + Org Activity Mix */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className={`${CARD} xl:col-span-2`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-nx-navy dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-nx-blue" />
              روند مالی شش ماه
            </h2>
            <span className="text-xs text-slate-500 dark:text-nx-mist">مقایسه صدور و وصول</span>
          </div>
          <div ref={barRef} className="h-72 w-full" />
        </div>
        <div className={CARD}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-nx-navy dark:text-white">ترکیب فعالیت سازمان</h2>
          </div>
          {mixData.length === 0 ? (
            <div className="h-72 w-full flex flex-col items-center justify-center text-xs text-slate-400 dark:text-nx-mist gap-1">
              <p>فعالیتی ثبت نشده است.</p>
            </div>
          ) : (
            <div ref={pieRef} className="h-72 w-full" />
          )}
        </div>
      </div>

      {/* Row 2: Top 10 Debtors Donut Chart + Supplementary Metrics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top 10 Debtors Chart & Ranking */}
        <div className={`${CARD} flex flex-col`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-nx-navy dark:text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-rose-500" />
              ۱۰ شرکت با بیشترین مانده بدهی
            </h2>
          </div>
          {data.top_payers.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-nx-mist py-8 text-center">داده‌ای ثبت نشده است.</p>
          ) : (
            <>
              <div ref={payerPieRef} className="h-72 w-full my-auto" />
              <div className="mt-3 border-t border-slate-100 dark:border-nx-navy-border pt-3">
                <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs pl-3.5 pr-2">
                  {data.top_payers.map((payer, index) => (
                    <div
                      key={payer.payer_code || `${payer.payer}-${index}`}
                      onClick={() => setSelectedPayer({ code: payer.payer_code || payer.payer, name: payer.payer })}
                      className="flex justify-between items-center py-1.5 px-2 rounded-lg border-b border-slate-50 dark:border-white/5 hover:bg-slate-100/70 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                      title="مشاهده ریز گردش و کاردکس حساب"
                    >
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-nx-mist truncate group-hover:text-nx-blue dark:group-hover:text-blue-400 font-medium">
                        <span className="text-[10px] w-4 text-slate-400">{toPersianDigits(index + 1)}.</span>
                        {payer.payer}
                      </span>
                      <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">{rial(payer.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Supplementary Metrics */}
        <div className={CARD}>
          <h2 className="mb-3 text-sm font-semibold text-nx-navy dark:text-white">شاخص‌های تکمیلی</h2>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
              <dt className="text-slate-500 dark:text-nx-mist">ارزش فرصت‌های باز</dt>
              <dd className="mt-1 font-bold text-nx-navy dark:text-white">{rial(k.pipeline ?? 0)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
              <dt className="text-slate-500 dark:text-nx-mist">ارزش قراردادها</dt>
              <dd className="mt-1 font-bold text-nx-navy dark:text-white">{rial(k.contract_value ?? 0)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
              <dt className="text-slate-500 dark:text-nx-mist">کمپین‌ها</dt>
              <dd className="mt-1 font-bold text-nx-navy dark:text-white">{num(k.campaigns ?? 0)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
              <dt className="text-slate-500 dark:text-nx-mist">سفارش‌های فروش</dt>
              <dd className="mt-1 font-bold text-nx-navy dark:text-white">{num(k.sales_orders ?? 0)}</dd>
            </div>
          </dl>
        </div>
      </div>
      {/* Payer Statement Ledger Modal */}
      {selectedPayer && (
        <PayerStatementModal
          payerCode={selectedPayer.code}
          payerName={selectedPayer.name}
          onClose={() => setSelectedPayer(null)}
        />
      )}
    </div>
  );
}
