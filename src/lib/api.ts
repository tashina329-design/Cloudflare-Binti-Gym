import { DashboardData, Member, StaffShift, RegisteredStaff, CheckInResponse } from '../types';
import {
  BRUNEI_TIMEZONE,
  getBruneiTodayIsoDate,
  getBruneiFormattedTime,
  isSameDate,
  getMemberStatus,
  parsePTCustomer,
  getDeviceId,
  getStoredBusinessName,
  getStoredBusinessPin,
  fetchStoresFromCloud,
  dbCheckInPhone,
  dbCheckInId,
  dbRecordWalkIn,
  dbRecordPOS,
  dbRecordClass,
  dbRecordPTIn,
  dbRecordPTOut,
  dbRecordExpense,
  dbRegisterMember,
  dbRenewMember,
  dbDeleteSale,
  dbDeleteAttendance,
  dbDeleteExpense,
  dbDeleteMember,
  dbStartShift,
  dbEndShift,
  dbResetDemoData,
  dbClearAllDataToZero,
  dbGetStoreSpreadsheet,
  dbSaveStoreSpreadsheet,
  dbClearStoreSpreadsheet,
  broadcastLiveSync,
  subscribeLiveSync,
  fetchCloudStore,
  loadClientStore,
  saveClientStore,
  saveClientStoreLocally,
  getClientDashboardData,
  SyncEventPayload,
  GymDataStore,
} from './firebaseSync';

export {
  BRUNEI_TIMEZONE,
  getBruneiTodayIsoDate,
  getBruneiFormattedTime,
  isSameDate,
  getMemberStatus,
  parsePTCustomer,
  getDeviceId,
  getStoredBusinessName,
  getStoredBusinessPin,
  fetchStoresFromCloud,
  broadcastLiveSync,
  subscribeLiveSync,
  fetchCloudStore,
  loadClientStore,
  saveClientStore,
  saveClientStoreLocally,
  getClientDashboardData,
};

export type { SyncEventPayload, GymDataStore };


