import { BrowserWindow, ipcMain, app } from 'electron';
import * as path from 'path';
import IPC from '../shared/ipcChannels';

import * as employeeService from './services/employeeService';
import * as driverService from './services/driverService';
import * as vehicleService from './services/vehicleService';
import * as routeService from './services/routeService';
import * as scheduleService from './services/scheduleService';
import * as rideRequestService from './services/rideRequestService';
import * as maintenanceService from './services/maintenanceService';
import * as reportService from './services/reportService';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: '企业班车通勤调度与员工乘车管理系统',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  registerIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpcHandlers() {
  ipcMain.handle(IPC.EMPLOYEE.GET_ALL, async () => employeeService.getAllEmployees());
  ipcMain.handle(IPC.EMPLOYEE.GET_BY_ID, async (_e, id: number) => employeeService.getEmployeeById(id));
  ipcMain.handle(IPC.EMPLOYEE.CREATE, async (_e, data: any) => employeeService.createEmployee(data));
  ipcMain.handle(IPC.EMPLOYEE.UPDATE, async (_e, id: number, data: any) => employeeService.updateEmployee(id, data));
  ipcMain.handle(IPC.EMPLOYEE.DELETE, async (_e, id: number) => employeeService.deleteEmployee(id));
  ipcMain.handle(IPC.EMPLOYEE.VALIDATE, async (_e, id: number, direction: string) => employeeService.validateEmployee(id, direction));

  ipcMain.handle(IPC.DRIVER.GET_ALL, async () => driverService.getAllDrivers());
  ipcMain.handle(IPC.DRIVER.CREATE, async (_e, data: any) => driverService.createDriver(data));
  ipcMain.handle(IPC.DRIVER.UPDATE, async (_e, id: number, data: any) => driverService.updateDriver(id, data));
  ipcMain.handle(IPC.DRIVER.DELETE, async (_e, id: number) => driverService.deleteDriver(id));

  ipcMain.handle(IPC.VEHICLE.GET_ALL, async () => vehicleService.getAllVehicles());
  ipcMain.handle(IPC.VEHICLE.CREATE, async (_e, data: any) => vehicleService.createVehicle(data));
  ipcMain.handle(IPC.VEHICLE.UPDATE, async (_e, id: number, data: any) => vehicleService.updateVehicle(id, data));
  ipcMain.handle(IPC.VEHICLE.UPDATE_STATUS, async (_e, id: number, status: string, mileage?: number) =>
    vehicleService.updateVehicleStatus(id, status, mileage)
  );
  ipcMain.handle(IPC.VEHICLE.DELETE, async (_e, id: number) => vehicleService.deleteVehicle(id));

  ipcMain.handle(IPC.ROUTE.GET_ALL, async () => routeService.getAllRoutes());
  ipcMain.handle(IPC.ROUTE.GET_BY_ID, async (_e, id: number) => routeService.getRouteById(id));
  ipcMain.handle(IPC.ROUTE.CREATE, async (_e, data: any) => routeService.createRoute(data));
  ipcMain.handle(IPC.ROUTE.UPDATE, async (_e, id: number, data: any) => routeService.updateRoute(id, data));
  ipcMain.handle(IPC.ROUTE.DELETE, async (_e, id: number) => routeService.deleteRoute(id));

  ipcMain.handle(IPC.SCHEDULE.GET_ALL, async () => scheduleService.getAllSchedules());
  ipcMain.handle(IPC.SCHEDULE.GET_BY_DATE, async (_e, date: string) => scheduleService.getSchedulesByDate(date));
  ipcMain.handle(IPC.SCHEDULE.CREATE, async (_e, data: any) => scheduleService.createSchedule(data));
  ipcMain.handle(IPC.SCHEDULE.UPDATE, async (_e, id: number, data: any) => scheduleService.updateSchedule(id, data));
  ipcMain.handle(IPC.SCHEDULE.UPDATE_STATUS, async (_e, id: number, status: string) => scheduleService.updateScheduleStatus(id, status));
  ipcMain.handle(IPC.SCHEDULE.DELETE, async (_e, id: number) => scheduleService.deleteSchedule(id));
  ipcMain.handle(IPC.SCHEDULE.GET_PASSENGERS, async (_e, id: number) => scheduleService.getSchedulePassengers(id));
  ipcMain.handle(IPC.SCHEDULE.HANDLE_DELAY, async (_e, id: number) => scheduleService.handleDelay(id));
  ipcMain.handle(IPC.SCHEDULE.CONFIRM_PASSENGERS, async (_e, id: number) => scheduleService.confirmPassengers(id));

  ipcMain.handle(IPC.RIDE_REQUEST.GET_ALL, async () => rideRequestService.getAllRideRequests());
  ipcMain.handle(IPC.RIDE_REQUEST.GET_BY_EMPLOYEE, async (_e, id: number) => rideRequestService.getRideRequestsByEmployee(id));
  ipcMain.handle(IPC.RIDE_REQUEST.CREATE, async (_e, data: any) => rideRequestService.createRideRequest(data));
  ipcMain.handle(IPC.RIDE_REQUEST.UPDATE, async (_e, id: number, data: any) => rideRequestService.updateRideRequest(id, data));
  ipcMain.handle(IPC.RIDE_REQUEST.CANCEL, async (_e, id: number) => rideRequestService.cancelRideRequest(id));
  ipcMain.handle(IPC.RIDE_REQUEST.ASSIGN_SEAT, async (_e, id: number) => rideRequestService.assignSeat(id));

  ipcMain.handle(IPC.MAINTENANCE.GET_ALL, async () => maintenanceService.getAllWorkOrders());
  ipcMain.handle(IPC.MAINTENANCE.CREATE, async (_e, data: any) => maintenanceService.createWorkOrder(data));
  ipcMain.handle(IPC.MAINTENANCE.UPDATE, async (_e, id: number, data: any) => maintenanceService.updateWorkOrder(id, data));
  ipcMain.handle(IPC.MAINTENANCE.COMPLETE, async (_e, id: number, parts: any[]) => maintenanceService.completeWorkOrder(id, parts));

  ipcMain.handle(IPC.SPARE_PART.GET_ALL, async () => maintenanceService.getAllSpareParts());
  ipcMain.handle(IPC.SPARE_PART.CREATE, async (_e, data: any) => maintenanceService.createSparePart(data));
  ipcMain.handle(IPC.SPARE_PART.UPDATE, async (_e, id: number, data: any) => maintenanceService.updateSparePart(id, data));
  ipcMain.handle(IPC.SPARE_PART.GET_LOW_STOCK, async () => maintenanceService.getLowStockParts());

  ipcMain.handle(IPC.MAINTENANCE_TEAM.GET_ALL, async () => maintenanceService.getAllTeams());
  ipcMain.handle(IPC.MAINTENANCE_TEAM.CREATE, async (_e, data: any) => maintenanceService.createTeam(data));
  ipcMain.handle(IPC.MAINTENANCE_TEAM.UPDATE, async (_e, id: number, data: any) => maintenanceService.updateTeam(id, data));

  ipcMain.handle(IPC.DRIVER_ADJUSTMENT.GET_ALL, async () => maintenanceService.getAllAdjustments());
  ipcMain.handle(IPC.DRIVER_ADJUSTMENT.CREATE, async (_e, data: any) => maintenanceService.createAdjustment(data));
  ipcMain.handle(IPC.DRIVER_ADJUSTMENT.APPROVE, async (_e, id: number, approver: string) => maintenanceService.approveAdjustment(id, approver));
  ipcMain.handle(IPC.DRIVER_ADJUSTMENT.REJECT, async (_e, id: number, approver: string) => maintenanceService.rejectAdjustment(id, approver));

  ipcMain.handle(IPC.REPORT.GENERATE_MONTHLY, async (_e, month: string) => reportService.generateMonthlyReport(month));
  ipcMain.handle(IPC.REPORT.GET_HISTORY, async () => reportService.getReportHistory());
  ipcMain.handle(IPC.REPORT.EXPORT_PDF, async (_e, month: string) => reportService.exportReportPdf(month));
  ipcMain.handle(IPC.REPORT.GET_STATS, async () => reportService.getStats());

  ipcMain.handle(IPC.ALERT.GET_ALL, async () => reportService.getAllAlerts());
  ipcMain.handle(IPC.ALERT.GET_UNREAD, async () => reportService.getUnreadAlerts());
  ipcMain.handle(IPC.ALERT.MARK_READ, async (_e, id: number) => reportService.markAlertRead(id));

  ipcMain.handle(IPC.DASHBOARD.GET_STATS, async () => reportService.getDashboardStats());
  ipcMain.handle(IPC.DASHBOARD.GET_REALTIME_DATA, async () => reportService.getRealtimeData());
}
