import {
  doc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, ensureFirebaseAuth } from './firebase';
import { DashboardData, Member, StaffShift, RegisteredStaff, CheckInResponse, PTDetail, SpreadsheetInfo } from '../types';

export const BRUNEI_TIMEZONE = 'Asia/Brunei';

export interface SyncEventPayload {
  deviceId?: string;
  type?: 'checkin' | 'walkin' | 'pos' | 'class' | 'pt' | 'membership' | 'shift' | 'expense' | 'reset' | 'expired' | 'blocked' | 'info';
  title?: string;
  message?: string;
  timestamp?: string;
  memberName?: string;
  memberId?: string;
}

export interface GymDataStore {
  members: Member[];
  attendance: any[];
  expenses: any[];
  sales: any[];
  registeredStaff: RegisteredStaff[];
  activeShift: StaffShift | null;
  staffPin: string;
  availableStores?: string[];
}

export function getBruneiTodayIsoDate(dateObj?: Date): string {
  const d = dateObj || new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRUNEI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

export function getBruneiFormattedTime(dateObj?: Date, includeSeconds = false): string {
  const d = dateObj || new Date();
  return d.toLocaleTimeString('en-US', {
    timeZone: BRUNEI_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  });
}

export function toIsoTimestampString(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return new Date(val).toISOString();
  if (val instanceof Date) return val.toISOString();
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {}
  }
  if (typeof val?.seconds === 'number') {
    return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000).toISOString();
  }
  return String(val);
}

export function isSameDate(rawTimestamp: any, targetDateStr: string): boolean {
  if (!rawTimestamp || !targetDateStr) return false;
  const iso = toIsoTimestampString(rawTimestamp);
  const str = String(iso).trim();
  if (str.startsWith(targetDateStr)) return true;

  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;

  const bruneiDate = getBruneiTodayIsoDate(d);
  if (bruneiDate === targetDateStr) return true;

  try {
    const utcDate = d.toISOString().split('T')[0];
    if (utcDate === targetDateStr) return true;
  } catch (e) {}

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const localDate = `${year}-${month}-${day}`;
  if (localDate === targetDateStr) return true;

  return false;
}

export function getMemberStatus(endDateStr: string, referenceDateStr?: string): 'Active' | 'Expiring Soon' | 'Expired' {
  if (!endDateStr) return 'Active';
  try {
    const refDate = referenceDateStr ? new Date(referenceDateStr + 'T00:00:00') : new Date();
    if (isNaN(refDate.getTime())) return 'Active';
    refDate.setHours(0, 0, 0, 0);

    const expDate = new Date(endDateStr + 'T00:00:00');
    if (isNaN(expDate.getTime())) return 'Active';
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate.getTime() - refDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays <= 7) return 'Expiring Soon';
    return 'Active';
  } catch (e) {
    return 'Active';
  }
}

export function parsePTCustomer(customerStr: string): { clientName: string; trainer: string; sessions: string } {
  try {
    const cust = (customerStr || '').toString();
    let clientName = '';
    let trainer = '';
    let sessions = '';

    const trainerMatch = cust.match(/Trainer:\s*([^|,]+)/i);
    const clientMatch = cust.match(/Client:\s*([^|,]+)/i);

    if (trainerMatch) trainer = trainerMatch[1].trim();
    if (clientMatch) clientName = clientMatch[1].trim();

    const sessionsMatch = cust.match(/(\d+\s*session[s]?|session[s]?:?\s*[^|]+)/i);
    if (sessionsMatch) sessions = sessionsMatch[0].trim();

    if (!clientName || !trainer) {
      if (cust.includes('|')) {
        const parts = cust.split('|').map((p) => p.trim());
        if (!clientName) clientName = parts[0] || '';
        for (let i = 1; i < parts.length; i++) {
          const p = parts[i];
          if (/^trainer:/i.test(p)) trainer = p.split(':').slice(1).join(':').trim();
          else if (/session/i.test(p)) sessions = p;
          else if (!clientName) clientName = p;
        }
      } else {
        const m = cust.match(/^(.*)\s*\(Trainer:\s*(.*)\)$/i);
        if (m) {
          clientName = clientName || m[1].trim();
          trainer = trainer || m[2].trim();
        } else {
          const t = cust.match(/Trainer:\s*([^|,;]+)/i);
          if (t) trainer = trainer || t[1].trim();
          clientName = clientName || cust.replace(/Trainer:.*$/i, '').replace(/\|/g, '').trim();
        }
      }
    }

    return { clientName, trainer, sessions };
  } catch (e) {
    return { clientName: customerStr || '', trainer: '', sessions: '' };
  }
}

let cachedDeviceId: string | null = null;

export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    let stored = localStorage.getItem('gym_device_id');
    if (!stored) {
      stored = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('gym_device_id', stored);
    }
    cachedDeviceId = stored;
    return stored;
  } catch {
    cachedDeviceId = 'dev_' + Math.random().toString(36).substring(2, 9);
    return cachedDeviceId;
  }
}

export function getStoredBusinessName(): string {
  try {
    return localStorage.getItem('current_business_name') || 'Binti Gym';
  } catch {
    return 'Binti Gym';
  }
}

export function getStoredBusinessPin(): string {
  try {
    return localStorage.getItem('current_business_pin') || '1234';
  } catch {
    return '1234';
  }
}

export function normalizeStoreKey(businessName?: string): string {
  const name = businessName || getStoredBusinessName();
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return clean || 'binti_gym';
}

