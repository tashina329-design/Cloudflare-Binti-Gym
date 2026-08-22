import { DashboardData, Member } from '../types';
import { toIsoTimestampString, isSameDate } from './firebaseSync';

export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

export interface DailySummaryMetrics {
  headerTitle: string;
  newMembershipCount: number;
  walkInCount: number;
  cashIn: number;
  baiduriIn: number;
  bibdIn: number;
  couponIn: number;
  totalIncomeIn: number;
  cashOut: number;
  baiduriOut: number;
  bibdOut: number;
  couponOut: number;
  totalExpensesOut: number;
  netCash: number;
  netDaily: number;
  netBaiduri: number;
  netBibd: number;
}

export interface FinancialPeriodMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  cashIn: number;
  baiduriIn: number;
  bibdIn: number;
  cashOut: number;
  baiduriOut: number;
  bibdOut: number;
}

const SPREADSHEET_TITLE = 'IronVault Gym - Management & Sales Log';
const BRUNEI_TIMEZONE = 'Asia/Brunei';

/**
 * Robustly parses any timestamp (ISO string, epoch ms, Firestore Timestamp, or Date) to milliseconds.
 */
export function parseRecordTimestampMs(rec: any): number {
  if (!rec) return 0;
  const raw = rec.timestamp || rec.createdAt || rec.startDate || rec.time;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  if (typeof raw?.toDate === 'function') {
    try {
      return raw.toDate().getTime();
    } catch {}
  }
  if (typeof raw?.seconds === 'number') {
    return raw.seconds * 1000 + (raw.nanoseconds || 0) / 1000000;
  }
  const d = new Date(raw);
  const time = d.getTime();
  if (!isNaN(time)) return time;
  return 0;
}

/**
 * Extracts a clean "YYYY-MM-DD" string from any date or timestamp representation.
 */
export function extractDateString(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  if (typeof raw?.toDate === 'function') {
    try {
      return raw.toDate().toISOString().split('T')[0];
    } catch {}
  }
  if (typeof raw?.seconds === 'number') {
    return new Date(raw.seconds * 1000).toISOString().split('T')[0];
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    try {
      return d.toISOString().split('T')[0];
    } catch {}
  }
  return null;
}

/**
 * Formats a timestamp into a clear, legible Date & Time string for Google Sheets (e.g. "2026-08-22 09:30 AM").
 */
