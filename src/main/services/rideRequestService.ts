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
    isWaitlist: row.is_waitlist === 1,
    waitlistOrder: row.waitlist_order,
    rescheduledFrom: row.rescheduled_from,
    rescheduleCount: row.reschedule_count || 0,
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

function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function findBestSchedule(
  db: any,
  routeId: number,
  stationId: number,
  rideDate: string,
  rideTime: string,
  excludeScheduleId?: number,
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
       ${excludeScheduleId ? 'AND s.id != ?' : ''}
     ORDER BY s.departure_time`
  ).all(routeId, rideDate, ...(excludeScheduleId ? [excludeScheduleId] : [])) as any[];

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

export async function createRideRequest(data: {
  employeeId: number;
  routeId: number;
  stationId: number;
  rideDate: string;
  rideTime: string;
  direction: string;
}): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();

    const validation = await validateEmployee(data.employeeId, data.direction);
    if (!validation.success || !validation.data?.valid) {
      let errMsg = validation.data?.reason || '员工身份校验失败';
      const recentLogs = validation.data?.recentLogs;
      if (recentLogs && recentLogs.length > 0) {
        const reasons = recentLogs.map((l: any, i: number) => `${i + 1}. ${l.reason}（${l.created_at.substring(0, 16)}，扣${-l.score_change}分）`).join('\n');
        errMsg += '\n\n最近扣分记录：\n' + reasons;
      }
      return { success: false, error: errMsg };
    }

    const existing = db.prepare(
      "SELECT * FROM ride_requests WHERE employee_id = ? AND ride_date = ? AND direction = ? AND status IN ('pending', 'approved', 'waitlist')"
    ).get(data.employeeId, data.rideDate, data.direction);
    if (existing) {
      return { success: false, error: '该员工当天已存在同方向的乘车申请（含候补）' };
    }

    const allocation = findBestSchedule(db, data.routeId, data.stationId, data.rideDate, data.rideTime);
    const requestNo = 'REQ' + Date.now();

    if (allocation) {
      const ticketCode = `TICKET-${data.rideDate.replace(/-/g, '')}-${String(allocation.seatNo).padStart(4, '0')}`;
      const result = db.prepare(
        `INSERT INTO ride_requests (request_no, employee_id, schedule_id, route_id, station_id, ride_date, ride_time, direction, status, seat_no, ticket_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`
      ).run(requestNo, data.employeeId, allocation.schedule.id, data.routeId, data.stationId, data.rideDate, data.rideTime, data.direction, allocation.seatNo, ticketCode);

      db.prepare('UPDATE schedules SET passenger_count = passenger_count + 1 WHERE id = ?').run(allocation.schedule.id);

      const row = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(result.lastInsertRowid);
      return { success: true, data: { ...rowToRequest(row), ticketCode, waitlist: false } };
    } else {
      const nextOrder = (db.prepare(
        "SELECT MAX(waitlist_order) as m FROM ride_requests WHERE route_id = ? AND ride_date = ? AND direction = ? AND is_waitlist = 1 AND status = 'waitlist'"
      ).get(data.routeId, data.rideDate, data.direction)?.m || 0) + 1;

      const result = db.prepare(
        `INSERT INTO ride_requests (request_no, employee_id, route_id, station_id, ride_date, ride_time, direction, status, is_waitlist, waitlist_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'waitlist', 1, ?)`
      ).run(requestNo, data.employeeId, data.routeId, data.stationId, data.rideDate, data.rideTime, data.direction, nextOrder);

      const row = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(result.lastInsertRowid);
      return {
        success: true,
        data: { ...rowToRequest(row), waitlist: true, waitlistOrder: nextOrder },
        warning: `座位已满，已进入候补队列（第${nextOrder}位）。有人取消或加车时将自动补位。`,
      };
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
      "UPDATE ride_requests SET schedule_id = ?, seat_no = ?, ticket_code = ?, status = 'approved', rejection_reason = NULL, is_waitlist = 0, waitlist_order = NULL WHERE id = ?"
    ).run(allocation.schedule.id, allocation.seatNo, ticketCode, requestId);

    db.prepare('UPDATE schedules SET passenger_count = passenger_count + 1 WHERE id = ?').run(allocation.schedule.id);

    const row = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(requestId);
    return { success: true, data: rowToRequest(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function rescheduleRideRequest(requestId: number, data: {
  routeId: number;
  stationId: number;
  rideDate: string;
  rideTime: string;
  direction: string;
}): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const req = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(requestId);
    if (!req) return { success: false, error: '申请不存在' };
    if (req.status !== 'approved') {
      return { success: false, error: '只有已分配的申请才能改签' };
    }
    if ((req.reschedule_count || 0) >= 2) {
      return { success: false, error: '每张申请最多改签2次，请先取消后重新申请' };
    }

    const validation = await validateEmployee(req.employee_id, data.direction);
    if (!validation.success || !validation.data?.valid) {
      let errMsg = validation.data?.reason || '员工身份校验失败';
      const recentLogs = validation.data?.recentLogs;
      if (recentLogs && recentLogs.length > 0) {
        const reasons = recentLogs.map((l: any, i: number) => `${i + 1}. ${l.reason}（${l.created_at.substring(0, 16)}，扣${-l.score_change}分）`).join('\n');
        errMsg += '\n\n最近扣分记录：\n' + reasons;
      }
      return { success: false, error: errMsg };
    }

    const otherSameDay = db.prepare(
      "SELECT * FROM ride_requests WHERE employee_id = ? AND ride_date = ? AND direction = ? AND status IN ('approved', 'waitlist') AND id != ?"
    ).get(req.employee_id, data.rideDate, data.direction, requestId);
    if (otherSameDay) {
      return { success: false, error: '该员工当天已存在同方向的其他乘车申请' };
    }

    const allocation = findBestSchedule(db, data.routeId, data.stationId, data.rideDate, data.rideTime, req.schedule_id);

    const requestNo = 'REQ' + Date.now() + 'R';
    const oldScheduleId = req.schedule_id;
    const oldSeatNo = req.seat_no;

    if (!allocation) {
      const nextOrder = (db.prepare(
        "SELECT MAX(waitlist_order) as m FROM ride_requests WHERE route_id = ? AND ride_date = ? AND direction = ? AND is_waitlist = 1 AND status = 'waitlist'"
      ).get(data.routeId, data.rideDate, data.direction)?.m || 0) + 1;

      const tx = db.transaction(() => {
        db.prepare("UPDATE ride_requests SET status = 'rescheduled' WHERE id = ?").run(requestId);
        const result = db.prepare(
          `INSERT INTO ride_requests (request_no, employee_id, route_id, station_id, ride_date, ride_time, direction, status,
                                      is_waitlist, waitlist_order, rescheduled_from, reschedule_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'waitlist', 1, ?, ?, ?)`
        ).run(requestNo, req.employee_id, data.routeId, data.stationId, data.rideDate, data.rideTime, data.direction,
          nextOrder, requestId, (req.reschedule_count || 0) + 1);

        if (oldScheduleId) {
          db.prepare('UPDATE schedules SET passenger_count = MAX(0, passenger_count - 1) WHERE id = ?').run(oldScheduleId);
        }
        return result;
      });
      const result = tx();
      const newRow = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(result.lastInsertRowid);
      return {
        success: true,
        data: { ...rowToRequest(newRow), waitlist: true, waitlistOrder: nextOrder },
        warning: `改签后新班次座位已满，已进入候补队列（第${nextOrder}位）。原申请已作废。`,
      };
    }

    const ticketCode = `TICKET-${data.rideDate.replace(/-/g, '')}-${String(allocation.seatNo).padStart(4, '0')}`;
    const tx = db.transaction(() => {
      db.prepare("UPDATE ride_requests SET status = 'rescheduled' WHERE id = ?").run(requestId);
      const result = db.prepare(
        `INSERT INTO ride_requests (request_no, employee_id, schedule_id, route_id, station_id, ride_date, ride_time, direction, status,
                                    seat_no, ticket_code, rescheduled_from, reschedule_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)`
      ).run(requestNo, req.employee_id, allocation.schedule.id, data.routeId, data.stationId, data.rideDate, data.rideTime, data.direction,
        allocation.seatNo, ticketCode, requestId, (req.reschedule_count || 0) + 1);

      if (oldScheduleId) {
        db.prepare('UPDATE schedules SET passenger_count = MAX(0, passenger_count - 1) WHERE id = ?').run(oldScheduleId);
      }
      db.prepare('UPDATE schedules SET passenger_count = passenger_count + 1 WHERE id = ?').run(allocation.schedule.id);
      return result;
    });
    const result = tx();
    const newRow = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, data: { ...rowToRequest(newRow), ticketCode, waitlist: false, oldSeatNo } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getWaitlist(routeId?: number, rideDate?: string, direction?: string): Promise<ApiResponse<any[]>> {
  try {
    const db = await getDb();
    let sql = `SELECT rr.*, e.name as employee_name, e.employee_no, e.department, rs.station_name
               FROM ride_requests rr
               LEFT JOIN employees e ON rr.employee_id = e.id
               LEFT JOIN route_stations rs ON rr.station_id = rs.id
               WHERE rr.is_waitlist = 1 AND rr.status = 'waitlist'`;
    const params: any[] = [];
    if (routeId) { sql += ' AND rr.route_id = ?'; params.push(routeId); }
    if (rideDate) { sql += ' AND rr.ride_date = ?'; params.push(rideDate); }
    if (direction) { sql += ' AND rr.direction = ?'; params.push(direction); }
    sql += ' ORDER BY rr.waitlist_order, rr.created_at';
    const rows = db.prepare(sql).all(...params);
    return { success: true, data: rows };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function promoteWaitlist(scheduleId: number, limit: number = 5): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const schedule = db.prepare(
      `SELECT s.*, v.capacity,
              (SELECT COUNT(*) FROM ride_requests rr WHERE rr.schedule_id = s.id AND rr.status IN ('approved')) as booked
       FROM schedules s
       LEFT JOIN vehicles v ON s.vehicle_id = v.id
       WHERE s.id = ?`
    ).get(scheduleId) as any;
    if (!schedule) return { success: false, error: '班次不存在' };

    const available = schedule.capacity - schedule.booked;
    if (available <= 0) {
      return { success: true, data: { promoted: [], reason: '该班次暂无空余座位' } as any };
    }
    const toPromote = Math.min(available, limit);

    const waitlistRows = db.prepare(
      `SELECT rr.* FROM ride_requests rr
       WHERE rr.is_waitlist = 1 AND rr.status = 'waitlist'
         AND rr.route_id = ? AND rr.ride_date = ? AND rr.direction = ?
       ORDER BY rr.waitlist_order, rr.created_at
       LIMIT ?`
    ).all(schedule.route_id, schedule.date,
      (db.prepare('SELECT direction FROM routes WHERE id = ?').get(schedule.route_id)?.direction || 'to_company'),
      toPromote,
    ) as any[];

    if (waitlistRows.length === 0) {
      return { success: true, data: { promoted: [], reason: '候补队列为空' } as any };
    }

    const promoted: any[] = [];
    for (const req of waitlistRows) {
      const usedSeats = db.prepare(
        "SELECT seat_no FROM ride_requests WHERE schedule_id = ? AND seat_no IS NOT NULL AND status IN ('approved', 'pending')"
      ).all(scheduleId).map((r: any) => r.seat_no) as number[];
      let seatNo = 1;
      while (usedSeats.includes(seatNo) && seatNo <= schedule.capacity) {
        seatNo++;
      }
      if (seatNo > schedule.capacity) break;

      const ticketCode = `TICKET-${schedule.date.replace(/-/g, '')}-${String(seatNo).padStart(4, '0')}`;
      db.prepare(
        "UPDATE ride_requests SET schedule_id = ?, seat_no = ?, ticket_code = ?, status = 'approved', is_waitlist = 0, waitlist_order = NULL WHERE id = ?"
      ).run(scheduleId, seatNo, ticketCode, req.id);
      db.prepare('UPDATE schedules SET passenger_count = passenger_count + 1 WHERE id = ?').run(scheduleId);
      promoted.push({ requestId: req.id, requestNo: req.request_no, employeeId: req.employee_id, seatNo, ticketCode });
    }

    if (promoted.length > 0) {
      const msg = `班次${schedule.schedule_no}已有${promoted.length}名候补乘客自动补位`;
      db.prepare(
        'INSERT INTO alerts (type, level, title, message, related_id) VALUES (?, ?, ?, ?, ?)'
      ).run('waitlist', 'info', '候补补位通知', msg, scheduleId);
    }

    return { success: true, data: { promoted, totalAvailable: available, scheduleNo: schedule.schedule_no } };
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

export async function cancelRideRequest(id: number): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const req = db.prepare('SELECT * FROM ride_requests WHERE id = ?').get(id);
    if (!req) return { success: false, error: '申请不存在' };
    let promoted: any[] = [];
    let scheduleIdForPromote: number | null = req.schedule_id;
    const tx = db.transaction(() => {
      if (req.schedule_id) {
        db.prepare('UPDATE schedules SET passenger_count = MAX(0, passenger_count - 1) WHERE id = ?').run(req.schedule_id);
      }
      db.prepare("UPDATE ride_requests SET status = 'cancelled' WHERE id = ?").run(id);
    });
    tx();

    if (scheduleIdForPromote) {
      const promoteRes = await promoteWaitlist(scheduleIdForPromote, 3);
      if (promoteRes.success && promoteRes.data?.promoted) {
        promoted = promoteRes.data.promoted;
      }
    }
    return { success: true, data: { cancelled: true, promoted } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
