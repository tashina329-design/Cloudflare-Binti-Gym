export interface Member {
  memberId: string;
  name: string;
  phone: string;
  plan: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Expiring Soon' | 'Expired';
}

export interface AttendanceRecord {
  id?: string;
  time: string; // "10:30 AM" or ISO string
  timestamp?: string; // ISO string for filtering
  memberId?: string;
  name: string;
  phone: string;
  plan: string;
  status: string;
}

export interface SalesRecord {
  id?: string;
  time: string;
  timestamp?: string;
  category: string;
  customer: string;
  phone?: string;
  payment: string;
  amount: number;
  staff?: string;
}

export interface ExpenseRecord {
  id?: string;
  time: string;
  timestamp?: string;
  category: string;
  description: string;
  payment: string;
  amount: number;
  staff?: string;
}

export interface PTDetail {
  time: string;
  trainer: string;
  client: string;
  sessions: string;
  amount: number;
}

export interface GymDataStore {
  members: Member[];
  attendance: any[];
  expenses: any[];
  sales: any[];
  registeredStaff?: RegisteredStaff[];
  activeShift?: StaffShift | null;
  staffPin?: string;
  availableStores?: string[];
}

export interface DashboardData {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  posSalesTotal: number;
  classSalesTotal: number;
  ptSalesTotal: number;
  ptPayoutTotal: number;
  walkInSalesTotal: number;
  membershipSalesTotal: number;
  checkinCount: number;
  expiringCount: number;
  todayAttendance: AttendanceRecord[];
  todaySales: SalesRecord[];
  todayExpenses: ExpenseRecord[];
  members: Member[];
  cashIn: number;
  cashOut: number;
  baiduriIn: number;
  bibdIn: number;
  ptDetails: PTDetail[];
  viewDate: string; // YYYY-MM-DD
  store?: GymDataStore;
}

export interface CheckInResponse {
  success: boolean;
  message?: string;
  notFound?: boolean;
  multiple?: boolean;
  isExpired?: boolean;
  members?: MemberMatch[];
}

export interface StaffShift {
  id: string;
  staffName: string;
  shiftTitle: string;
  startTime: string;
  startTimestamp: number;
  startingFloat?: number;
  notes?: string;
}

export interface MemberMatch {
  memberId: string;
  fullName: string;
  phone: string;
  plan: string;
  status: string;
  planType?: string;
  expirationDate?: string;
}

export interface RegisteredStaff {
  id: string;
  name: string;
  phone: string;
  pin: string;
  registeredAt: string;
}

export interface PushNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  memberName?: string;
  memberId?: string;
  type: 'checkin' | 'walkin' | 'expired' | 'blocked' | 'info';
  read?: boolean;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