export function formatDateTimeForSheet(rawTimestamp: any, fallbackTime?: string): string {
  if (!rawTimestamp && fallbackTime) return fallbackTime;
  const iso = toIsoTimestampString(rawTimestamp);
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return rawTimestamp ? String(rawTimestamp) : fallbackTime || '-';
  }
  try {
    const year = d.toLocaleDateString('en-CA', { timeZone: BRUNEI_TIMEZONE, year: 'numeric' });
    const month = d.toLocaleDateString('en-CA', { timeZone: BRUNEI_TIMEZONE, month: '2-digit' });
    const day = d.toLocaleDateString('en-CA', { timeZone: BRUNEI_TIMEZONE, day: '2-digit' });
    const timePart = d.toLocaleTimeString('en-US', {
      timeZone: BRUNEI_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${year}-${month}-${day} ${timePart}`;
  } catch {
    const dateStr = d.toISOString().split('T')[0];
    return fallbackTime ? `${dateStr} ${fallbackTime}` : dateStr;
  }
}

/**
 * Helper to format date header: "REPORT FOR THU AUG 20 2026"
 */
export function formatReportDateHeader(isoDateStr?: string): string {
  let d = new Date();
  if (isoDateStr) {
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      const parsed = new Date(isoDateStr);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
  }

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const dayName = days[d.getDay()];
  const monthName = months[d.getMonth()];
  const dayNum = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();

  return `REPORT FOR ${dayName} ${monthName} ${dayNum} ${year}`;
}

/**
 * Finds all unique dates across all sales, expenses, attendance, and member records in the system.
 */
export function getAllDistinctHistoricalDates(data: DashboardData): string[] {
  const datesSet = new Set<string>();

  if (data.viewDate) {
    datesSet.add(data.viewDate);
  } else {
    datesSet.add(new Date().toISOString().split('T')[0]);
  }

  const allSales = data.store?.sales && data.store.sales.length > 0 ? data.store.sales : data.todaySales;
  const allExpenses = data.store?.expenses && data.store.expenses.length > 0 ? data.store.expenses : data.todayExpenses;
  const allAttendance = data.store?.attendance && data.store.attendance.length > 0 ? data.store.attendance : data.todayAttendance;
  const allMembers = data.store?.members && data.store.members.length > 0 ? data.store.members : data.members;

  for (const s of allSales) {
    const dStr = extractDateString(s.timestamp || s.createdAt || s.time);
    if (dStr) datesSet.add(dStr);
  }

  for (const e of allExpenses) {
    const dStr = extractDateString(e.timestamp || e.createdAt || e.time);
    if (dStr) datesSet.add(dStr);
  }

  for (const a of allAttendance) {
    const dStr = extractDateString(a.timestamp || a.createdAt || a.time);
    if (dStr) datesSet.add(dStr);
  }

  for (const m of allMembers) {
    if (m.startDate) {
      const dStr = extractDateString(m.startDate);
      if (dStr) datesSet.add(dStr);
    }
  }

  // Sort descending: latest date on top, historical dates follow
  return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
}

/**
 * Calculates Daily Summary metrics for a specific historical date.
 */
export function calculateDailySummaryForSpecificDate(
  dateStr: string,
  allSales: any[],
  allExpenses: any[],
  allAttendance: any[],
  allMembers: Member[]
): DailySummaryMetrics {
  const headerTitle = formatReportDateHeader(dateStr);

  const dateSales = allSales.filter((s) => isSameDate(s.timestamp || s.createdAt || s.time, dateStr));
  const dateExpenses = allExpenses.filter((e) => isSameDate(e.timestamp || e.createdAt || e.time, dateStr));
  const dateAttendance = allAttendance.filter((a) => isSameDate(a.timestamp || a.createdAt || a.time, dateStr));

  // 1. Membership signups & Walk-ins
  const newMembershipCount =
    dateSales.filter(
      (s) =>
        /membership|new member|member sign/i.test(s.category || '') ||
        (/registration/i.test(s.category || '') && !/walk-?in/i.test(s.category || ''))
    ).length ||
    allMembers.filter((m) => m.startDate === dateStr).length ||
    0;

  const walkInCount =
    dateSales.filter((s) => /walk-?in/i.test(s.category || '')).length ||
    dateAttendance.filter((a) => /walk-?in|guest/i.test(a.plan || '') || a.memberId === 'GUEST').length ||
    0;

  // 2. Income (Payment In)
  let cashIn = 0;
  let baiduriIn = 0;
  let bibdIn = 0;
  let couponIn = 0;

  for (const s of dateSales) {
    if (/pt payout|pt out/i.test(s.category || '')) continue;
    const amt = Number(s.amount) || 0;
    const pay = (s.payment || s.paymentMethod || '').toLowerCase();

    if (pay.includes('cash')) {
      cashIn += amt;
    } else if (pay.includes('baiduri') || pay.includes('card')) {
      baiduriIn += amt;
    } else if (pay.includes('bibd') || pay.includes('online')) {
      bibdIn += amt;
    } else if (pay.includes('coupon') || pay.includes('voucher')) {
      couponIn += amt;
    } else {
      cashIn += amt;
    }
  }

  const totalIncomeIn = cashIn + baiduriIn + bibdIn + couponIn;

  // 3. Expenses (Payment Out)
  let cashOut = 0;
  let baiduriOut = 0;
  let bibdOut = 0;
  let couponOut = 0;

  for (const e of dateExpenses) {
    const amt = Number(e.amount) || 0;
    const pay = (e.payment || e.paymentMethod || '').toLowerCase();

    if (pay.includes('cash')) {
      cashOut += amt;
    } else if (pay.includes('baiduri') || pay.includes('card')) {
      baiduriOut += amt;
    } else if (pay.includes('bibd') || pay.includes('online')) {
      bibdOut += amt;
    } else if (pay.includes('coupon') || pay.includes('voucher')) {
      couponOut += amt;
    } else {
      cashOut += amt;
    }
  }

  // Also include PT Out payouts in expenses
  for (const s of dateSales) {
    if (/pt payout|pt out/i.test(s.category || '')) {
      const amt = Number(s.amount) || 0;
      const pay = (s.payment || s.paymentMethod || '').toLowerCase();

      if (pay.includes('baiduri') || pay.includes('card')) {
        baiduriOut += amt;
      } else if (pay.includes('bibd') || pay.includes('online')) {
        bibdOut += amt;
      } else if (pay.includes('coupon') || pay.includes('voucher')) {
        couponOut += amt;
      } else {
        cashOut += amt;
      }
    }
  }

  const totalExpensesOut = cashOut + baiduriOut + bibdOut + couponOut;

  // 4. Net balances
  const netCash = cashIn - cashOut;
  const netDaily = totalIncomeIn - totalExpensesOut;
  const netBaiduri = baiduriIn - baiduriOut;
  const netBibd = bibdIn - bibdOut;

  return {
    headerTitle,
    newMembershipCount,
    walkInCount,
    cashIn,
    baiduriIn,
    bibdIn,
    couponIn,
    totalIncomeIn,
    cashOut,
    baiduriOut,
    bibdOut,
    couponOut,
    totalExpensesOut,
    netCash,
    netDaily,
    netBaiduri,
    netBibd,
  };
}

/**
 * Calculates complete Daily Summary metrics matching the requested report layout for the currently viewed date.
 */
export function calculateDailySummaryMetrics(data: DashboardData): DailySummaryMetrics {
  const allSales = data.store?.sales && data.store.sales.length > 0 ? data.store.sales : data.todaySales;
  const allExpenses = data.store?.expenses && data.store.expenses.length > 0 ? data.store.expenses : data.todayExpenses;
  const allAttendance = data.store?.attendance && data.store.attendance.length > 0 ? data.store.attendance : data.todayAttendance;
  const allMembers = data.store?.members && data.store.members.length > 0 ? data.store.members : data.members;

  const targetDate = data.viewDate || new Date().toISOString().split('T')[0];
  return calculateDailySummaryForSpecificDate(targetDate, allSales, allExpenses, allAttendance, allMembers);
}

/**
 * Computes financial metrics for any array of sales and expenses.
 */
function computePeriodFinancialMetrics(sales: any[], expenses: any[]): FinancialPeriodMetrics {
  let cashIn = 0;
  let baiduriIn = 0;
  let bibdIn = 0;

  for (const s of sales) {
    if (/pt payout|pt out/i.test(s.category || '')) continue;
    const amt = Number(s.amount) || 0;
    const pay = (s.payment || s.paymentMethod || '').toLowerCase();

    if (pay.includes('cash')) {
      cashIn += amt;
    } else if (pay.includes('baiduri') || pay.includes('card')) {
      baiduriIn += amt;
    } else if (pay.includes('bibd') || pay.includes('online')) {
      bibdIn += amt;
    } else {
      cashIn += amt;
    }
  }

  const totalRevenue = cashIn + baiduriIn + bibdIn;

  let cashOut = 0;
  let baiduriOut = 0;
  let bibdOut = 0;

  for (const e of expenses) {
    const amt = Number(e.amount) || 0;
    const pay = (e.payment || e.paymentMethod || '').toLowerCase();

    if (pay.includes('cash')) {
      cashOut += amt;
    } else if (pay.includes('baiduri') || pay.includes('card')) {
      baiduriOut += amt;
    } else if (pay.includes('bibd') || pay.includes('online')) {
      bibdOut += amt;
    } else {
      cashOut += amt;
    }
  }

  // Include PT Out sales as payouts
  for (const s of sales) {
    if (/pt payout|pt out/i.test(s.category || '')) {
      const amt = Number(s.amount) || 0;
      const pay = (s.payment || s.paymentMethod || '').toLowerCase();

      if (pay.includes('baiduri') || pay.includes('card')) {
        baiduriOut += amt;
      } else if (pay.includes('bibd') || pay.includes('online')) {
        bibdOut += amt;
      } else {
        cashOut += amt;
      }
    }
  }

  const totalExpenses = cashOut + baiduriOut + bibdOut;
  const netProfit = totalRevenue - totalExpenses;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    cashIn,
    baiduriIn,
    bibdIn,
    cashOut,
    baiduriOut,
    bibdOut,
  };
}

/**
 * Calculates Monthly & Overall Financial Summary metrics matching the requested table.
 */
export function calculateFinancialSummaryTable(data: DashboardData): Array<Array<string | number>> {
  const fmt = (num: number) => `$${(Number(num) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const allSales = data.store?.sales && data.store.sales.length > 0 ? data.store.sales : data.todaySales;
  const allExpenses = data.store?.expenses && data.store.expenses.length > 0 ? data.store.expenses : data.todayExpenses;

  // 1. Today metrics
  const todayMetrics = computePeriodFinancialMetrics(data.todaySales, data.todayExpenses);

  // 2. Month metrics
  const targetYearMonth = (data.viewDate || new Date().toISOString().split('T')[0]).substring(0, 7); // e.g. "2026-08"
  const isThisMonth = (ts?: any) => {
    if (!ts) return false;
    const iso = toIsoTimestampString(ts);
    return iso.startsWith(targetYearMonth);
  };

  const monthSales = allSales.filter((s: any) => isThisMonth(s.timestamp || s.createdAt || s.time));
  const monthExpenses = allExpenses.filter((e: any) => isThisMonth(e.timestamp || e.createdAt || e.time));
  const monthMetrics = computePeriodFinancialMetrics(
    monthSales.length > 0 ? monthSales : data.todaySales,
    monthExpenses.length > 0 ? monthExpenses : data.todayExpenses
  );

  // 3. Overall (All-Time) metrics
  const overallMetrics = computePeriodFinancialMetrics(allSales, allExpenses);

  // Get month label (e.g. "This Month (Aug 2026)")
  const dateObj = new Date(data.viewDate || Date.now());
  const monthName = isNaN(dateObj.getTime())
    ? 'This Month'
    : dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const summaryTable: Array<Array<string | number>> = [
    ['🏋️ GYM FINANCIAL SUMMARY', '', '', ''],
    ['Financial Metric', 'Today', `This Month (${monthName})`, 'Overall (All-Time)'],
    ['Total Revenue (Income)', fmt(todayMetrics.totalRevenue), fmt(monthMetrics.totalRevenue), fmt(overallMetrics.totalRevenue)],
    ['Total Expenses', fmt(todayMetrics.totalExpenses), fmt(monthMetrics.totalExpenses), fmt(overallMetrics.totalExpenses)],
    ['Net Profit / Balance', fmt(todayMetrics.netProfit), fmt(monthMetrics.netProfit), fmt(overallMetrics.netProfit)],
    ['INCOME BY PAYMENT METHOD', '', '', ''],
    ['Cash In', fmt(todayMetrics.cashIn), fmt(monthMetrics.cashIn), fmt(overallMetrics.cashIn)],
    ['Baiduri In', fmt(todayMetrics.baiduriIn), fmt(monthMetrics.baiduriIn), fmt(overallMetrics.baiduriIn)],
    ['BIBD In', fmt(todayMetrics.bibdIn), fmt(monthMetrics.bibdIn), fmt(overallMetrics.bibdIn)],
    ['EXPENSES BY PAYMENT METHOD', '', '', ''],
    ['Cash Out', fmt(todayMetrics.cashOut), fmt(monthMetrics.cashOut), fmt(overallMetrics.cashOut)],
    ['Baiduri Out', fmt(todayMetrics.baiduriOut), fmt(monthMetrics.baiduriOut), fmt(overallMetrics.baiduriOut)],
    ['BIBD Out', fmt(todayMetrics.bibdOut), fmt(monthMetrics.bibdOut), fmt(overallMetrics.bibdOut)],
  ];

  // 4. Collect all distinct past months across allSales and allExpenses
  const monthsMap = new Map<string, { sales: any[]; expenses: any[] }>();
  for (const s of allSales) {
    const iso = toIsoTimestampString(s.timestamp || s.createdAt || s.time);
    const ym = iso.substring(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym)) {
      if (!monthsMap.has(ym)) monthsMap.set(ym, { sales: [], expenses: [] });
      monthsMap.get(ym)!.sales.push(s);
    }
  }
  for (const e of allExpenses) {
    const iso = toIsoTimestampString(e.timestamp || e.createdAt || e.time);
    const ym = iso.substring(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym)) {
      if (!monthsMap.has(ym)) monthsMap.set(ym, { sales: [], expenses: [] });
      monthsMap.get(ym)!.expenses.push(e);
    }
  }

  const sortedMonths = Array.from(monthsMap.keys()).sort((a, b) => b.localeCompare(a));
  if (sortedMonths.length > 0) {
    summaryTable.push(['', '', '', '']);
    summaryTable.push(['📅 HISTORICAL MONTHLY BREAKDOWN', '', '', '']);
    summaryTable.push(['Month / Year', 'Revenue ($)', 'Expenses ($)', 'Net Profit ($)']);
    for (const ym of sortedMonths) {
      const entry = monthsMap.get(ym)!;
      const mMetrics = computePeriodFinancialMetrics(entry.sales, entry.expenses);
      const [yearStr, mStr] = ym.split('-');
      const d = new Date(Number(yearStr), Number(mStr) - 1, 1);
      const label = isNaN(d.getTime()) ? ym : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      summaryTable.push([label, fmt(mMetrics.totalRevenue), fmt(mMetrics.totalExpenses), fmt(mMetrics.netProfit)]);
    }
  }

  return summaryTable;
}

/**
 * Formats daily summary block into 2D string array for Google Sheets rows.
 */
export function buildDailySummaryRows(metrics: DailySummaryMetrics): Array<[string, string | number]> {
  const fmt = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  return [
    [metrics.headerTitle, ''],
    ['New Membership Sign-ups', metrics.newMembershipCount],
    ['Walk-In Entries', metrics.walkInCount],
    ['--- INCOME (PAYMENT IN) ---', ''],
    ['Cash In', fmt(metrics.cashIn)],
    ['Baiduri In', fmt(metrics.baiduriIn)],
    ['Bibd In', fmt(metrics.bibdIn)],
    ['Coupon In', fmt(metrics.couponIn)],
    ['TOTAL INCOME IN', fmt(metrics.totalIncomeIn)],
    ['--- EXPENSES (PAYMENT OUT) ---', ''],
    ['Cash Out', fmt(metrics.cashOut)],
    ['Baiduri Out', fmt(metrics.baiduriOut)],
    ['Bibd Out', fmt(metrics.bibdOut)],
    ['Coupon Out', fmt(metrics.couponOut)],
    ['TOTAL EXPENSES OUT', fmt(metrics.totalExpensesOut)],
    ['--- SUMMARY ---', ''],
    ['NET CASH BALANCE (Drawer Cash)', fmt(metrics.netCash)],
    ['NET BAIDURI BALANCE', fmt(metrics.netBaiduri)],
    ['NET BIBD BALANCE', fmt(metrics.netBibd)],
    ['NET DAILY BALANCE (All Methods)', fmt(metrics.netDaily)],
  ];
}

export function getStoreSpreadsheetTitle(storeName?: string): string {
  const name = (storeName || 'Binti Gym').trim();
  return `${name} - Management & Sales Log`;
}

export function extractSpreadsheetIdFromInput(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export async function verifyAndGetSpreadsheetInfo(accessToken: string, spreadsheetId: string): Promise<SpreadsheetInfo> {
  const cleanId = extractSpreadsheetIdFromInput(spreadsheetId);
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties(title)`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Invalid or inaccessible Google Spreadsheet ID / URL');
  }
  const metaData = await metaRes.json();
  return {
    spreadsheetId: cleanId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}`,
    title: metaData.properties?.title || 'Connected Gym Spreadsheet',
  };
}

export async function createNewStoreSpreadsheet(accessToken: string, storeName?: string): Promise<SpreadsheetInfo> {
  const title = getStoreSpreadsheetTitle(storeName);
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = {
    properties: { title },
    sheets: [
      { properties: { title: 'Daily Summary' } },
      { properties: { title: 'Monthly Summary' } },
      { properties: { title: 'Sales Log' } },
      { properties: { title: 'Check-In Log' } },
      { properties: { title: 'Members Directory' } },
      { properties: { title: 'Expenses Log' } },
    ],
  };

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(err.error?.message || 'Failed to create Google Spreadsheet');
  }

  const newSheet = await createRes.json();
  return {
    spreadsheetId: newSheet.spreadsheetId,
    spreadsheetUrl: newSheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newSheet.spreadsheetId}`,
    title,
  };
}

/**
 * Searches Google Drive for store's existing spreadsheet or creates a new one.
 */
export async function findOrCreateGymSpreadsheet(
  accessToken: string,
  storeName?: string,
  customSpreadsheetId?: string
): Promise<SpreadsheetInfo> {
  // If custom ID or stored ID is provided, verify first
  if (customSpreadsheetId && customSpreadsheetId.trim()) {
    try {
      const cleanId = extractSpreadsheetIdFromInput(customSpreadsheetId);
      return await verifyAndGetSpreadsheetInfo(accessToken, cleanId);
    } catch (err) {
      console.warn('Custom spreadsheet not accessible, falling back to store title search:', err);
    }
  }

  const title = getStoreSpreadsheetTitle(storeName);

  // 1. Search in Drive specifically for this store's spreadsheet title
  const query = encodeURIComponent(
    `name='${title}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const err = await searchRes.json();
    throw new Error(err.error?.message || 'Failed to search Google Drive');
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const file = searchData.files[0];
    return {
      spreadsheetId: file.id,
      spreadsheetUrl: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
      title: file.name,
    };
  }

  // 2. Create new spreadsheet with Daily Summary & Monthly Summary tabs specifically for this store
  return await createNewStoreSpreadsheet(accessToken, storeName);
}

