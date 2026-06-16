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

export async function handleDelay(id: number): Promise<ApiResponse<{
  schedule: Schedule;
  alert: any;
  replacementVehicles: any[];
  rescheduledSchedule: Schedule | null;
}>> {
  try {
    const db = await getDb();
    const scheduleRow = db.prepare(
      `SELECT s.*, r.route_name, v.plate_no, d.name as driver_name
       FROM schedules s
       LEFT JOIN routes r ON s.route_id = r.id
       LEFT JOIN vehicles v ON s.vehicle_id = v.id
       LEFT JOIN drivers d ON s.driver_id = d.id
       WHERE s.id = ?`
    ).get(id) as any;

    if (!scheduleRow) {
      return { success: false, error: '班次不存在' };
    }

    db.prepare("UPDATE schedules SET status = 'delayed' WHERE id = ?").run(id);

    const alertMsg = `班次${scheduleRow.schedule_no}（路线:${scheduleRow.route_name || '-'}，车辆:${scheduleRow.plate_no || '-'}，司机:${scheduleRow.driver_name || '-'}）发生延误`;
    db.prepare(
      'INSERT INTO alerts (type, level, title, message, related_id) VALUES (?, ?, ?, ?, ?)'
    ).run('delay', 'danger', '班次延误预警', alertMsg, id);

    const replacementVehicles = db.prepare(
      "SELECT * FROM vehicles WHERE status = 'idle' AND id != ? LIMIT 3"
    ).all(scheduleRow.vehicle_id) as any[];

    let rescheduledSchedule: Schedule | null = null;
    if (replacementVehicles.length > 0) {
      const replacement = replacementVehicles[0];
      const drivers = db.prepare("SELECT * FROM drivers WHERE status = 'on_duty' AND id != ? LIMIT 1").all(scheduleRow.driver_id) as any[];
      const newDriverId = drivers.length > 0 ? drivers[0].id : scheduleRow.driver_id;
      const newScheduleNo = 'S' + Date.now();
      const result = db.prepare(
        `INSERT INTO schedules (schedule_no, route_id, vehicle_id, driver_id, departure_time, date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      ).run(newScheduleNo, scheduleRow.route_id, replacement.id, newDriverId, scheduleRow.departure_time, scheduleRow.date);
      const newScheduleRow = db.prepare('SELECT * FROM schedules WHERE id = ?').get(result.lastInsertRowid);
      rescheduledSchedule = rowToSchedule(newScheduleRow);
    }

    const updatedRow = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    return {
      success: true,
      data: {
        schedule: rowToSchedule(updatedRow),
        alert: { title: '班次延误预警', message: alertMsg },
        replacementVehicles: replacementVehicles.map((v: any) => ({
          id: v.id, plateNo: v.plate_no, model: v.model, capacity: v.capacity,
        })),
        rescheduledSchedule,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function confirmPassengers(scheduleId: number): Promise<ApiResponse<{ confirmed: boolean; confirmedAt: string }>> {
  try {
    const db = await getDb();
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as any;
    if (!schedule) {
      return { success: false, error: '班次不存在' };
    }
    if (schedule.passenger_confirmed === 1) {
      return { success: false, error: '该班次乘客名单已确认，无需重复确认' };
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.prepare(
      "UPDATE schedules SET passenger_confirmed = 1, passenger_confirmed_at = ? WHERE id = ?"
    ).run(now, scheduleId);

    return { success: true, data: { confirmed: true, confirmedAt: now } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
