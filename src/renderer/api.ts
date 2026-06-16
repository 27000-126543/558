const { ipcRenderer } = window.require('electron');
import IPC from '../shared/ipcChannels';
import type { ApiResponse, Employee, Driver, Vehicle, Route, Schedule, RideRequest, MaintenanceWorkOrder, SparePart, MaintenanceTeam, DriverAdjustment, MonthlyReport, Alert } from '../shared/types';

async function call<T>(channel: string, ...args: any[]): Promise<T> {
  const result: ApiResponse<T> = await ipcRenderer.invoke(channel, ...args);
  if (!result.success) {
    throw new Error(result.error || result.message || '操作失败');
  }
  return result.data as T;
}

export const employeeApi = {
  getAll: () => call<Employee[]>(IPC.EMPLOYEE.GET_ALL),
  getById: (id: number) => call<Employee | null>(IPC.EMPLOYEE.GET_BY_ID, id),
  create: (data: any) => call<Employee>(IPC.EMPLOYEE.CREATE, data),
  update: (id: number, data: any) => call<Employee>(IPC.EMPLOYEE.UPDATE, id, data),
  remove: (id: number) => call<boolean>(IPC.EMPLOYEE.DELETE, id),
  validate: (id: number, direction: string) => call<{ valid: boolean; reason?: string }>(IPC.EMPLOYEE.VALIDATE, id, direction),
};

export const driverApi = {
  getAll: () => call<Driver[]>(IPC.DRIVER.GET_ALL),
  create: (data: any) => call<Driver>(IPC.DRIVER.CREATE, data),
  update: (id: number, data: any) => call<Driver>(IPC.DRIVER.UPDATE, id, data),
  remove: (id: number) => call<boolean>(IPC.DRIVER.DELETE, id),
};

export const vehicleApi = {
  getAll: () => call<Vehicle[]>(IPC.VEHICLE.GET_ALL),
  create: (data: any) => call<Vehicle>(IPC.VEHICLE.CREATE, data),
  update: (id: number, data: any) => call<Vehicle>(IPC.VEHICLE.UPDATE, id, data),
  updateStatus: (id: number, status: string, mileage?: number) => call<Vehicle>(IPC.VEHICLE.UPDATE_STATUS, id, status, mileage),
  remove: (id: number) => call<boolean>(IPC.VEHICLE.DELETE, id),
};

export const routeApi = {
  getAll: () => call<Route[]>(IPC.ROUTE.GET_ALL),
  getById: (id: number) => call<Route | null>(IPC.ROUTE.GET_BY_ID, id),
  create: (data: any) => call<Route>(IPC.ROUTE.CREATE, data),
  update: (id: number, data: any) => call<Route>(IPC.ROUTE.UPDATE, id, data),
  remove: (id: number) => call<boolean>(IPC.ROUTE.DELETE, id),
};

export const scheduleApi = {
  getAll: () => call<Schedule[]>(IPC.SCHEDULE.GET_ALL),
  getByDate: (date: string) => call<Schedule[]>(IPC.SCHEDULE.GET_BY_DATE, date),
  create: (data: any) => call<Schedule>(IPC.SCHEDULE.CREATE, data),
  update: (id: number, data: any) => call<Schedule>(IPC.SCHEDULE.UPDATE, id, data),
  updateStatus: (id: number, status: string) => call<Schedule>(IPC.SCHEDULE.UPDATE_STATUS, id, status),
  remove: (id: number) => call<boolean>(IPC.SCHEDULE.DELETE, id),
  getPassengers: (id: number) => call<any>(IPC.SCHEDULE.GET_PASSENGERS, id),
  handleDelay: (id: number) => call<any>(IPC.SCHEDULE.HANDLE_DELAY, id),
  confirmPassengers: (id: number) => call<{ confirmed: boolean; confirmedAt: string }>(IPC.SCHEDULE.CONFIRM_PASSENGERS, id),
  recordStationArrival: (sid: number, logId: number, data: any) => call<any>(IPC.SCHEDULE.RECORD_STATION_ARRIVAL, sid, logId, data),
  getStationLogs: (id: number) => call<any[]>(IPC.SCHEDULE.GET_STATION_LOGS, id),
  getStationAffectedPassengers: (sid: number, stid: number) => call<any[]>(IPC.SCHEDULE.GET_STATION_AFFECTED_PASSENGERS, sid, stid),
};