/**
 * Ensures 'Monthly Summary' sheet exists in the target spreadsheet.
 */
async function ensureMonthlySummarySheetExists(accessToken: string, spreadsheetId: string): Promise<number | null> {
  try {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!metaRes.ok) return null;
    const metaData = await metaRes.json();
    const existing = metaData.sheets?.find((s: any) => s.properties?.title === 'Monthly Summary');
    if (existing) {
      return existing.properties.sheetId;
    }

    // Add 'Monthly Summary' sheet if missing
    const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: 'Monthly Summary',
                index: 1,
              },
            },
          },
        ],
      }),
    });

    if (addRes.ok) {
      const resJson = await addRes.json();
      return resJson.replies?.[0]?.addSheet?.properties?.sheetId || null;
    }
  } catch (err) {
    console.warn('Error ensuring Monthly Summary sheet:', err);
  }
  return null;
}

/**
 * Fetches existing rows from 'Daily Summary' to preserve historical summaries.
 */
async function fetchExistingDailySummaryRows(accessToken: string, spreadsheetId: string): Promise<string[][]> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Daily Summary'!A1:B50000`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.values) ? data.values : [];
  } catch {
    return [];
  }
}

/**
 * Merges newly generated daily summary blocks with any older archive blocks already in Google Sheets.
 */