export function getBruneiFormattedDate(dateObj?: Date): string {
  const d = dateObj || new Date();
  return d.toLocaleDateString('en-US', {
    timeZone: BRUNEI_TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getBruneiFutureIsoDate(monthsAhead = 1, daysAhead = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  d.setDate(d.getDate() + daysAhead);
  return getBruneiTodayIsoDate(d);
}

export async function fetchAvailableStores(): Promise<string[]> {
  return await fetchStoresFromCloud();
}

/**
 * Universal apiFetch adapter that routes all requests directly to Firestore.
 * Completely eliminates local file persistence (gym_data.json) and competing storage.
 */
export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const cleanUrl = url.split('?')[0];
  const urlParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
  const dateParam = urlParams.get('date') || getBruneiTodayIsoDate();
  const currentStore = getStoredBusinessName();

  let body: any = {};
  if (options?.body) {
    try {
      body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    } catch {
      body = {};
    }
  }

  // Attendance Phone Check-In
  if (cleanUrl.endsWith('/api/checkin/phone')) {
    const res = await dbCheckInPhone(currentStore, body.phone || '');
    return res as unknown as T;
  }

  // Attendance Member ID Check-In
  if (cleanUrl.endsWith('/api/checkin/id')) {
    const res = await dbCheckInId(currentStore, body.memberId || '');
    return res as unknown as T;
  }

  // Walk-In Pass
  if (cleanUrl.endsWith('/api/walkin')) {
    await dbRecordWalkIn(currentStore, {
      name: body.name,
      phone: body.phone,
      amount: Number(body.amount) || 4.0,
      paymentMethod: body.paymentMethod || 'Cash',
      staff: body.staff,
      viewDate: dateParam,
    });
    return { success: true } as unknown as T;
  }

  // POS Item Sale
  if (cleanUrl.endsWith('/api/pos')) {
    await dbRecordPOS(currentStore, {
      itemName: body.itemName,
      qty: Number(body.qty) || 1,
      amount: Number(body.amount) || 0,
      paymentMethod: body.paymentMethod || 'Cash',
      staff: body.staff,
      viewDate: dateParam,
    });
    return { success: true } as unknown as T;
  }

  // Class Pass Sale
  if (cleanUrl.endsWith('/api/class')) {
    await dbRecordClass(currentStore, {
      className: body.className,
      clientName: body.clientName,
      amount: Number(body.amount) || 0,
      paymentMethod: body.paymentMethod || 'Cash',
      staff: body.staff,
      viewDate: dateParam,
    });
    return { success: true } as unknown as T;
  }

  // Personal Training Package (In)
  if (cleanUrl.endsWith('/api/pt/in')) {
    await dbRecordPTIn(currentStore, {
      trainerName: body.trainerName,
      clientName: body.clientName,
      sessions: body.sessions,
      amount: Number(body.amount) || 0,
      paymentMethod: body.paymentMethod || 'Cash',
      staff: body.staff,
      viewDate: dateParam,
    });
    return { success: true } as unknown as T;
  }

  // Personal Training Payout (Out)
  if (cleanUrl.endsWith('/api/pt/out')) {
    await dbRecordPTOut(currentStore, {
      trainerName: body.trainerName,
      description: body.description,
      amount: Number(body.amount) || 0,
      paymentMethod: body.paymentMethod || 'Cash',
      staff: body.staff,
      viewDate: dateParam,
    });
    return { success: true } as unknown as T;
  }

  // Operational Expense
  if (cleanUrl.endsWith('/api/expense')) {
    await dbRecordExpense(currentStore, {
      category: body.category,
      description: body.description,
      amount: Number(body.amount) || 0,
      paymentMethod: body.paymentMethod || 'Cash',
      staff: body.staff,
      viewDate: dateParam,
    });
    return { success: true } as unknown as T;
  }

  // Register New Member
  if (cleanUrl.endsWith('/api/members/register')) {
    await dbRegisterMember(currentStore, {
      name: body.name,
      phone: body.phone,
      planType: body.planType,
      price: Number(body.price) || 0,
      startDate: body.startDate,
      endDate: body.endDate,
      paymentMethod: body.paymentMethod || 'Cash',
      staff: body.staff,
      viewDate: dateParam,
    });
    return { success: true } as unknown as T;
  }

  // Renew Existing Member
  if (cleanUrl.endsWith('/api/members/renew')) {
    await dbRenewMember(currentStore, {
      memberId: body.memberId,
      planType: body.planType,
      price: Number(body.price) || 0,
      paymentMethod: body.paymentMethod || 'Cash',
      staff: body.staff,
      viewDate: dateParam,
    });
    return { success: true } as unknown as T;
  }

  // Delete Sale Record
  if (cleanUrl.endsWith('/api/sales/delete')) {
    await dbDeleteSale(currentStore, body);
    return { success: true } as unknown as T;
  }

  // Delete Attendance Record
  if (cleanUrl.endsWith('/api/attendance/delete')) {
    await dbDeleteAttendance(currentStore, body);
    return { success: true } as unknown as T;
  }

  // Delete Expense Record
  if (cleanUrl.endsWith('/api/expense/delete')) {
    await dbDeleteExpense(currentStore, body);
    return { success: true } as unknown as T;
  }

  // Delete Member
  if (cleanUrl.endsWith('/api/members/delete')) {
    await dbDeleteMember(currentStore, body.memberId);
    return { success: true } as unknown as T;
  }

  // Staff Shift Start
  if (cleanUrl.endsWith('/api/shift/start')) {
    await dbStartShift(currentStore, body);
    return { success: true } as unknown as T;
  }

  // Staff Shift End
  if (cleanUrl.endsWith('/api/shift/end')) {
    await dbEndShift(currentStore);
    return { success: true } as unknown as T;
  }

  // Database Reset to Demo Seed
  if (cleanUrl.endsWith('/api/reset')) {
    await dbResetDemoData(currentStore);
    return { success: true } as unknown as T;
  }

  return { success: true } as unknown as T;
}
