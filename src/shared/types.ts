export interface Employee {
  id: number;
  employeeNo: string;
  name: string;
  department: string;
  position: string;
  phone: string;
  creditScore: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Driver {
  id: number;
  driverNo: string;
  name: string;
  phone: string;
  licenseNo: string;
  licenseType: string;
  status: 'on_duty' | 'off_duty' | 'rest';
  createdAt: string;
}

export interface Vehicle {
  id: number;
  plateNo: string;
  model: string;
  capacity: number;
  mileage: number;
  lastMaintenanceDate: string;
  nextMaintenanceMileage: number;
  status: 'idle' | 'running' | 'maintenance' | 'disabled';
  createdAt: string;
}

export interface Route {
  id: number;
  routeNo: string;
  routeName: string;
  direction: 'to_company' | 'from_company';
  stations: RouteStation[];
  createdAt: string;
}

export interface RouteStation {
  id: number;
  stationName: string;
  stationAddress: string;
  sequence: number;
  estimatedArrivalTime: string;
}

export interface Schedule {
  id: number;
  scheduleNo: string;
  routeId: number;
  vehicleId: number;
  driverId: number;
  departureTime: string;
  date: string;
  status: 'pending' | 'departed' | 'arrived' | 'cancelled' | 'delayed';
  actualDepartureTime?: string;
  actualArrivalTime?: string;
  passengerCount: number;
  passengerConfirmed?: boolean;
  passengerConfirmedAt?: string;
  currentStationId?: number;
  currentStationSeq?: number;
  createdAt: string;
}

export interface RideRequest {
  id: number;
  requestNo: string;
  employeeId: number;
  scheduleId?: number;
  routeId: number;
  stationId: number;
  rideDate: string;
  rideTime: string;
  direction: 'to_company' | 'from_company';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'waitlist' | 'rescheduled';
  seatNo?: number;
  ticketCode?: string;
  rejectionReason?: string;
  isWaitlist?: boolean;
  waitlistOrder?: number;
  rescheduledFrom?: number;
  rescheduleCount?: number;
  createdAt: string;
}

export interface MaintenanceWorkOrder {
  id: number;
  workOrderNo: string;
  vehicleId: number;
  type: 'routine' | 'repair' | 'inspection';
  description: string;
  mileageTriggered: number;
  teamId: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  partsUsed: MaintenancePart[];
  createdAt: string;
  completedAt?: string;
}

export interface MaintenancePart {
  partId: number;
  partName: string;
  quantity: number;
  unitPrice: number;
}

export interface SparePart {
  id: number;
  partNo: string;
  partName: string;
  category: string;
  stock: number;
  safetyStock: number;
  unitPrice: number;
  supplier: string;
}

export interface MaintenanceTeam {
  id: number;
  teamName: string;
  leader: string;
  phone: string;
  members: string;
}

export interface DriverAdjustment {
  id: number;
  scheduleId: number;
  driverId: number;
  oldDriverId?: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approver?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface Alert {
  id: number;
  type: 'delay' | 'maintenance' | 'stock' | 'credit' | 'station_delay' | 'waitlist' | 'info';
  level: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  relatedId?: number;
  isRead: boolean;
  createdAt: string;
}

export interface MonthlyReport {
  id: number;
  reportMonth: string;
  departmentStats: DepartmentStat[];
  vehicleUtilization: VehicleUtilization[];
  overallOnTimeRate: number;
  overallCommuteRate: number;
  createdAt: string;
}

export interface DepartmentStat {
  department: string;
  totalEmployees: number;
  commuteCount: number;
  commuteRate: number;
  onTimeCount: number;
  onTimeRate: number;
}

export interface VehicleUtilization {
  plateNo: string;
  totalTrips: number;
  totalMileage: number;
  utilizationRate: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  warning?: string;
  details?: any;
  schedule?: any;
}