function mergeDailySummariesWithGenerated(
  generatedRows: Array<[string, string | number]>,
  existingRows: string[][],
  generatedHeaderTitles: string[]
): Array<[string, string | number]> {
  if (!existingRows || existingRows.length === 0) {
    return generatedRows;
  }

  // Parse existing rows into separate blocks
  const blocks: Array<Array<[string, string | number]>> = [];
  let currentBlock: Array<[string, string | number]> = [];

  for (const row of existingRows) {
    const colA = (row[0] || '').trim();
    let colB: string | number = row[1] !== undefined ? row[1] : '';

    // Check if this row marks the start of a report block
    if (colA.startsWith('REPORT FOR ') && currentBlock.length > 0) {
      blocks.push(currentBlock);
      currentBlock = [];
    }

    // Ignore old legacy table headers
    if (colA === 'Metric' && colB === 'Value') continue;
    if (colA === 'Report Date') continue;

    // Sanitize any previous date-formatted 0 values from older syncs
    if (
      (colA === 'New Membership Sign-ups' || colA === 'Walk-In Entries') &&
      typeof colB === 'string' &&
      (colB === '1899-12-31' || colB === '1899-12-30' || colB.startsWith('1899-'))
    ) {
      colB = 0;
    }

    currentBlock.push([colA, colB]);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  // Filter out any previous block that matches one of the freshly generated headers
  const generatedHeadersUpper = new Set(generatedHeaderTitles.map((h) => h.toUpperCase().trim()));

  const olderUnrepresentedBlocks = blocks.filter((b) => {
    const firstRowA = (b[0]?.[0] || '').toString().trim().toUpperCase();
    return !generatedHeadersUpper.has(firstRowA);
  });

  const merged: Array<[string, string | number]> = [...generatedRows];

  for (const block of olderUnrepresentedBlocks) {
    // Add separator spacing row between daily summary blocks
    merged.push(['', '']);
    merged.push(...block);
  }

  return merged;
}

/**
 * Writes complete gym data (all past historical records + all daily summaries) into the Google Sheets tabs.
 */
export async function syncDataToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  data: DashboardData
): Promise<void> {
  // Ensure Monthly Summary tab exists in the destination spreadsheet
  const monthlySheetId = await ensureMonthlySummarySheetExists(accessToken, spreadsheetId);

  // 1. Gather all historical records (store-wide datasets with today fallbacks)
  const allSales = data.store?.sales && data.store.sales.length > 0 ? data.store.sales : data.todaySales;
  const allExpenses = data.store?.expenses && data.store.expenses.length > 0 ? data.store.expenses : data.todayExpenses;
  const allAttendance = data.store?.attendance && data.store.attendance.length > 0 ? data.store.attendance : data.todayAttendance;
  const allMembers = data.store?.members && data.store.members.length > 0 ? data.store.members : data.members;

  // 2. Compute Daily Summary blocks for all distinct dates found in the data (newest on top)
  const allDates = getAllDistinctHistoricalDates(data);
  const generatedDailyBlocks: Array<Array<[string, string | number]>> = [];
  const headerTitles: string[] = [];

  for (const dStr of allDates) {
    const metrics = calculateDailySummaryForSpecificDate(dStr, allSales, allExpenses, allAttendance, allMembers);
    headerTitles.push(metrics.headerTitle);
    generatedDailyBlocks.push(buildDailySummaryRows(metrics));
  }

  // Flatten generated blocks with spacing
  const flatGeneratedRows: Array<[string, string | number]> = [];
  for (let i = 0; i < generatedDailyBlocks.length; i++) {
    if (i > 0) {
      flatGeneratedRows.push(['', '']);
    }
    flatGeneratedRows.push(...generatedDailyBlocks[i]);
  }

  // 3. Fetch existing daily summary rows to preserve any older historical sheets rows
  const existingSummaryRows = await fetchExistingDailySummaryRows(accessToken, spreadsheetId);
  const mergedSummaryRows = mergeDailySummariesWithGenerated(
    flatGeneratedRows,
    existingSummaryRows,
    headerTitles
  );

  // 4. Generate Monthly & Historical Financial Summary table
  const monthlySummaryRows = calculateFinancialSummaryTable(data);

  // 5. Prepare all historical datasets in reverse chronological order (latest on top)
  const sortedSales = [...allSales].sort((a, b) => parseRecordTimestampMs(b) - parseRecordTimestampMs(a));
  const sortedAttendance = [...allAttendance].sort((a, b) => parseRecordTimestampMs(b) - parseRecordTimestampMs(a));
  const sortedExpenses = [...allExpenses].sort((a, b) => parseRecordTimestampMs(b) - parseRecordTimestampMs(a));
  const sortedMembers = [...allMembers].sort((a, b) => {
    const timeA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const timeB = b.startDate ? new Date(b.startDate).getTime() : 0;
    return timeB - timeA;
  });

  // 6. Clear existing values across all data tabs so stale rows are completely purged
  try {
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
    const clearBody = {
      ranges: [
        "'Daily Summary'!A1:Z50000",
        "'Monthly Summary'!A1:Z5000",
        "'Sales Log'!A1:Z50000",
        "'Check-In Log'!A1:Z50000",
        "'Members Directory'!A1:Z50000",
        "'Expenses Log'!A1:Z50000",
      ],
    };
    await fetch(clearUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clearBody),
    });
  } catch (clearErr) {
    console.warn('Optional batch clear notice:', clearErr);
  }

  // 7. Prepare batch update value ranges (all past data included)
  const valueRanges = [
    // 1. Daily Summary (All past dates + latest on top)
    {
      range: "'Daily Summary'!A1",
      values: mergedSummaryRows,
    },
    // 2. Monthly Financial Summary (Includes today, this month, overall, and historical months)
    {
      range: "'Monthly Summary'!A1",
      values: monthlySummaryRows,
    },
    // 3. Sales Log (All past sales - latest on top)
    {
      range: "'Sales Log'!A1",
      values: [
        ['Date & Time', 'Staff on Duty', 'Category', 'Customer / Guest', 'Phone Number', 'Payment Method', 'Amount ($)'],
        ...sortedSales.map((s) => [
          formatDateTimeForSheet(s.timestamp || s.createdAt, s.time),
          s.staff || 'Duty Staff',
          s.category || 'General',
          s.customer || 'Walk-in Guest',
          s.phone && s.phone !== '-' ? s.phone : '-',
          s.payment || s.paymentMethod || 'Cash',
          Number(s.amount) || 0,
        ]),
      ],
    },
    // 4. Check-In Log (All past check-ins - latest on top)
    {
      range: "'Check-In Log'!A1",
      values: [
        ['Check-In Date & Time', 'Member / Guest Name', 'Phone Number', 'Plan / Activity', 'Check-In Status'],
        ...sortedAttendance.map((a) => [
          formatDateTimeForSheet(a.timestamp || a.createdAt, a.time),
          a.name || 'Guest',
          a.phone && a.phone !== '-' ? a.phone : '-',
          a.plan || '-',
          a.status || 'Active',
        ]),
      ],
    },
    // 5. Members Directory (All gym members in the system)
    {
      range: "'Members Directory'!A1",
      values: [
        ['Member ID', 'Full Name', 'Phone', 'Plan', 'Start Date', 'End Date', 'Status'],
        ...sortedMembers.map((m) => [
          m.memberId || '-',
          m.name || '',
          m.phone && m.phone !== '-' ? m.phone : '-',
          m.plan || 'Standard Monthly',
          m.startDate || '-',
          m.endDate || '-',
          m.status || 'Active',
        ]),
      ],
    },
    // 6. Expenses Log (All past expenses - latest on top)
    {
      range: "'Expenses Log'!A1",
      values: [
        ['Date & Time', 'Staff on Duty', 'Category', 'Description', 'Payment Method', 'Amount ($)'],
        ...sortedExpenses.map((e) => [
          formatDateTimeForSheet(e.timestamp || e.createdAt, e.time),
          e.staff || 'Duty Staff',
          e.category || 'General',
          e.description || '-',
          e.payment || e.paymentMethod || 'Cash',
          Number(e.amount) || 0,
        ]),
      ],
    },
  ];

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const body = {
    valueInputOption: 'USER_ENTERED',
    data: valueRanges,
  };

  const res = await fetch(updateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to update Google Sheets data');
  }

  // 8. Apply rich visual styling to Daily Summary, Monthly Summary, and Log sheets
  try {
    await applyDailySummaryFormatting(accessToken, spreadsheetId, mergedSummaryRows);
    if (monthlySheetId !== null) {
      await applyMonthlySummaryFormatting(accessToken, spreadsheetId, monthlySheetId);
    }
    await applyLogSheetsFormatting(accessToken, spreadsheetId);
  } catch (styleErr) {
    console.warn('Optional Google Sheets visual styling notice:', styleErr);
  }
}

