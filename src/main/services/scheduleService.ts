import { getDb } from '../database';
import type { Schedule, ApiResponse, RideRequest } from '../../shared/types';

function rowToSchedule(row: any): Schedule {
  return {
    id: row.id,
    scheduleNo: row.schedule_no,
    routeId: row.route_id,
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    departureTime: row.departure_time,
    date: row.date,
    status: row.status,
    actualDepartureTime: row.actual_departure_time,
    actualArrivalTime: row.actual_arrival_time,
    passengerCount: row.passenger_count,
    createdAt: row.created_at,
  };
}

export async function getAllSchedules(): Promise<ApiResponse<Schedule[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM schedules ORDER BY date DESC, departure_time DESC').all();
    return { success: true, data: rows.map(rowToSchedule) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getSchedulesByDate(date: string): Promise<ApiResponse<Schedule[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM schedules WHERE date = ? ORDER BY departure_time').all(date);
    return { success: true, data: rows.map(rowToSchedule) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createSchedule(data: Omit<Schedule, 'id' | 'passengerCount' | 'createdAt'>): Promise<ApiResponse<Schedule>> {
  try {
    const db = await getDb();
    const result = db.prepare(
      `INSERT INTO schedules (schedule_no, route_id, vehicle_id, driver_id, departure_time, date, status, actual_departure_time, actual_arrival_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(data.scheduleNo, data.routeId, data.vehicleId, data.driverId, data.departureTime, data.date, data.status, data.actualDepartureTime || null, data.actualArrivalTime || null);
    const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, data: rowToSchedule(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateSchedule(id: number, data: Partial<Schedule>): Promise<ApiResponse<Schedule>> {
  try {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.scheduleNo !== undefined) { fields.push('schedule_no = ?'); values.push(data.scheduleNo); }
    if (data.routeId !== undefined) { fields.push('route_id = ?'); values.push(data.routeId); }
    if (data.vehicleId !== undefined) { fields.push('vehicle_id = ?'); values.push(data.vehicleId); }
    if (data.driverId !== undefined) { fields.push('driver_id = ?'); values.push(data.driverId); }
    if (data.departureTime !== undefined) { fields.push('departure_time = ?'); values.push(data.departureTime); }
    if (data.date !== undefined) { fields.push('date = ?'); values.push(data.date); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.actualDepartureTime !== undefined) { fields.push('actual_departure_time = ?'); values.push(data.actualDepartureTime); }
    if (data.actualArrivalTime !== undefined) { fields.push('actual_arrival_time = ?'); values.push(data.actualArrivalTime); }
    values.push(id);
    db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    return { success: true, data: rowToSchedule(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateScheduleStatus(id: number, status: string): Promise<ApiResponse<Schedule>> {
  try {
    const db = await getDb();
    const now = new Date().toISOString();
    if (status === 'departed') {
      db.prepare('UPDATE schedules SET status = ?, actual_departure_time = ? WHERE id = ?').run(status, now, id);
    } else if (status === 'arrived') {
      db.prepare('UPDATE schedules SET status = ?, actual_arrival_time = ? WHERE id = ?').run(status, now, id);
    } else {
      db.prepare('UPDATE schedules SET status = ? WHERE id = ?').run(status, id);
    }
    const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    return { success: true, data: rowToSchedule(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteSchedule(id: number): Promise<ApiResponse<boolean>> {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getSchedulePassengers(scheduleId: number): Promise<ApiResponse<RideRequest[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare(
      `SELECT rr.*, e.name as employee_name, e.employee_no, e.department, rs.station_name
       FROM ride_requests rr
       LEFT JOIN employees e ON rr.employee_id = e.id
       LEFT JOIN route_stations rs ON rr.station_id = rs.id
       WHERE rr.schedule_id = ? AND rr.status IN ('approved', 'completed')
       ORDER BY rr.seat_no`
    ).all(scheduleId) as any[];
    const result: RideRequest[] = rows.map((r: any) => ({
      id: r.id,
      requestNo: r.request_no,
      employeeId: r.employee_id,
      scheduleId: r.schedule_id,
      routeId: r.route_id,
      stationId: r.station_id,
      rideDate: r.ride_date,
      rideTime: r.ride_time,
      direction: r.direction,
      status: r.status,
      seatNo: r.seat_no,
      ticketCode: r.ticket_code,
      rejectionReason: r.rejection_reason,
      createdAt: r.created_at,
      employee_name: r.employee_name,
      employee_no: r.employee_no,
      department: r.department,
      station_name: r.station_name,
    } as any));
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