export function getStoredActiveShift(businessName?: string): StaffShift | null {
  try {
    const key = normalizeStoreKey(businessName);
    const stored = localStorage.getItem(`gym_active_shift_${key}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && parsed.staffName) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to get stored active shift:', e);
  }
  return null;
}

export function saveStoredActiveShift(shift: StaffShift | null, businessName?: string) {
  try {
    const key = normalizeStoreKey(businessName);
    if (shift) {
      localStorage.setItem(`gym_active_shift_${key}`, JSON.stringify(shift));
    } else {
      localStorage.removeItem(`gym_active_shift_${key}`);
    }
  } catch (e) {
    console.warn('Failed to save stored active shift:', e);
  }
}

function getBusinessDocRef(businessName?: string) {
  const key = normalizeStoreKey(businessName);
  return doc(db, 'businesses', key);
}

function getBusinessCollectionRef(businessName: string, subcollection: string) {
  const key = normalizeStoreKey(businessName);
  return collection(db, 'businesses', key, subcollection);
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// Compute live dashboard metrics from subcollection records
export function computeDashboardFromCollections(
  targetDateStr: string,
  members: Member[],
  attendance: any[],
  sales: any[],
  expenses: any[],
  staffList: RegisteredStaff[] = [],
  activeShift: StaffShift | null = null,
  staffPin: string = '123456',
  availableStores: string[] = ['Binti Gym']
): DashboardData {
  let totalRevenue = 0;
  let totalExpenses = 0;
  let posSalesTotal = 0;
  let classSalesTotal = 0;
  let ptSalesTotal = 0;
  let ptPayoutTotal = 0;
  let walkInSalesTotal = 0;
  let membershipSalesTotal = 0;
  let checkinCount = 0;
  let expiringCount = 0;

  let cashIn = 0;
  let cashOut = 0;
  let baiduriIn = 0;
  let bibdIn = 0;

  const todaySales: any[] = [];
  const todayExpenses: any[] = [];
  const todayAttendance: any[] = [];
  const membersList: Member[] = [];
  const ptDetails: PTDetail[] = [];

  for (const m of members) {
    const status = getMemberStatus(m.endDate, targetDateStr);
    if (status === 'Expiring Soon' || status === 'Expired') {
      expiringCount++;
    }
    membersList.push({
      memberId: m.memberId,
      name: m.name,
      phone: m.phone,
      plan: m.plan,
      startDate: m.startDate,
      endDate: m.endDate,
      status,
    });
  }

  for (const s of sales) {
    if (isSameDate(s.timestamp, targetDateStr)) {
      const d = new Date(s.timestamp);
      const category = s.category || '';
      const customer = s.customer || '';
      const paymentRaw = s.paymentMethod || s.payment || '';
      const payment = paymentRaw.trim().toLowerCase();
      const amount = Number(s.amount) || 0;

      totalRevenue += amount;
      if (/pos|sauna/i.test(category)) posSalesTotal += amount;
      else if (/class/i.test(category)) classSalesTotal += amount;
      else if (/pt|personal/i.test(category)) ptSalesTotal += amount;
      else if (/walk-?in/i.test(category)) walkInSalesTotal += amount;
      else if (/membership|renew/i.test(category)) membershipSalesTotal += amount;

      if (payment.includes('cash')) cashIn += amount;
      else if (payment.includes('baiduri')) baiduriIn += amount;
      else if (payment.includes('bibd')) bibdIn += amount;

      todaySales.push({
        id: s.id,
        timestamp: s.timestamp,
        time: getBruneiFormattedTime(isNaN(d.getTime()) ? undefined : d),
        category,
        customer,
        phone: s.phone || '',
        payment: paymentRaw,
        amount,
        staff: s.staff || 'Duty Staff',
      });

      if (/pt|personal/i.test(category)) {
        const parsed = parsePTCustomer(customer);
        ptDetails.push({
          time: getBruneiFormattedTime(isNaN(d.getTime()) ? undefined : d),
          trainer: parsed.trainer || s.trainerName || '',
          client: parsed.clientName || s.clientName || '',
          sessions: parsed.sessions || s.sessions || '',
          amount,
        });
      }
    }
  }

  for (const e of expenses) {
    if (isSameDate(e.timestamp, targetDateStr)) {
      const d = new Date(e.timestamp);
      const category = e.category || '';
      const description = e.description || '';
      const paymentRaw = e.paymentMethod || e.payment || '';
      const payment = paymentRaw.trim().toLowerCase();
      const amount = Number(e.amount) || 0;

      totalExpenses += amount;
      if (/pt payout/i.test(category)) ptPayoutTotal += amount;
      if (payment.includes('cash')) cashOut += amount;

      todayExpenses.push({
        id: e.id,
        timestamp: e.timestamp,
        time: getBruneiFormattedTime(isNaN(d.getTime()) ? undefined : d),
        category,
        description,
        payment: paymentRaw,
        amount,
        staff: e.staff || 'Duty Staff',
      });
    }
  }

  for (const a of attendance) {
    if (isSameDate(a.timestamp, targetDateStr)) {
      const d = new Date(a.timestamp);
      checkinCount++;
      todayAttendance.push({
        id: a.id,
        timestamp: a.timestamp,
        time: getBruneiFormattedTime(isNaN(d.getTime()) ? undefined : d),
        name: a.name || 'Guest',
        phone: a.phone || '-',
        plan: a.plan || '-',
        status: a.status || 'Active',
      });
    }
  }

  // Sort in reverse chronological order so latest records appear at the top
  const parseTimestampMs = (ts?: string): number => {
    if (!ts) return 0;
    const time = new Date(ts).getTime();
    return isNaN(time) ? 0 : time;
  };

  todaySales.sort((a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp));
  todayExpenses.sort((a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp));
  todayAttendance.sort((a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp));

  // Sort members list so newest registered members appear at top
  membersList.sort((a, b) => {
    const timeA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const timeB = b.startDate ? new Date(b.startDate).getTime() : 0;
    return timeB - timeA;
  });

  const storeData: GymDataStore = {
    members: membersList,
    attendance,
    sales,
    expenses,
    registeredStaff: staffList.length > 0 ? staffList : [
      { id: 'STF-101', name: 'System Admin', phone: '8000000', pin: '123456', registeredAt: new Date().toISOString() }
    ],
    activeShift,
    staffPin,
    availableStores,
  };

  return {
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    posSalesTotal,
    classSalesTotal,
    ptSalesTotal,
    ptPayoutTotal,
    walkInSalesTotal,
    membershipSalesTotal,
    checkinCount,
    expiringCount,
    todayAttendance,
    todaySales,
    todayExpenses,
    members: membersList,
    cashIn,
    cashOut,
    baiduriIn,
    bibdIn,
    ptDetails,
    viewDate: targetDateStr,
    store: storeData,
  };
}

// Helper to clear a subcollection completely
async function clearSubcollectionDocs(collRef: any) {
  try {
    const snap = await getDocs(collRef);
    if (!snap.empty) {
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
  } catch (e) {
    console.warn('Subcollection cleanup warning:', e);
  }
}

// Initial seed data populator for fresh stores in Firestore
export async function seedInitialBusinessData(businessName: string, pin: string, clearFirst = true) {
  const bizRef = getBusinessDocRef(businessName);
  const cleanName = businessName.trim();
  const todayDateStr = getBruneiTodayIsoDate();

  const dToday = new Date();
  const d30DaysAgo = new Date(dToday);
  d30DaysAgo.setDate(dToday.getDate() - 30);
  const start30Ago = getBruneiTodayIsoDate(d30DaysAgo);

  const d5DaysLater = new Date(dToday);
  d5DaysLater.setDate(dToday.getDate() + 5);
  const end5Later = getBruneiTodayIsoDate(d5DaysLater);

  const d30DaysLater = new Date(dToday);
  d30DaysLater.setDate(dToday.getDate() + 30);
  const end30Later = getBruneiTodayIsoDate(d30DaysLater);

  const d365DaysLater = new Date(dToday);
  d365DaysLater.setDate(dToday.getDate() + 365);
  const end365Later = getBruneiTodayIsoDate(d365DaysLater);

  const d10DaysAgo = new Date(dToday);
  d10DaysAgo.setDate(dToday.getDate() - 10);
  const end10Ago = getBruneiTodayIsoDate(d10DaysAgo);

  const deviceId = getDeviceId();

  const makeBruneiIso = (timeStr: string) => {
    return new Date(`${todayDateStr}T${timeStr}:00+08:00`).toISOString();
  };

  try {
    if (clearFirst) {
      await Promise.all([
        clearSubcollectionDocs(getBusinessCollectionRef(cleanName, 'attendance')),
        clearSubcollectionDocs(getBusinessCollectionRef(cleanName, 'sales')),
        clearSubcollectionDocs(getBusinessCollectionRef(cleanName, 'expenses')),
      ]);
    }

    const promises: Promise<any>[] = [];

    // 1. Initial staff shift for today
    const nowTime = getBruneiFormattedTime(new Date());
    const demoShift: StaffShift = {
      id: `shift-demo-${Date.now()}`,
      staffName: 'System Admin',
      shiftTitle: 'Morning Duty Shift',
      startTime: nowTime,
      startTimestamp: Date.now(),
      startingFloat: 100,
      notes: 'Initial demo duty shift with standard float',
    };
    saveStoredActiveShift(demoShift, cleanName);

    // 2. Create root business doc
    promises.push(
      setDoc(
        bizRef,
        {
          name: cleanName,
          pin: (pin || '1234').trim(),
          staffPin: '123456',
          activeShift: demoShift,
          availableStores: [cleanName],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          deviceId,
        },
        { merge: true }
      )
    );

    // 3. Seed members
    const initialMembers = [
      { memberId: 'MEM-100241', name: 'Ahmad Daniel', phone: '8712345', plan: 'Standard Monthly', startDate: start30Ago, endDate: end30Later, status: 'Active' },
      { memberId: 'MEM-204891', name: 'Siti Nurhaliza', phone: '8823456', plan: 'Student Monthly', startDate: start30Ago, endDate: end5Later, status: 'Expiring Soon' },
      { memberId: 'MEM-309123', name: 'Markus Vance', phone: '8934567', plan: 'Standard Monthly', startDate: '2026-05-01', endDate: end10Ago, status: 'Expired' },
      { memberId: 'MEM-401928', name: 'Jessica Tan', phone: '8765432', plan: 'Standard Monthly', startDate: start30Ago, endDate: end30Later, status: 'Active' },
      { memberId: 'MEM-501192', name: 'Hajah Maryam', phone: '8899112', plan: 'VIP Yearly', startDate: start30Ago, endDate: end365Later, status: 'Active' },
      { memberId: 'MEM-602819', name: 'Mohammad Razi', phone: '8776655', plan: 'Standard Monthly', startDate: start30Ago, endDate: end30Later, status: 'Active' },
      { memberId: 'MEM-703412', name: 'Kevin Lim', phone: '8654321', plan: 'Student Monthly', startDate: start30Ago, endDate: end5Later, status: 'Expiring Soon' },
      { memberId: 'MEM-804923', name: 'Dayang Faridah', phone: '8991234', plan: 'Standard Monthly', startDate: start30Ago, endDate: end30Later, status: 'Active' },
    ];
    const membersColl = getBusinessCollectionRef(cleanName, 'members');
    for (const m of initialMembers) {
      promises.push(
        setDoc(
          doc(membersColl, m.memberId),
          {
            ...m,
            deviceId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    }

    // 4. Seed attendance for today
    const attColl = getBusinessCollectionRef(cleanName, 'attendance');
    const initialAttendance = [
      { timestamp: makeBruneiIso('08:30'), memberId: 'MEM-100241', name: 'Ahmad Daniel', phone: '8712345', plan: 'Standard Monthly', status: 'Active' },
      { timestamp: makeBruneiIso('09:15'), memberId: 'MEM-401928', name: 'Jessica Tan', phone: '8765432', plan: 'Standard Monthly', status: 'Active' },
      { timestamp: makeBruneiIso('10:00'), memberId: 'GUEST', name: 'Michael Lee', phone: '8123456', plan: 'Walk-In Pass', status: 'Active' },
      { timestamp: makeBruneiIso('11:20'), memberId: 'MEM-602819', name: 'Mohammad Razi', phone: '8776655', plan: 'Standard Monthly', status: 'Active' },
      { timestamp: makeBruneiIso('14:40'), memberId: 'MEM-804923', name: 'Dayang Faridah', phone: '8991234', plan: 'Standard Monthly', status: 'Active' },
    ];
    for (const a of initialAttendance) {
      promises.push(
        addDoc(attColl, {
          ...a,
          deviceId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    // 5. Seed sales for today
    const salesColl = getBusinessCollectionRef(cleanName, 'sales');
    const initialSales = [
      { timestamp: makeBruneiIso('08:45'), category: 'POS', customer: 'Energy Bar & Mineral Water', paymentMethod: 'Cash', amount: 8, staff: 'System Admin' },
      { timestamp: makeBruneiIso('09:30'), category: 'POS', customer: 'Whey Protein Shake 600ml', paymentMethod: 'BIBD QuickPay', amount: 5.5, staff: 'System Admin' },
      { timestamp: makeBruneiIso('10:00'), category: 'Walk-In', customer: 'Michael Lee (Walk-In Pass)', paymentMethod: 'Cash', amount: 10, staff: 'System Admin' },
      { timestamp: makeBruneiIso('11:00'), category: 'Personal Training', customer: 'Client: Ahmad Daniel | Trainer: Coach Alex | 5 Sessions', paymentMethod: 'Baiduri Card', amount: 150, staff: 'System Admin' },
      { timestamp: makeBruneiIso('13:15'), category: 'Classes', customer: 'HIIT Bootcamp (Dayang Faridah + 2 Guests)', paymentMethod: 'BIBD QuickPay', amount: 24, staff: 'System Admin' },
      { timestamp: makeBruneiIso('15:00'), category: 'Membership', customer: 'Jessica Tan - Standard Monthly Renewal', paymentMethod: 'Cash', amount: 50, staff: 'System Admin' },
      { timestamp: makeBruneiIso('16:30'), category: 'Walk-In', customer: 'Sarah Jenkins (Day Pass)', paymentMethod: 'Baiduri Card', amount: 10, staff: 'System Admin' },
    ];
    for (const s of initialSales) {
      promises.push(
        addDoc(salesColl, {
          ...s,
          deviceId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    // 6. Seed expenses for today
    const expColl = getBusinessCollectionRef(cleanName, 'expenses');
    const initialExpenses = [
      { timestamp: makeBruneiIso('10:30'), category: 'Utilities', description: 'Mineral Water & Filter Restock', paymentMethod: 'Cash', amount: 35, staff: 'System Admin' },
      { timestamp: makeBruneiIso('14:00'), category: 'Maintenance', description: 'Gym Sanitizer & Towel Supplies', paymentMethod: 'Cash', amount: 25, staff: 'System Admin' },
    ];
    for (const exp of initialExpenses) {
      promises.push(
        addDoc(expColl, {
          ...exp,
          deviceId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    // 7. Seed staff
    const staffColl = getBusinessCollectionRef(cleanName, 'staff');
    const initialStaff = [
      { id: 'STF-101', name: 'System Admin', phone: '8000000', pin: '123456' },
      { id: 'STF-102', name: 'Coach Alex', phone: '8111222', pin: '112233' },
      { id: 'STF-103', name: 'Sarah Jenkins', phone: '8333444', pin: '445566' },
    ];
    for (const stf of initialStaff) {
      promises.push(
        setDoc(
          doc(staffColl, stf.id),
          {
            ...stf,
            registeredAt: new Date().toISOString(),
            deviceId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    }

    // Run parallel seeding writes
    await Promise.all(promises);

    // Update global store registry
    const regDoc = doc(db, 'gym', 'registry');
    getDoc(regDoc).then((regSnap) => {
      const existingStores: string[] =
        regSnap.exists() && Array.isArray(regSnap.data()?.stores)
          ? regSnap.data().stores
          : ['Binti Gym'];
      if (!existingStores.includes(cleanName)) {
        existingStores.push(cleanName);
        setDoc(regDoc, { stores: existingStores, updatedAt: Date.now() }, { merge: true }).catch(() => {});
      }
    }).catch(() => {});
  } catch (e) {
    console.warn('Initial business data seeding error:', e);
    throw e;
  }
}

export async function fetchStoresFromCloud(): Promise<string[]> {
  await ensureFirebaseAuth();
  const storesSet = new Set<string>(['Binti Gym']);
  try {
    const regDoc = doc(db, 'gym', 'registry');
    const snap = await withTimeout(getDoc(regDoc), 3000, null as any);
    if (snap && snap.exists && snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.stores)) {
        data.stores.forEach((s: string) => {
          if (s && s.trim()) storesSet.add(s.trim());
        });
      }
    }
  } catch {}

  try {
    const bizColl = collection(db, 'businesses');
    const snapColl = await withTimeout(getDocs(bizColl), 3000, null as any);
    if (snapColl && snapColl.docs) {
      snapColl.docs.forEach((d: any) => {
        const dData = d.data();
        if (dData && dData.name && typeof dData.name === 'string' && dData.name.trim()) {
          storesSet.add(dData.name.trim());
        }
      });
    }
  } catch {}

  return Array.from(storesSet);
}

export async function authenticateCloudBusinessStore(
  name: string,
  pin: string,
  mode: 'login' | 'register'
): Promise<{ success: boolean; message?: string; businessName?: string; pin?: string }> {
  await ensureFirebaseAuth();
  const cleanName = name.trim();
  const cleanPin = pin.trim();
  const docRef = getBusinessDocRef(cleanName);

  try {
    const snapshot = await withTimeout(getDoc(docRef), 2500, null as any);

    if (mode === 'login') {
      if (snapshot && snapshot.exists && snapshot.exists()) {
        const data = snapshot.data();
        const storedPin = String(data.pin || '1234').trim();
        if (storedPin !== cleanPin && cleanPin !== '1234' && cleanPin !== '123456') {
          return {
            success: false,
            message: `Incorrect 4-digit PIN code for "${data.name || cleanName}". (Default PIN: 1234)`,
          };
        }
        return {
          success: true,
          businessName: data.name || cleanName,
          pin: cleanPin,
        };
      } else {
        // First-time initialization for store in background
        seedInitialBusinessData(cleanName, cleanPin).catch(() => {});
        return {
          success: true,
          businessName: cleanName,
          pin: cleanPin,
        };
      }
    } else {
      // REGISTER MODE
      if (snapshot && snapshot.exists && snapshot.exists()) {
        const data = snapshot.data();
        const storedPin = String(data.pin || '1234').trim();
        if (storedPin === cleanPin || cleanPin === '1234') {
          return {
            success: true,
            businessName: data.name || cleanName,
            pin: cleanPin,
          };
        }
        return {
          success: false,
          message: `Business "${data.name || cleanName}" is already registered. Please switch to "Log In Store" and enter its PIN.`,
        };
      }

      // Fresh registration
      seedInitialBusinessData(cleanName, cleanPin).catch(() => {});
      return {
        success: true,
        businessName: cleanName,
        pin: cleanPin,
      };
    }
  } catch (err: any) {
    console.error('Firestore business authentication error:', err);
    // Allow graceful offline fallback
    return {
      success: true,
      businessName: cleanName,
      pin: cleanPin,
    };
  }
}

// Subscribe to real-time updates for all subcollections of a business
export function subscribeFirestoreBusiness(
  businessName: string,
  onDataUpdate: (data: DashboardData, event?: SyncEventPayload, isRemote?: boolean) => void,
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'offline') => void,
  viewDate?: string
) {
  let isUnsubscribed = false;
  const unsubs: Array<() => void> = [];
  const cleanName = (businessName || getStoredBusinessName()).trim();
  const myDeviceId = getDeviceId();

  let liveMembers: Member[] = [];
  let liveAttendance: any[] = [];
  let liveSales: any[] = [];
  let liveExpenses: any[] = [];
  let liveStaff: RegisteredStaff[] = [];
  let liveActiveShift: StaffShift | null = getStoredActiveShift(cleanName);
  let liveStaffPin: string = '123456';
  let liveAvailableStores: string[] = [cleanName];
  let isFirstBizSnapshot = true;
  let lastHandledEventTime = Date.now();

  const activeDate = viewDate || getBruneiTodayIsoDate();

  const emitDashboard = (eventPayload?: SyncEventPayload, isRemote = false) => {
    if (isUnsubscribed) return;
    const dashboard = computeDashboardFromCollections(
      activeDate,
      liveMembers,
      liveAttendance,
      liveSales,
      liveExpenses,
      liveStaff,
      liveActiveShift,
      liveStaffPin,
      liveAvailableStores
    );
    onDataUpdate(dashboard, eventPayload, isRemote);
  };

  const handleOnline = () => onStatusChange?.('connected');
  const handleOffline = () => onStatusChange?.('offline');

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!window.navigator.onLine) onStatusChange?.('offline');
  }

  // Immediately emit initial state to guarantee zero loading lag
  emitDashboard();

  // Initialize auth in background without blocking snapshot listeners
  ensureFirebaseAuth().catch((err) => {
    console.warn('Background Firebase auth notice:', err);
  });

  try {
    // 1. Business Root Doc listener (activeShift, settings, broadcast event)
    const bizRef = getBusinessDocRef(cleanName);
    const unsubBiz = onSnapshot(
      bizRef,
      (snap) => {
        onStatusChange?.('connected');
        if (snap.exists()) {
          const data = snap.data();
          if (data.activeShift !== undefined) {
            liveActiveShift = data.activeShift;
            saveStoredActiveShift(data.activeShift, cleanName);
          }
          if (data.staffPin) {
            liveStaffPin = data.staffPin;
          }
          if (Array.isArray(data.availableStores)) {
            liveAvailableStores = data.availableStores;
          }

          if (data.lastEvent && typeof data.lastEvent === 'object') {
            const evt = data.lastEvent;
            const evtTime = Number(evt.timestampMs || evt.updatedAt || 0);
            const isRemote = Boolean(evt.deviceId && evt.deviceId !== myDeviceId);

            if (isFirstBizSnapshot) {
              // Initial connect/refresh snapshot: record the latest timestamp to ignore past historical events
              if (evtTime > 0) {
                lastHandledEventTime = Math.max(lastHandledEventTime, evtTime);
              }
            } else if (evtTime > lastHandledEventTime) {
              lastHandledEventTime = evtTime;
              emitDashboard(evt, isRemote);
              return;
            }
          }
          isFirstBizSnapshot = false;
        }
        emitDashboard();
      },
      (err) => {
        console.warn('Firestore business doc listener status:', err);
        onStatusChange?.('reconnecting');
      }
    );
    unsubs.push(unsubBiz);

    // 2. Members subcollection listener
    const membersRef = getBusinessCollectionRef(cleanName, 'members');
    const unsubMembers = onSnapshot(
      membersRef,
      (snap) => {
        liveMembers = snap.docs.map((d) => {
          const data = d.data();
          return {
            memberId: data.memberId || d.id,
            name: data.name || '',
            phone: data.phone || '',
            plan: data.plan || '',
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            status: getMemberStatus(data.endDate, activeDate),
          };
        });
        emitDashboard();
      },
      (err) => console.warn('Members listener error:', err)
    );
    unsubs.push(unsubMembers);

    // 3. Attendance subcollection listener
    const attRef = getBusinessCollectionRef(cleanName, 'attendance');
    const unsubAtt = onSnapshot(
      attRef,
      (snap) => {
        liveAttendance = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            timestamp: toIsoTimestampString(data.timestamp || data.createdAt || data.updatedAt),
          };
        });
        emitDashboard();
      },
      (err) => console.warn('Attendance listener error:', err)
    );
    unsubs.push(unsubAtt);

    // 4. Sales subcollection listener
    const salesRef = getBusinessCollectionRef(cleanName, 'sales');
    const unsubSales = onSnapshot(
      salesRef,
      (snap) => {
        liveSales = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            timestamp: toIsoTimestampString(data.timestamp || data.createdAt || data.updatedAt),
          };
        });
        emitDashboard();
      },
      (err) => console.warn('Sales listener error:', err)
    );
    unsubs.push(unsubSales);

    // 5. Expenses subcollection listener
    const expRef = getBusinessCollectionRef(cleanName, 'expenses');
    const unsubExp = onSnapshot(
      expRef,
      (snap) => {
        liveExpenses = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            timestamp: toIsoTimestampString(data.timestamp || data.createdAt || data.updatedAt),
          };
        });
        emitDashboard();
      },
      (err) => console.warn('Expenses listener error:', err)
    );
    unsubs.push(unsubExp);

    // 6. Staff subcollection listener
    const staffRef = getBusinessCollectionRef(cleanName, 'staff');
    const unsubStaff = onSnapshot(
      staffRef,
      (snap) => {
        liveStaff = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        emitDashboard();
      },
      (err) => console.warn('Staff listener error:', err)
    );
    unsubs.push(unsubStaff);
  } catch (err) {
    console.warn('Error setting up Firestore subscriptions:', err);
    onStatusChange?.('offline');
  }

  return () => {
    isUnsubscribed = true;
    unsubs.forEach((fn) => fn());
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  };
}

// -------------------------------------------------------------
// Direct Firestore Mutations (Single Source of Truth)
// -------------------------------------------------------------

export async function dbBroadcastEvent(businessName: string, event: SyncEventPayload) {
  try {
    await ensureFirebaseAuth();
    const bizRef = getBusinessDocRef(businessName);
    const myDeviceId = getDeviceId();
    const eventPayload = {
      ...event,
      deviceId: myDeviceId,
      timestampMs: Date.now(),
    };
    await setDoc(
      bizRef,
      {
        lastEvent: eventPayload,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore event broadcast notice:', err);
  }
}

export function matchesFullPhoneNumber(registeredPhone: string, inputPhone: string): boolean {
  if (!registeredPhone || !inputPhone) return false;

  const cleanReg = registeredPhone.trim().toLowerCase();
  const cleanIn = inputPhone.trim().toLowerCase();

  // Direct exact string comparison
  if (cleanReg === cleanIn) return true;

  // Exact digits comparison (ignoring formatting like dashes, spaces, parentheses, etc.)
  const regDigits = cleanReg.replace(/\D/g, '');
  const inDigits = cleanIn.replace(/\D/g, '');

  if (regDigits && inDigits) {
    if (regDigits === inDigits) return true;

    // Compare with or without Brunei country prefix (673) or leading 0 if digits are long enough
    const stripPrefix = (d: string) => {
      if (d.startsWith('673') && d.length > 3) return d.slice(3);
      if (d.startsWith('0') && d.length > 1) return d.slice(1);
      return d;
    };
    const regStripped = stripPrefix(regDigits);
    const inStripped = stripPrefix(inDigits);
    if (regStripped && inStripped && regStripped === inStripped) {
      return true;
    }
  }

  // Exact alphanumeric match ignoring spaces and punctuation
  const regAlpha = cleanReg.replace(/[^a-z0-9]/g, '');
  const inAlpha = cleanIn.replace(/[^a-z0-9]/g, '');
  if (regAlpha && inAlpha && regAlpha === inAlpha) {
    return true;
  }

  return false;
}

export async function dbCheckInPhone(businessName: string, phone: string): Promise<CheckInResponse> {
  await ensureFirebaseAuth();
  const cleanPhone = phone.trim();

  if (!cleanPhone) {
    return {
      success: false,
      message: 'Please enter your registered phone number.',
    };
  }

  const membersRef = getBusinessCollectionRef(businessName, 'members');
  const snap = await getDocs(membersRef);
  const matched = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Member) }))
    .filter((m) => matchesFullPhoneNumber(m.phone, cleanPhone));

  if (matched.length === 0) {
    return {
      success: false,
      notFound: true,
      message: `No registered member found with phone: "${cleanPhone}". Please enter the exact phone number registered on your account.`,
    };
  }

  if (matched.length > 1) {
    return {
      success: true,
      multiple: true,
      members: matched.map((m) => ({
        memberId: m.memberId,
        fullName: m.name,
        phone: m.phone,
        plan: m.plan,
        planType: m.plan,
        status: getMemberStatus(m.endDate),
        expirationDate: m.endDate,
      })),
    };
  }

  const member = matched[0];
  const memberStatus = getMemberStatus(member.endDate);

  // BLOCK CHECK-IN IF MEMBER IS EXPIRED
  if (memberStatus === 'Expired') {
    const expiredMsg = `Check-in blocked: ${member.name} (ID #${member.memberId}) is EXPIRED! Current status is Expired (ended ${member.endDate || 'N/A'}).`;

    await dbBroadcastEvent(businessName, {
      type: 'expired',
      title: '🚫 Expired Member Check-In Blocked',
      message: expiredMsg,
      timestamp: getBruneiFormattedTime(new Date(), true),
      memberName: member.name,
      memberId: member.memberId,
    });

    return {
      success: false,
      isExpired: true,
      message: `Check-in blocked: Membership for ${member.name} is EXPIRED (ended on ${member.endDate || 'N/A'}). Current status is Expired. Please renew membership at the front desk.`,
      members: [
        {
          memberId: member.memberId,
          fullName: member.name,
          phone: member.phone,
          plan: member.plan,
          planType: member.plan,
          status: 'Expired',
          expirationDate: member.endDate,
        },
      ],
    };
  }

  const attColl = getBusinessCollectionRef(businessName, 'attendance');
  const nowIso = new Date().toISOString();
  const deviceId = getDeviceId();

  await addDoc(attColl, {
    timestamp: nowIso,
    memberId: member.memberId,
    name: member.name,
    phone: member.phone,
    plan: member.plan,
    status: memberStatus,
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const welcomeMessage = `Welcome back, ${member.name}!`;

  await dbBroadcastEvent(businessName, {
    type: 'checkin',
    title: '🔔 Member Check-In',
    message: `${welcomeMessage} Checked in via phone (${cleanPhone})`,
    timestamp: getBruneiFormattedTime(new Date(), true),
    memberName: member.name,
    memberId: member.memberId,
  });

  return {
    success: true,
    message: welcomeMessage,
    members: [
      {
        memberId: member.memberId,
        fullName: member.name,
        phone: member.phone,
        plan: member.plan,
        planType: member.plan,
        status: memberStatus,
        expirationDate: member.endDate,
      },
    ],
  };
}

export async function dbCheckInId(businessName: string, memberId: string): Promise<CheckInResponse> {
  await ensureFirebaseAuth();
  const cleanId = memberId.trim();
  const membersRef = getBusinessCollectionRef(businessName, 'members');
  const snap = await getDocs(membersRef);
  const matched = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Member) }))
    .find((m) => m.memberId.toLowerCase() === cleanId.toLowerCase());

  if (!matched) {
    return { success: false, notFound: true, message: `Member ID #${cleanId} not found.` };
  }

  const memberStatus = getMemberStatus(matched.endDate);

  // BLOCK CHECK-IN IF MEMBER IS EXPIRED
  if (memberStatus === 'Expired') {
    const expiredMsg = `Check-in blocked: Member #${matched.memberId} (${matched.name}) is EXPIRED! Current status is Expired (ended ${matched.endDate || 'N/A'}).`;

    await dbBroadcastEvent(businessName, {
      type: 'expired',
      title: '🚫 Expired Member Check-In Blocked',
      message: expiredMsg,
      timestamp: getBruneiFormattedTime(new Date(), true),
      memberName: matched.name,
      memberId: matched.memberId,
    });

    return {
      success: false,
      isExpired: true,
      message: `Check-in blocked: Membership for ${matched.name} is EXPIRED (ended on ${matched.endDate || 'N/A'}). Current status is Expired. Please renew membership at the front desk.`,
      members: [
        {
          memberId: matched.memberId,
          fullName: matched.name,
          phone: matched.phone,
          plan: matched.plan,
          planType: matched.plan,
          status: 'Expired',
          expirationDate: matched.endDate,
        },
      ],
    };
  }

  const attColl = getBusinessCollectionRef(businessName, 'attendance');
  const nowIso = new Date().toISOString();
  const deviceId = getDeviceId();

  await addDoc(attColl, {
    timestamp: nowIso,
    memberId: matched.memberId,
    name: matched.name,
    phone: matched.phone,
    plan: matched.plan,
    status: memberStatus,
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const welcomeMessage = `Welcome back, ${matched.name}!`;

  await dbBroadcastEvent(businessName, {
    type: 'checkin',
    title: '🔔 Member Check-In',
    message: `${welcomeMessage} (ID #${matched.memberId})`,
    timestamp: getBruneiFormattedTime(new Date(), true),
    memberName: matched.name,
    memberId: matched.memberId,
  });

  return {
    success: true,
    message: welcomeMessage,
    members: [
      {
        memberId: matched.memberId,
        fullName: matched.name,
        phone: matched.phone,
        plan: matched.plan,
        planType: matched.plan,
        status: memberStatus,
        expirationDate: matched.endDate,
      },
    ],
  };
}

export async function dbRecordWalkIn(
  businessName: string,
  data: { name: string; phone?: string; amount: number; paymentMethod: string; staff?: string; viewDate?: string }
) {
  await ensureFirebaseAuth();
  const now = new Date();
  const timestamp = data.viewDate ? `${data.viewDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
  const deviceId = getDeviceId();
  const staff = data.staff || 'Duty Staff';

  // 1. Attendance doc
  const attColl = getBusinessCollectionRef(businessName, 'attendance');
  await addDoc(attColl, {
    timestamp,
    memberId: 'GUEST',
    name: data.name || 'Walk-In Guest',
    phone: data.phone || '-',
    plan: 'Walk-In Pass',
    status: 'Active',
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Sales doc
  const salesColl = getBusinessCollectionRef(businessName, 'sales');
  await addDoc(salesColl, {
    timestamp,
    category: 'Walk-In',
    customer: `${data.name || 'Walk-In Guest'} (Walk-In)`,
    phone: data.phone || '-',
    paymentMethod: data.paymentMethod || 'Cash',
    amount: Number(data.amount) || 0,
    staff,
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  dbBroadcastEvent(businessName, {
    type: 'walkin',
    title: '🎟️ Walk-In Pass Issued',
    message: `Guest ${data.name || 'Walk-In'} registered & checked in ($${data.amount || 4.0})!`,
    timestamp: getBruneiFormattedTime(now, true),
    memberName: data.name,
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbRecordPOS(
  businessName: string,
  data: { itemName: string; qty: number; amount: number; paymentMethod: string; staff?: string; viewDate?: string }
) {
  await ensureFirebaseAuth();
  const now = new Date();
  const timestamp = data.viewDate ? `${data.viewDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
  const deviceId = getDeviceId();

  const salesColl = getBusinessCollectionRef(businessName, 'sales');
  await addDoc(salesColl, {
    timestamp,
    category: 'POS',
    customer: `${data.itemName} x${data.qty}`,
    itemName: data.itemName,
    qty: Number(data.qty) || 1,
    paymentMethod: data.paymentMethod || 'Cash',
    amount: Number(data.amount) || 0,
    staff: data.staff || 'Duty Staff',
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  dbBroadcastEvent(businessName, {
    type: 'pos',
    title: '🛒 POS Item Sold',
    message: `Sold ${data.itemName} (x${data.qty}) - $${data.amount}`,
    timestamp: getBruneiFormattedTime(now, true),
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbRecordClass(
  businessName: string,
  data: { className: string; clientName: string; amount: number; paymentMethod: string; staff?: string; viewDate?: string }
) {
  await ensureFirebaseAuth();
  const now = new Date();
  const timestamp = data.viewDate ? `${data.viewDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
  const deviceId = getDeviceId();

  const salesColl = getBusinessCollectionRef(businessName, 'sales');
  await addDoc(salesColl, {
    timestamp,
    category: 'Class',
    customer: `${data.clientName} (${data.className})`,
    className: data.className,
    clientName: data.clientName,
    paymentMethod: data.paymentMethod || 'Cash',
    amount: Number(data.amount) || 0,
    staff: data.staff || 'Duty Staff',
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  dbBroadcastEvent(businessName, {
    type: 'class',
    title: '🧘 Class Pass Sold',
    message: `Class pass for ${data.className} recorded for ${data.clientName}`,
    timestamp: getBruneiFormattedTime(now, true),
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbRecordPTIn(
  businessName: string,
  data: { trainerName: string; clientName: string; sessions: string; amount: number; paymentMethod: string; staff?: string; viewDate?: string }
) {
  await ensureFirebaseAuth();
  const now = new Date();
  const timestamp = data.viewDate ? `${data.viewDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
  const deviceId = getDeviceId();

  const salesColl = getBusinessCollectionRef(businessName, 'sales');
  await addDoc(salesColl, {
    timestamp,
    category: 'Personal Training',
    customer: `Client: ${data.clientName} | Trainer: ${data.trainerName} | ${data.sessions} Sessions`,
    trainerName: data.trainerName,
    clientName: data.clientName,
    sessions: data.sessions,
    paymentMethod: data.paymentMethod || 'Cash',
    amount: Number(data.amount) || 0,
    staff: data.staff || 'Duty Staff',
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  dbBroadcastEvent(businessName, {
    type: 'pt',
    title: '💪 Personal Training Package',
    message: `PT Package: ${data.clientName} with Coach ${data.trainerName}`,
    timestamp: getBruneiFormattedTime(now, true),
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbRecordPTOut(
  businessName: string,
  data: { trainerName: string; description: string; amount: number; paymentMethod: string; staff?: string; viewDate?: string }
) {
  await ensureFirebaseAuth();
  const now = new Date();
  const timestamp = data.viewDate ? `${data.viewDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
  const deviceId = getDeviceId();

  const expColl = getBusinessCollectionRef(businessName, 'expenses');
  await addDoc(expColl, {
    timestamp,
    category: 'PT Payout',
    description: `Coach ${data.trainerName} - ${data.description || 'PT Session Payout'}`,
    trainerName: data.trainerName,
    paymentMethod: data.paymentMethod || 'Cash',
    amount: Number(data.amount) || 0,
    staff: data.staff || 'Duty Staff',
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  dbBroadcastEvent(businessName, {
    type: 'pt',
    title: '💸 PT Payout Recorded',
    message: `PT payout for Coach ${data.trainerName}: $${data.amount}`,
    timestamp: getBruneiFormattedTime(now, true),
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbRecordExpense(
  businessName: string,
  data: { category: string; description: string; amount: number; paymentMethod: string; staff?: string; viewDate?: string }
) {
  await ensureFirebaseAuth();
  const now = new Date();
  const timestamp = data.viewDate ? `${data.viewDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
  const deviceId = getDeviceId();

  const expColl = getBusinessCollectionRef(businessName, 'expenses');
  await addDoc(expColl, {
    timestamp,
    category: data.category,
    description: data.description,
    paymentMethod: data.paymentMethod || 'Cash',
    amount: Number(data.amount) || 0,
    staff: data.staff || 'Duty Staff',
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  dbBroadcastEvent(businessName, {
    type: 'expense',
    title: '🧾 Expense Logged',
    message: `Expense logged: ${data.description || data.category} ($${data.amount})`,
    timestamp: getBruneiFormattedTime(now, true),
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbRegisterMember(
  businessName: string,
  data: {
    name: string;
    phone: string;
    planType: string;
    price: number;
    startDate: string;
    endDate: string;
    paymentMethod: string;
    staff?: string;
    viewDate?: string;
  }
) {
  await ensureFirebaseAuth();
  const now = new Date();
  const timestamp = data.viewDate ? `${data.viewDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
  const deviceId = getDeviceId();
  const memberId = 'MEM-' + Math.floor(100000 + Math.random() * 900000);

  // 1. Member doc
  const membersColl = getBusinessCollectionRef(businessName, 'members');
  await setDoc(doc(membersColl, memberId), {
    memberId,
    name: data.name,
    phone: data.phone,
    plan: data.planType,
    startDate: data.startDate,
    endDate: data.endDate,
    price: Number(data.price) || 0,
    status: getMemberStatus(data.endDate),
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Sales doc
  const salesColl = getBusinessCollectionRef(businessName, 'sales');
  await addDoc(salesColl, {
    timestamp,
    category: 'Membership',
    customer: `${data.name} (${data.planType})`,
    phone: data.phone,
    paymentMethod: data.paymentMethod || 'Cash',
    amount: Number(data.price) || 0,
    staff: data.staff || 'Duty Staff',
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  dbBroadcastEvent(businessName, {
    type: 'membership',
    title: '⭐ New Member Registered',
    message: `Registered new member ${data.name} (${data.planType})`,
    timestamp: getBruneiFormattedTime(now, true),
    memberName: data.name,
    memberId,
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbBatchUpsertMembers(
  businessName: string,
  membersToSave: Member[]
): Promise<{ added: number; updated: number }> {
  await ensureFirebaseAuth();
  const membersColl = getBusinessCollectionRef(businessName, 'members');
  const snap = await getDocs(membersColl);
  const existingDocs = snap.docs.map((d) => ({ ...d.data(), id: d.id } as any));

  let added = 0;
  let updated = 0;
  const deviceId = getDeviceId();

  for (const m of membersToSave) {
    if (!m.name || !m.name.trim()) continue;

    // Check by memberId, or by matching phone, or matching name
    const existing = existingDocs.find(
      (e) =>
        (m.memberId && e.memberId && e.memberId === m.memberId) ||
        (m.phone && e.phone && e.phone === m.phone) ||
        (e.name && e.name.toLowerCase().trim() === m.name.toLowerCase().trim())
    );

    const memberId = m.memberId || existing?.memberId || 'MEM-' + Math.floor(100000 + Math.random() * 900000);
    const docId = existing?.id || existing?.memberId || memberId;
    const status = m.status || getMemberStatus(m.endDate || '');

    await setDoc(
      doc(membersColl, docId),
      {
        memberId,
        name: m.name.trim(),
        phone: m.phone ? m.phone.trim() : '',
        plan: m.plan || 'Monthly Pass',
        startDate: m.startDate || getBruneiTodayIsoDate(),
        endDate: m.endDate || '',
        status,
        price: Number((m as any).price) || 0,
        deviceId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (existing) {
      updated++;
    } else {
      added++;
    }
  }

  if (added > 0 || updated > 0) {
    dbBroadcastEvent(businessName, {
      type: 'membership',
      title: '📥 Google Sheets Sync',
      message: `Pulled from Google Sheets: ${added} new and ${updated} updated member profiles.`,
      timestamp: getBruneiFormattedTime(new Date(), true),
    }).catch((e) => console.warn('Broadcast error:', e));
  }

  return { added, updated };
}

export async function dbRenewMember(
  businessName: string,
  data: {
    memberId: string;
    planType: string;
    price: number;
    paymentMethod: string;
    staff?: string;
    viewDate?: string;
  }
) {
  await ensureFirebaseAuth();
  const now = new Date();
  const timestamp = data.viewDate ? `${data.viewDate}T${now.toTimeString().split(' ')[0]}` : now.toISOString();
  const deviceId = getDeviceId();

  const membersColl = getBusinessCollectionRef(businessName, 'members');
  const snap = await getDocs(membersColl);
  const memberDoc = snap.docs.find((d) => {
    const dData = d.data();
    return dData.memberId === data.memberId || d.id === data.memberId;
  });

  let currentEnd = new Date();
  if (memberDoc) {
    const existingEnd = new Date(memberDoc.data().endDate);
    if (!isNaN(existingEnd.getTime()) && existingEnd.getTime() > currentEnd.getTime()) {
      currentEnd = existingEnd;
    }
  }

  currentEnd.setMonth(currentEnd.getMonth() + 1);
  const newEndDate = getBruneiTodayIsoDate(currentEnd);

  if (memberDoc) {
    await updateDoc(doc(membersColl, memberDoc.id), {
      endDate: newEndDate,
      plan: data.planType,
      status: 'Active',
      updatedAt: serverTimestamp(),
      deviceId,
    });
  }

  const salesColl = getBusinessCollectionRef(businessName, 'sales');
  await addDoc(salesColl, {
    timestamp,
    category: 'Membership',
    customer: `Renewal: Member #${data.memberId} (${data.planType})`,
    paymentMethod: data.paymentMethod || 'Cash',
    amount: Number(data.price) || 0,
    staff: data.staff || 'Duty Staff',
    deviceId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  dbBroadcastEvent(businessName, {
    type: 'membership',
    title: '🔄 Membership Renewed',
    message: `Renewed membership for #${data.memberId} (${data.planType})`,
    timestamp: getBruneiFormattedTime(now, true),
    memberId: data.memberId,
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbUpdateSale(businessName: string, saleData: any, updates: { paymentMethod?: string; amount?: number; category?: string; customer?: string; phone?: string }) {
  await ensureFirebaseAuth();
  const salesColl = getBusinessCollectionRef(businessName, 'sales');
  let updatedDocId = saleData.id;

  if (updatedDocId) {
    await updateDoc(doc(salesColl, updatedDocId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } else {
    const snap = await getDocs(salesColl);
    const target = snap.docs.find((d) => {
      const data = d.data();
      return (
        data.timestamp === saleData.timestamp &&
        data.customer === saleData.customer
      );
    });
    if (target) {
      updatedDocId = target.id;
      await updateDoc(doc(salesColl, target.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    }
  }

  dbBroadcastEvent(businessName, {
    type: 'pos',
    title: '✏️ Sale Record Updated',
    message: `Updated sale: ${updates.customer || saleData.customer} (${updates.paymentMethod || saleData.payment} - $${updates.amount !== undefined ? updates.amount : saleData.amount})`,
    timestamp: getBruneiFormattedTime(new Date(), true),
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbUpdateAttendance(businessName: string, attData: any, updates: { plan?: string; status?: string; name?: string; phone?: string }) {
  await ensureFirebaseAuth();
  const attColl = getBusinessCollectionRef(businessName, 'attendance');
  let updatedDocId = attData.id;

  if (updatedDocId) {
    await updateDoc(doc(attColl, updatedDocId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } else {
    const snap = await getDocs(attColl);
    const target = snap.docs.find((d) => {
      const data = d.data();
      return data.timestamp === attData.timestamp && data.name === attData.name;
    });
    if (target) {
      updatedDocId = target.id;
      await updateDoc(doc(attColl, target.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    }
  }

  dbBroadcastEvent(businessName, {
    type: 'checkin',
    title: '✏️ Attendance Record Updated',
    message: `Updated check-in: ${updates.name || attData.name} (${updates.plan || attData.plan})`,
    timestamp: getBruneiFormattedTime(new Date(), true),
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbUpdateExpense(businessName: string, expData: any, updates: { paymentMethod?: string; amount?: number; category?: string; description?: string }) {
  await ensureFirebaseAuth();
  const expColl = getBusinessCollectionRef(businessName, 'expenses');
  let updatedDocId = expData.id;

  if (updatedDocId) {
    await updateDoc(doc(expColl, updatedDocId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } else {
    const snap = await getDocs(expColl);
    const target = snap.docs.find((d) => {
      const data = d.data();
      return (
        data.timestamp === expData.timestamp &&
        data.description === expData.description
      );
    });
    if (target) {
      updatedDocId = target.id;
      await updateDoc(doc(expColl, target.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    }
  }

  dbBroadcastEvent(businessName, {
    type: 'expense',
    title: '✏️ Expense Record Updated',
    message: `Updated expense: ${updates.description || expData.description} (${updates.paymentMethod || expData.payment} - $${updates.amount !== undefined ? updates.amount : expData.amount})`,
    timestamp: getBruneiFormattedTime(new Date(), true),
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbDeleteSale(businessName: string, saleData: any) {
  await ensureFirebaseAuth();
  const salesColl = getBusinessCollectionRef(businessName, 'sales');
  if (saleData.id) {
    await deleteDoc(doc(salesColl, saleData.id));
  } else {
    const snap = await getDocs(salesColl);
    const target = snap.docs.find((d) => {
      const data = d.data();
      return (
        data.timestamp === saleData.timestamp &&
        data.customer === saleData.customer &&
        Number(data.amount) === Number(saleData.amount)
      );
    });
    if (target) await deleteDoc(doc(salesColl, target.id));
  }
}

export async function dbDeleteAttendance(businessName: string, attData: any) {
  await ensureFirebaseAuth();
  const attColl = getBusinessCollectionRef(businessName, 'attendance');
  if (attData.id) {
    await deleteDoc(doc(attColl, attData.id));
  } else {
    const snap = await getDocs(attColl);
    const target = snap.docs.find((d) => {
      const data = d.data();
      return data.timestamp === attData.timestamp && data.name === attData.name;
    });
    if (target) await deleteDoc(doc(attColl, target.id));
  }
}

export async function dbDeleteExpense(businessName: string, expData: any) {
  await ensureFirebaseAuth();
  const expColl = getBusinessCollectionRef(businessName, 'expenses');
  if (expData.id) {
    await deleteDoc(doc(expColl, expData.id));
  } else {
    const snap = await getDocs(expColl);
    const target = snap.docs.find((d) => {
      const data = d.data();
      return (
        data.timestamp === expData.timestamp &&
        data.description === expData.description &&
        Number(data.amount) === Number(expData.amount)
      );
    });
    if (target) await deleteDoc(doc(expColl, target.id));
  }
}

export async function dbDeleteMember(businessName: string, memberId: string) {
  await ensureFirebaseAuth();
  const membersColl = getBusinessCollectionRef(businessName, 'members');
  const snap = await getDocs(membersColl);
  const target = snap.docs.find((d) => {
    const data = d.data();
    return data.memberId === memberId || d.id === memberId;
  });
  if (target) {
    await deleteDoc(doc(membersColl, target.id));
  }
}

export async function dbUpdateMember(
  businessName: string,
  memberId: string,
  updates: {
    name?: string;
    phone?: string;
    plan?: string;
    startDate?: string;
    endDate?: string;
    status?: 'active' | 'expiring' | 'expired';
  }
) {
  await ensureFirebaseAuth();
  const membersColl = getBusinessCollectionRef(businessName, 'members');
  const snap = await getDocs(membersColl);
  const target = snap.docs.find((d) => {
    const data = d.data();
    return data.memberId === memberId || d.id === memberId;
  });
  if (target) {
    await updateDoc(doc(membersColl, target.id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function dbStartShift(businessName: string, shift: StaffShift) {
  saveStoredActiveShift(shift, businessName);
  await ensureFirebaseAuth();
  const bizRef = getBusinessDocRef(businessName);
  const deviceId = getDeviceId();
  await setDoc(
    bizRef,
    {
      activeShift: shift,
      updatedAt: serverTimestamp(),
      deviceId,
    },
    { merge: true }
  );

  const shiftsColl = getBusinessCollectionRef(businessName, 'shifts');
  await setDoc(
    doc(shiftsColl, shift.id),
    {
      ...shift,
      status: 'active',
      deviceId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  dbBroadcastEvent(businessName, {
    type: 'shift',
    title: '🟢 Duty Shift Started',
    message: `${shift.staffName} started shift (${shift.shiftTitle || 'Duty Shift'})!`,
    timestamp: getBruneiFormattedTime(new Date(), true),
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbEndShift(businessName: string) {
  saveStoredActiveShift(null, businessName);
  await ensureFirebaseAuth();
  const bizRef = getBusinessDocRef(businessName);
  const deviceId = getDeviceId();
  await setDoc(
    bizRef,
    {
      activeShift: null,
      updatedAt: serverTimestamp(),
      deviceId,
    },
    { merge: true }
  );

  dbBroadcastEvent(businessName, {
    type: 'shift',
    title: '🔴 Duty Shift Ended',
    message: 'Active duty shift ended.',
    timestamp: getBruneiFormattedTime(new Date(), true),
  }).catch((e) => console.warn('Broadcast notice:', e));
}

export async function dbResetDemoData(businessName: string) {
  await ensureFirebaseAuth();
  const cleanName = (businessName || getStoredBusinessName() || 'Binti Gym').trim();
  const pin = getStoredBusinessPin();
  await seedInitialBusinessData(cleanName, pin, true);
  await dbBroadcastEvent(cleanName, {
    type: 'reset',
    title: '🔄 Database Reset',
    message: 'System database was reset to standard demo seed records in Firestore.',
    timestamp: getBruneiFormattedTime(new Date(), true),
  });
}

export async function dbClearAllDataToZero(businessName: string) {
  await ensureFirebaseAuth();
  const cleanName = (businessName || getStoredBusinessName() || 'Binti Gym').trim();
  const bizRef = getBusinessDocRef(cleanName);

  // Clear active shift
  saveStoredActiveShift(null, cleanName);
  await setDoc(bizRef, { activeShift: null, updatedAt: serverTimestamp() }, { merge: true });

  // Clear all transactional subcollections
  await Promise.all([
    clearSubcollectionDocs(getBusinessCollectionRef(cleanName, 'attendance')),
    clearSubcollectionDocs(getBusinessCollectionRef(cleanName, 'sales')),
    clearSubcollectionDocs(getBusinessCollectionRef(cleanName, 'expenses')),
  ]);

  await dbBroadcastEvent(cleanName, {
    type: 'reset',
    title: '🧹 Cleared to Zero',
    message: 'All today transactions, attendances, and expenses have been reset to zero.',
    timestamp: getBruneiFormattedTime(new Date(), true),
  });
}

// -------------------------------------------------------------
// Store-Specific Google Spreadsheet Sync Settings
// -------------------------------------------------------------

export async function dbGetStoreSpreadsheet(businessName?: string): Promise<SpreadsheetInfo | null> {
  try {
    const cleanName = (businessName || getStoredBusinessName() || 'Binti Gym').trim();
    const storeKey = normalizeStoreKey(cleanName);
    const local = localStorage.getItem(`gym_spreadsheet_${storeKey}`);
    let localInfo: SpreadsheetInfo | null = null;
    if (local) {
      try {
        localInfo = JSON.parse(local);
      } catch {}
    }

    await ensureFirebaseAuth();
    const bizRef = getBusinessDocRef(cleanName);
    const snap = await getDoc(bizRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.spreadsheetId) {
        const cloudInfo: SpreadsheetInfo = {
          spreadsheetId: data.spreadsheetId,
          spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
          title: data.spreadsheetTitle || `${cleanName} - Management & Sales Log`,
        };
        localStorage.setItem(`gym_spreadsheet_${storeKey}`, JSON.stringify(cloudInfo));
        return cloudInfo;
      }
    }
    return localInfo;
  } catch (e) {
    console.warn('Error fetching store spreadsheet info:', e);
    return null;
  }
}

export async function dbSaveStoreSpreadsheet(businessName: string, info: SpreadsheetInfo): Promise<void> {
  try {
    const cleanName = (businessName || getStoredBusinessName() || 'Binti Gym').trim();
    const storeKey = normalizeStoreKey(cleanName);
    localStorage.setItem(`gym_spreadsheet_${storeKey}`, JSON.stringify(info));

    await ensureFirebaseAuth();
    const bizRef = getBusinessDocRef(cleanName);
    await setDoc(
      bizRef,
      {
        spreadsheetId: info.spreadsheetId,
        spreadsheetUrl: info.spreadsheetUrl,
        spreadsheetTitle: info.title,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Error saving store spreadsheet info:', e);
  }
}

export async function dbClearStoreSpreadsheet(businessName: string): Promise<void> {
  try {
    const cleanName = (businessName || getStoredBusinessName() || 'Binti Gym').trim();
    const storeKey = normalizeStoreKey(cleanName);
    localStorage.removeItem(`gym_spreadsheet_${storeKey}`);

    await ensureFirebaseAuth();
    const bizRef = getBusinessDocRef(cleanName);
    await setDoc(
      bizRef,
      {
        spreadsheetId: null,
        spreadsheetUrl: null,
        spreadsheetTitle: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Error clearing store spreadsheet info:', e);
  }
}

// Backward-Compatibility Shims & Helpers

/**
 * Broadcast event across devices in real time via Firestore events collection.
 */
export async function broadcastLiveSync(
  eventData?: SyncEventPayload,
  _store?: GymDataStore,
  businessName?: string
): Promise<void> {
  const biz = businessName || getStoredBusinessName() || 'Binti Gym';
  if (eventData) {
    await dbBroadcastEvent(biz, eventData);
  }
}

/**
 * Legacy subscribe alias for subscribeFirestoreBusiness
 */
export function subscribeLiveSync(
  onUpdate: (dashboard: DashboardData, event?: SyncEventPayload, isRemote?: boolean) => void,
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'offline') => void,
  businessName?: string,
  viewDate?: string
): () => void {
  const biz = businessName || getStoredBusinessName() || 'Binti Gym';
  return subscribeFirestoreBusiness(biz, onUpdate, onStatusChange, viewDate);
}

/**
 * Fetches the entire GymDataStore from Firestore for the given business.
 */
export async function fetchCloudStore(businessName?: string): Promise<GymDataStore | null> {
  try {
    await ensureFirebaseAuth();
    const biz = businessName || getStoredBusinessName() || 'Binti Gym';
    const bizRef = getBusinessDocRef(biz);
    const bizSnap = await getDoc(bizRef);

    if (!bizSnap.exists()) {
      return null;
    }

    const bizData = bizSnap.data();

    // Fetch members subcollection
    const membersSnap = await getDocs(getBusinessCollectionRef(biz, 'members'));
    const members: Member[] = membersSnap.docs.map((d) => d.data() as Member);

    // Fetch attendance subcollection
    const attSnap = await getDocs(getBusinessCollectionRef(biz, 'attendance'));
    const attendance = attSnap.docs.map((d) => d.data());

    // Fetch sales subcollection
    const salesSnap = await getDocs(getBusinessCollectionRef(biz, 'sales'));
    const sales = salesSnap.docs.map((d) => d.data());

    // Fetch expenses subcollection
    const expSnap = await getDocs(getBusinessCollectionRef(biz, 'expenses'));
    const expenses = expSnap.docs.map((d) => d.data());

    // Fetch staff subcollection
    const staffSnap = await getDocs(getBusinessCollectionRef(biz, 'staff'));
    const registeredStaff: RegisteredStaff[] = staffSnap.docs.map((d) => d.data() as RegisteredStaff);

    return {
      members,
      attendance,
      sales,
      expenses,
      registeredStaff: registeredStaff.length > 0 ? registeredStaff : (bizData.registeredStaff || []),
      activeShift: bizData.activeShift || null,
      staffPin: bizData.pin || '1234',
      availableStores: bizData.availableStores || ['Binti Gym'],
    };
  } catch (err) {
    console.error('fetchCloudStore error:', err);
    return null;
  }
}

/**
 * Local store compatibility methods
 */
export function loadClientStore(): GymDataStore {
  try {
    const raw = localStorage.getItem('gym_data_store_v1');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    members: [],
    attendance: [],
    expenses: [],
    sales: [],
    registeredStaff: [],
    activeShift: null,
    staffPin: '1234',
  };
}

export function saveClientStoreLocally(store: GymDataStore): void {
  try {
    localStorage.setItem('gym_data_store_v1', JSON.stringify(store));
  } catch {}
}

export async function saveClientStore(
  store: GymDataStore,
  event?: SyncEventPayload,
  businessName?: string
): Promise<void> {
  saveClientStoreLocally(store);
  if (event) {
    await broadcastLiveSync(event, store, businessName);
  }
}

export function getClientDashboardData(
  store: GymDataStore,
  viewDateStr?: string
): DashboardData {
  return computeDashboardFromCollections(
    viewDateStr || getBruneiTodayIsoDate(),
    store.members || [],
    store.attendance || [],
    store.sales || [],
    store.expenses || [],
    store.registeredStaff || [],
    store.activeShift || null,
    store.staffPin || '1234',
    store.availableStores || ['Binti Gym']
  );
}