/**
 * Applies visual styling and borders to 'Daily Summary' sheet across ALL summary blocks (both newest and all previous/older data).
 */
async function applyDailySummaryFormatting(
  accessToken: string,
  spreadsheetId: string,
  mergedSummaryRows: Array<[string, string | number]>
): Promise<void> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) return;
  const metaData = await metaRes.json();
  const summarySheet = metaData.sheets?.find((s: any) => s.properties?.title === 'Daily Summary');
  if (!summarySheet) return;

  const sheetId = summarySheet.properties.sheetId;

  const requests: any[] = [
    // Column widths
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 270 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 140 },
        fields: 'pixelSize',
      },
    },
  ];

  // Scan through ALL rows of mergedSummaryRows and format every daily block (newest and historical)
  let currentBlockStart: number | null = null;

  for (let r = 0; r < mergedSummaryRows.length; r++) {
    const colA = (mergedSummaryRows[r]?.[0] || '').toString().trim();
    const colAUpper = colA.toUpperCase();

    // Check for block start (e.g. "REPORT FOR 2026-08-20")
    if (colAUpper.startsWith('REPORT FOR ')) {
      // If previous block was open, add its border
      if (currentBlockStart !== null && r > currentBlockStart) {
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: currentBlockStart,
              endRowIndex: r - (mergedSummaryRows[r - 1]?.[0] === '' ? 1 : 0),
              startColumnIndex: 0,
              endColumnIndex: 2,
            },
            top: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
            bottom: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
            left: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
            right: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
            innerHorizontal: { style: 'SOLID', color: { red: 203 / 255, green: 213 / 255, blue: 225 / 255 } },
            innerVertical: { style: 'SOLID', color: { red: 203 / 255, green: 213 / 255, blue: 225 / 255 } },
          },
        });
      }
      currentBlockStart = r;

      // Header Banner (REPORT FOR ...) - Dark Navy #0F172A
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 2 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 15 / 255, green: 23 / 255, blue: 42 / 255 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      });
      continue;
    }

    if (colA === 'New Membership Sign-ups' || colA === 'Walk-In Entries') {
      // Explicit Number Format #,##0 and right alignment for numeric quantity
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 1, endColumnIndex: 2 },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'NUMBER', pattern: '#,##0' },
              horizontalAlignment: 'RIGHT',
            },
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      });
    } else if (colAUpper.includes('INCOME (PAYMENT IN)')) {
      // --- INCOME (PAYMENT IN) --- Green Banner #16A34A
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 2 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 22 / 255, green: 163 / 255, blue: 74 / 255 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      });
    } else if (colAUpper === 'TOTAL INCOME IN') {
      // TOTAL INCOME IN - Light green background #DCFCE7, Dark green bold text #15803D
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 2 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 220 / 255, green: 252 / 255, blue: 231 / 255 },
              textFormat: { foregroundColor: { red: 21 / 255, green: 128 / 255, blue: 61 / 255 }, bold: true },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
    } else if (colAUpper.includes('EXPENSES (PAYMENT OUT)')) {
      // --- EXPENSES (PAYMENT OUT) --- Red Banner #DC2626
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 2 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 220 / 255, green: 38 / 255, blue: 38 / 255 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      });
    } else if (colAUpper === 'TOTAL EXPENSES OUT') {
      // TOTAL EXPENSES OUT - Light red background #FFE4E6, Dark red bold text #B91C1C
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 2 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 255 / 255, green: 228 / 255, blue: 230 / 255 },
              textFormat: { foregroundColor: { red: 185 / 255, green: 28 / 255, blue: 28 / 255 }, bold: true },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
    } else if (colAUpper === '--- SUMMARY ---' || colAUpper.includes('SUMMARY')) {
      // --- SUMMARY --- Dark Navy Banner #0F172A
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 2 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 15 / 255, green: 23 / 255, blue: 42 / 255 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      });
    } else if (
      colAUpper.startsWith('NET CASH') ||
      colAUpper.startsWith('NET BAIDURI') ||
      colAUpper.startsWith('NET BIBD')
    ) {
      // Net individual balances - Soft neutral background #F8FAFC
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 2 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 248 / 255, green: 250 / 255, blue: 252 / 255 },
              textFormat: { foregroundColor: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 }, bold: true },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
    } else if (colAUpper.startsWith('NET DAILY BALANCE')) {
      // NET DAILY BALANCE (All Methods) - Highlighted with soft gold background #FEF08A & dark amber bold text #92400E
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 2 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 254 / 255, green: 240 / 255, blue: 138 / 255 },
              textFormat: { foregroundColor: { red: 146 / 255, green: 64 / 255, blue: 14 / 255 }, bold: true, fontSize: 10 },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
    }
  }

  // Close the border for the final block
  if (currentBlockStart !== null && mergedSummaryRows.length > currentBlockStart) {
    const lastRowIndex = mergedSummaryRows.length;
    requests.push({
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: currentBlockStart,
          endRowIndex: lastRowIndex,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        top: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
        bottom: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
        left: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
        right: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
        innerHorizontal: { style: 'SOLID', color: { red: 203 / 255, green: 213 / 255, blue: 225 / 255 } },
        innerVertical: { style: 'SOLID', color: { red: 203 / 255, green: 213 / 255, blue: 225 / 255 } },
      },
    });
  }

  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetch(batchUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
}