export const rideRequestApi = {
  getAll: () => call<RideRequest[]>(IPC.RIDE_REQUEST.GET_ALL),
  getByEmployee: (id: number) => call<RideRequest[]>(IPC.RIDE_REQUEST.GET_BY_EMPLOYEE, id),
  create: (data: any) => call<any>(IPC.RIDE_REQUEST.CREATE, data),
  update: (id: number, data: any) => call<RideRequest>(IPC.RIDE_REQUEST.UPDATE, id, data),
  cancel: (id: number) => call<any>(IPC.RIDE_REQUEST.CANCEL, id),
  assignSeat: (id: number) => call<RideRequest>(IPC.RIDE_REQUEST.ASSIGN_SEAT, id),
  reschedule: (id: number, data: any) => call<any>(IPC.RIDE_REQUEST.RESCHEDULE, id, data),
  getWaitlist: (routeId?: number, rideDate?: string, direction?: string) => call<any[]>(IPC.RIDE_REQUEST.GET_WAITLIST, routeId, rideDate, direction),
  promoteWaitlist: (scheduleId: number, limit?: number) => call<any>(IPC.RIDE_REQUEST.PROMOTE_WAITLIST, scheduleId, limit),
};

export const maintenanceApi = {
  getAll: () => call<MaintenanceWorkOrder[]>(IPC.MAINTENANCE.GET_ALL),
  create: (data: any) => call<MaintenanceWorkOrder>(IPC.MAINTENANCE.CREATE, data),
  update: (id: number, data: any) => call<MaintenanceWorkOrder>(IPC.MAINTENANCE.UPDATE, id, data),
  complete: (id: number, parts: any[]) => call<MaintenanceWorkOrder>(IPC.MAINTENANCE.COMPLETE, id, parts),
};

export const sparePartApi = {
  getAll: () => call<SparePart[]>(IPC.SPARE_PART.GET_ALL),
  create: (data: any) => call<SparePart>(IPC.SPARE_PART.CREATE, data),
  update: (id: number, data: any) => call<SparePart>(IPC.SPARE_PART.UPDATE, id, data),
  getLowStock: () => call<SparePart[]>(IPC.SPARE_PART.GET_LOW_STOCK),
};

export const teamApi = {
  getAll: () => call<MaintenanceTeam[]>(IPC.MAINTENANCE_TEAM.GET_ALL),
  create: (data: any) => call<MaintenanceTeam>(IPC.MAINTENANCE_TEAM.CREATE, data),
  update: (id: number, data: any) => call<MaintenanceTeam>(IPC.MAINTENANCE_TEAM.UPDATE, id, data),
};

export const adjustmentApi = {
  getAll: () => call<DriverAdjustment[]>(IPC.DRIVER_ADJUSTMENT.GET_ALL),
  create: (data: any) => call<DriverAdjustment>(IPC.DRIVER_ADJUSTMENT.CREATE, data),
  approve: (id: number, approver: string) => call<any>(IPC.DRIVER_ADJUSTMENT.APPROVE, id, approver),
  reject: (id: number, approver: string, reason?: string) => call<any>(IPC.DRIVER_ADJUSTMENT.REJECT, id, approver, reason),
  getById: (id: number) => call<any>(IPC.DRIVER_ADJUSTMENT.GET_BY_ID, id),
};

export const reportApi = {
  generateMonthly: (month: string) => call<MonthlyReport>(IPC.REPORT.GENERATE_MONTHLY, month),
  getHistory: () => call<MonthlyReport[]>(IPC.REPORT.GET_HISTORY),
  exportPdf: (month: string) => call<boolean>(IPC.REPORT.EXPORT_PDF, month),
  getStats: () => call<any>(IPC.REPORT.GET_STATS),
};

export const alertApi = {
  getAll: () => call<Alert[]>(IPC.ALERT.GET_ALL),
  getUnread: () => call<Alert[]>(IPC.ALERT.GET_UNREAD),
  markRead: (id: number) => call<boolean>(IPC.ALERT.MARK_READ, id),
};

export const dashboardApi = {
  getStats: () => call<any>(IPC.DASHBOARD.GET_STATS),
  getRealtimeData: () => call<any>(IPC.DASHBOARD.GET_REALTIME_DATA),
};
