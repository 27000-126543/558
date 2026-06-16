const IPC = {
  EMPLOYEE: {
    GET_ALL: 'employee:getAll',
    GET_BY_ID: 'employee:getById',
    CREATE: 'employee:create',
    UPDATE: 'employee:update',
    DELETE: 'employee:delete',
    VALIDATE: 'employee:validate',
  },
  DRIVER: {
    GET_ALL: 'driver:getAll',
    CREATE: 'driver:create',
    UPDATE: 'driver:update',
    DELETE: 'driver:delete',
  },
  VEHICLE: {
    GET_ALL: 'vehicle:getAll',
    CREATE: 'vehicle:create',
    UPDATE: 'vehicle:update',
    DELETE: 'vehicle:delete',
    UPDATE_STATUS: 'vehicle:updateStatus',
  },
  ROUTE: {
    GET_ALL: 'route:getAll',
    GET_BY_ID: 'route:getById',
    CREATE: 'route:create',
    UPDATE: 'route:update',
    DELETE: 'route:delete',
  },
  SCHEDULE: {
    GET_ALL: 'schedule:getAll',
    GET_BY_DATE: 'schedule:getByDate',
    CREATE: 'schedule:create',
    UPDATE: 'schedule:update',
    UPDATE_STATUS: 'schedule:updateStatus',
    DELETE: 'schedule:delete',
    GET_PASSENGERS: 'schedule:getPassengers',
  },
  RIDE_REQUEST: {
    GET_ALL: 'rideRequest:getAll',
    GET_BY_EMPLOYEE: 'rideRequest:getByEmployee',
    CREATE: 'rideRequest:create',
    UPDATE: 'rideRequest:update',
    CANCEL: 'rideRequest:cancel',
    ASSIGN_SEAT: 'rideRequest:assignSeat',
  },
  MAINTENANCE: {
    GET_ALL: 'maintenance:getAll',
    CREATE: 'maintenance:create',
    UPDATE: 'maintenance:update',
    COMPLETE: 'maintenance:complete',
  },
  SPARE_PART: {
    GET_ALL: 'sparePart:getAll',
    CREATE: 'sparePart:create',
    UPDATE: 'sparePart:update',
    GET_LOW_STOCK: 'sparePart:getLowStock',
  },
  MAINTENANCE_TEAM: {
    GET_ALL: 'maintenanceTeam:getAll',
    CREATE: 'maintenanceTeam:create',
    UPDATE: 'maintenanceTeam:update',
  },
  DRIVER_ADJUSTMENT: {
    GET_ALL: 'driverAdjustment:getAll',
    CREATE: 'driverAdjustment:create',
    APPROVE: 'driverAdjustment:approve',
    REJECT: 'driverAdjustment:reject',
  },
  REPORT: {
    GENERATE_MONTHLY: 'report:generateMonthly',
    GET_HISTORY: 'report:getHistory',
    EXPORT_PDF: 'report:exportPdf',
    GET_STATS: 'report:getStats',
  },
  ALERT: {
    GET_ALL: 'alert:getAll',
    GET_UNREAD: 'alert:getUnread',
    MARK_READ: 'alert:markRead',
  },
  DASHBOARD: {
    GET_STATS: 'dashboard:getStats',
    GET_REALTIME_DATA: 'dashboard:getRealtimeData',
  },
};

export default IPC;