/**
 * Applies visual styling and borders to 'Monthly Summary' sheet matching the executive layout.
 */
async function applyMonthlySummaryFormatting(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number
): Promise<void> {
  const requests: any[] = [
    // Column widths: Col A = 260px, Col B = 140px, Col C = 170px, Col D = 170px
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 260 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 140 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
        properties: { pixelSize: 170 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
        properties: { pixelSize: 170 },
        fields: 'pixelSize',
      },
    },
    // Row 1 (Index 0): Header Banner (🏋️ GYM FINANCIAL SUMMARY) - Dark Navy #0F172A, Bold white text
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 15 / 255, green: 23 / 255, blue: 42 / 255 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 12 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // Row 2 (Index 1): Table Column Headers - Dark Slate #1E293B, Bold white text
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    // Row 3 (Index 2): Total Revenue (Income) - Soft Green #DCFCE7, Dark Green Text #15803D
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 220 / 255, green: 252 / 255, blue: 231 / 255 },
            textFormat: { foregroundColor: { red: 21 / 255, green: 128 / 255, blue: 61 / 255 }, bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    // Row 4 (Index 3): Total Expenses - Soft Red #FFE4E6, Dark Red Text #B91C1C
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 255 / 255, green: 228 / 255, blue: 230 / 255 },
            textFormat: { foregroundColor: { red: 185 / 255, green: 28 / 255, blue: 28 / 255 }, bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    // Row 5 (Index 4): Net Profit / Balance - Soft Gold #FEF08A, Dark Amber Text #92400E
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 254 / 255, green: 240 / 255, blue: 138 / 255 },
            textFormat: { foregroundColor: { red: 146 / 255, green: 64 / 255, blue: 14 / 255 }, bold: true, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    // Row 6 (Index 5): INCOME BY PAYMENT METHOD - Green Banner #16A34A, White bold text
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 22 / 255, green: 163 / 255, blue: 74 / 255 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // Row 10 (Index 9): EXPENSES BY PAYMENT METHOD - Red Banner #DC2626, White bold text
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 9, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 220 / 255, green: 38 / 255, blue: 38 / 255 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // Complete Table Grid Borders for Monthly Summary (A1:D13)
    {
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 13,
          startColumnIndex: 0,
          endColumnIndex: 4,
        },
        top: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
        bottom: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
        left: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
        right: { style: 'SOLID_MEDIUM', color: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 } },
        innerHorizontal: { style: 'SOLID', color: { red: 203 / 255, green: 213 / 255, blue: 225 / 255 } },
        innerVertical: { style: 'SOLID', color: { red: 203 / 255, green: 213 / 255, blue: 225 / 255 } },
      },
    },
  ];

  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetch(batchUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
}

