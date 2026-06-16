import { getDb } from '../database';
import type { RideRequest, ApiResponse } from '../../shared/types';
import { validateEmployee } from './employeeService';

function rowToRequest(row: any): RideRequest {
  return {
    id: row.id,
    requestNo: row.request_no,
    employeeId: row.employee_id,
    scheduleId: row.schedule_id,
    routeId: row.route_id,
    stationId: row.station_id,
    rideDate: row.ride_date,
    rideTime: row.ride_time,
    direction: row.direction,
    status: row.status,
    seatNo: row.seat_no,
    ticketCode: row.ticket_code,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  };
}

export async function getAllRideRequests(): Promise<ApiResponse<RideRequest[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM ride_requests ORDER BY created_at DESC').all();
    return { success: true, data: rows.map(rowToRequest) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRideRequestsByEmployee(employeeId: number): Promise<ApiResponse<RideRequest[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM ride_requests WHERE employee_id = ? ORDER BY created_at DESC').all(employeeId);
    return { success: true, data: rows.map(rowToRequest) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function findBestSchedule(
  db: any,
  routeId: number,
  stationId: number,
  rideDate: string,
  rideTime: string
): { schedule: any; seatNo: number } | null {
  const station = db.prepare('SELECT * FROM route_stations WHERE id = ?').get(stationId);
  if (!station) return null;

  const stationTimeMinutes = timeToMinutes(rideTime || station.estimated_arrival_time);

  const schedules = db.prepare(
    `SELECT s.*, v.capacity,
      (SELECT COUNT(*) FROM ride_requests rr WHERE rr.schedule_id = s.id AND rr.status IN ('approved', 'pending')) as booked
     FROM schedules s
     LEFT JOIN vehicles v ON s.vehicle_id = v.id
     WHERE s.route_id = ? AND s.date = ? AND s.status IN ('pending', 'departed')
     ORDER BY s.departure_time`
  ).all(routeId, rideDate) as any[];

  for (const sch of schedules) {
    const depTime = timeToMinutes(sch.departure_time);
    const timeDiff = Math.abs(depTime - stationTimeMinutes);
    const availableSeats = sch.capacity - sch.booked;
    if (timeDiff <= 30 && availableSeats > 0) {
      const usedSeats = db.prepare(
        "SELECT seat_no FROM ride_requests WHERE schedule_id = ? AND seat_no IS NOT NULL AND status IN ('approved', 'pending')"
      ).all(sch.id).map((r: any) => r.seat_no) as number[];
      let seatNo = 1;
      while (usedSeats.includes(seatNo) && seatNo <= sch.capacity) {
        seatNo++;
      }
      if (seatNo <= sch.capacity) {
        return { schedule: sch, seatNo };
      }
    }
  }
  return null;
}

function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

export async function createRideRequest(data: {
  employeeId: number;
  routeId: number;
  stationId: number;
  rideDate: string;
  rideTime: string;
  direction: string;
}): Promise<ApiResponse<RideRequest & { ticketCode?: string }>> {
  try {
    const db = await getDb();

    const validation = await validateEmployee(data.employeeId, data.direction);
    if (!validation.success || !validation.data?.valid) {
      return { success: false, error: validation.data?.reason || '员工身份校验失败' };
    }

    const existing = db.prepare(
      "SELECT * FROM ride_requests WHERE employee_id = ? AND ride_date = ? AND direction = ? AND status IN ('pending', 'approved')"
    ).get(data.employeeId, data.rideDate, data.direction);
    if (existing) {
      return { success: false, error: '该员工当天已存在同方向的乘车申请' };
    }

    const allocation = findBestSchedule(db, data.routeId, data.stationId, data.rideDate, data.rideTime);

    const requestNo = 'REQ' + Date.now();
    let ticketCode: string | undefined;

    if (allocation) {
      ticketCode = `TICKET-${data.rideDate.replace(/-/g, '')}-${String(allocation.seatNo).padStart(4, '0')}`;
      const result = db.prepare(
        `INSERT INTO ride_requests (request_no, employee_id, schedule_id, route_id, station_id, ride_date, ride_time, direction, status, seat_no, ticket_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`
      ).run(requestNo, data.employeeId, allocation.schedule.id, data.routeId, data.stationId, data.rideDate, data.rideTime, data.direction, allocation.seatNo, ticketCode);

      db.prepare('UPDATE schedules SET passenger_count = passenger_count + 1 WHERE id = ?').run(allocation.schedule.id);

      const row = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(result.lastInsertRowid);
      return { success: true, data: { ...rowToRequest(row), ticketCode } };
    } else {
      const result = db.prepare(
        `INSERT INTO ride_requests (request_no, employee_id, route_id, station_id, ride_date, ride_time, direction, status, rejection_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'rejected', ?)`
      ).run(requestNo, data.employeeId, data.routeId, data.stationId, data.rideDate, data.rideTime, data.direction, '暂无可用班次或座位已满，请选择其他时间或路线');

      const row = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(result.lastInsertRowid);
      return { success: false, error: '暂无可用班次或座位已满，请选择其他时间或路线', data: rowToRequest(row) };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function assignSeat(requestId: number): Promise<ApiResponse<RideRequest>> {
  try {
    const db = await getDb();
    const req = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(requestId);
    if (!req) return { success: false, error: '申请不存在' };

    const allocation = findBestSchedule(db, req.route_id, req.station_id, req.ride_date, req.ride_time);
    if (!allocation) {
      return { success: false, error: '暂无可用班次或座位已满' };
    }

    const ticketCode = `TICKET-${req.ride_date.replace(/-/g, '')}-${String(allocation.seatNo).padStart(4, '0')}`;
    db.prepare(
      "UPDATE ride_requests SET schedule_id = ?, seat_no = ?, ticket_code = ?, status = 'approved', rejection_reason = NULL WHERE id = ?"
    ).run(allocation.schedule.id, allocation.seatNo, ticketCode, requestId);

    db.prepare('UPDATE schedules SET passenger_count = passenger_count + 1 WHERE id = ?').run(allocation.schedule.id);

    const row = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(requestId);
    return { success: true, data: rowToRequest(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateRideRequest(id: number, data: Partial<RideRequest>): Promise<ApiResponse<RideRequest>> {
  try {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.rejectionReason !== undefined) { fields.push('rejection_reason = ?'); values.push(data.rejectionReason); }
    if (data.scheduleId !== undefined) { fields.push('schedule_id = ?'); values.push(data.scheduleId); }
    if (data.seatNo !== undefined) { fields.push('seat_no = ?'); values.push(data.seatNo); }
    values.push(id);
    db.prepare(`UPDATE ride_requests SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(id);
    return { success: true, data: rowToRequest(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function cancelRideRequest(id: number): Promise<ApiResponse<boolean>> {
  try {
    const db = await getDb();
    const req = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(id);
    if (req?.schedule_id) {
      db.prepare('UPDATE schedules SET passenger_count = MAX(0, passenger_count - 1) WHERE id = ?').run(req.schedule_id);
    }
    db.prepare("UPDATE ride_requests SET status = 'cancelled' WHERE id = ?").run(id);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