/**
 * Applies clean header formatting and column sizing to all log sheets.
 */
async function applyLogSheetsFormatting(accessToken: string, spreadsheetId: string): Promise<void> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) return;
  const metaData = await metaRes.json();
  const sheets = metaData.sheets || [];

  const logTitles = ['Sales Log', 'Check-In Log', 'Members Directory', 'Expenses Log'];
  const requests: any[] = [];

  for (const s of sheets) {
    const title = s.properties?.title;
    if (!logTitles.includes(title)) continue;
    const sheetId = s.properties.sheetId;

    // Header Row Format (Dark Navy #0F172A, Bold White Text)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 15 / 255, green: 23 / 255, blue: 42 / 255 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
  }

  if (requests.length > 0) {
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    await fetch(batchUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });
  }
}

/**
 * Fetches all members listed in the Google Sheets 'Members Directory' (or 'Members List') tab.
 */
export async function fetchMembersFromGoogleSheets(
  accessToken: string,
  spreadsheetId: string
): Promise<Member[]> {
  // Check which tab exists: 'Members Directory' or fallback to 'Members List'
  let range = "'Members Directory'!A2:G500";
  let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    range = "'Members List'!A2:G500";
    url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  if (!res.ok) {
    throw new Error('Could not find "Members Directory" or "Members List" tab in your Google Spreadsheet.');
  }

  const json = await res.json();
  const rows: any[][] = json.values || [];
  const members: Member[] = [];

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    // Header row skip
    const firstCell = String(row[0] || '').trim().toLowerCase();
    if (firstCell.includes('member id') || firstCell === 'id') continue;

    // Column mapping:
    // A (0): Member ID (e.g. MEM-123456 or empty)
    // B (1): Full Name
    // C (2): Phone
    // D (3): Plan
    // E (4): Start Date
    // F (5): End Date
    // G (6): Status
    let memberId = String(row[0] || '').trim();
    let name = String(row[1] || '').trim();
    let phone = String(row[2] || '').trim();
    let plan = String(row[3] || '').trim();
    let startDate = String(row[4] || '').trim();
    let endDate = String(row[5] || '').trim();
    let status = String(row[6] || '').trim();

    // If user typed name in column A instead of ID
    if (!name && memberId && !memberId.startsWith('MEM') && isNaN(Number(memberId))) {
      name = memberId;
      memberId = '';
    }

    if (!name) continue;

    members.push({
      memberId: memberId || undefined,
      name,
      phone,
      plan: plan || 'Standard Monthly',
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || '',
      status: (status as any) || undefined,
    });
  }

  return members;
}
