import { getDb, saveDbNow } from '../database';
import type { Schedule, ApiResponse, RideRequest } from '../../shared/types';
import { promoteWaitlist } from './rideRequestService';
import { deductCreditScore, restoreCreditScore } from './employeeService';

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
    passengerConfirmed: row.passenger_confirmed === 1,
    passengerConfirmedAt: row.passenger_confirmed_at,
    currentStationId: row.current_station_id,
    currentStationSeq: row.current_station_seq || 0,
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
    const newSchedule = rowToSchedule(row);
    promoteWaitlist(newSchedule.id, 10).catch(() => {});
    return { success: true, data: newSchedule };
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
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (status === 'departed') {
      db.prepare('UPDATE schedules SET status = ?, actual_departure_time = ?, current_station_seq = 0 WHERE id = ?').run(status, now, id);
      const stations = db.prepare(
        `SELECT rs.* FROM route_stations rs
         JOIN schedules s ON s.route_id = rs.route_id
         WHERE s.id = ? ORDER BY rs.sequence`
      ).all(id) as any[];
      for (const st of stations) {
        db.prepare(
          `INSERT INTO schedule_station_logs (schedule_id, station_id, station_seq, planned_arrival_time)
           VALUES (?, ?, ?, ?)`
        ).run(id, st.id, st.sequence, st.estimated_arrival_time);
      }
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

export async function getSchedulePassengers(scheduleId: number): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as any;
    const rows = db.prepare(
      `SELECT rr.*, e.name as employee_name, e.employee_no, e.department, rs.station_name
       FROM ride_requests rr
       LEFT JOIN employees e ON rr.employee_id = e.id
       LEFT JOIN route_stations rs ON rr.station_id = rs.id
       WHERE rr.schedule_id = ? AND rr.status IN ('approved', 'completed')
       ORDER BY rr.seat_no`
    ).all(scheduleId) as any[];
    const result: any[] = rows.map((r: any) => ({
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
    }));
    return {
      success: true,
      data: {
        passengers: result,
        schedule: {
          passengerConfirmed: schedule?.passenger_confirmed === 1,
          passengerConfirmedAt: schedule?.passenger_confirmed_at,
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleDelay(id: number): Promise<ApiResponse<any>> {
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
    const alertRes = db.prepare(
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
        alert: { id: alertRes.lastInsertRowid, title: '班次延误预警', message: alertMsg },
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

export async function confirmPassengers(scheduleId: number): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as any;
    if (!schedule) {
      return { success: false, error: '班次不存在' };
    }
    if (schedule.passenger_confirmed === 1) {
      return {
        success: true,
        data: {
          confirmed: true,
          confirmedAt: schedule.passenger_confirmed_at,
        },
      };
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.prepare(
      "UPDATE schedules SET passenger_confirmed = 1, passenger_confirmed_at = ? WHERE id = ?"
    ).run(now, scheduleId);
    await saveDbNow();

    return { success: true, data: { confirmed: true, confirmedAt: now } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function recordStationArrival(scheduleId: number, stationLogId: number, data: {
  actualArrivalTime: string;
  actualDepartureTime?: string;
  boardedCount: number;
  absentCount: number;
  absentPassengerIds?: number[];
}): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const log = db.prepare('SELECT * FROM schedule_station_logs WHERE id = ? AND schedule_id = ?').get(stationLogId, scheduleId) as any;
    if (!log) {
      return { success: false, error: '站点记录不存在' };
    }

    let delayMinutes = 0;
    let isDelayed = 0;
    if (log.planned_arrival_time && data.actualArrivalTime) {
      const [ph, pm] = log.planned_arrival_time.split(':').map(Number);
      const [ah, am] = data.actualArrivalTime.substring(11, 16).split(':').map(Number);
      const planned = ph * 60 + pm;
      const actual = ah * 60 + am;
      delayMinutes = actual - planned;
      if (delayMinutes > 5) {
        isDelayed = 1;
      }
    }

    db.prepare(
      `UPDATE schedule_station_logs
       SET actual_arrival_time = ?, actual_departure_time = ?, boarded_count = ?, absent_count = ?, is_delayed = ?, delay_minutes = ?
       WHERE id = ?`
    ).run(
      data.actualArrivalTime,
      data.actualDepartureTime || null,
      data.boardedCount,
      data.absentCount,
      isDelayed,
      Math.max(0, delayMinutes),
      stationLogId,
    );

    db.prepare(
      'UPDATE schedules SET current_station_id = ?, current_station_seq = ? WHERE id = ?'
    ).run(log.station_id, log.station_seq, scheduleId);

    const stations = db.prepare(
      'SELECT MAX(station_seq) as max_seq FROM schedule_station_logs WHERE schedule_id = ?'
    ).get(scheduleId) as any;
    if (log.station_seq >= (stations?.max_seq || 0)) {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      db.prepare("UPDATE schedules SET status = 'arrived', actual_arrival_time = ? WHERE id = ?").run(now, scheduleId);
    }

    let newAlert: any = null;
    if (isDelayed === 1 && log.delay_alerted === 0) {
      const schedule = db.prepare(
        `SELECT s.*, r.route_name, rs.station_name
         FROM schedules s
         LEFT JOIN routes r ON s.route_id = r.id
         LEFT JOIN route_stations rs ON rs.id = ?
         WHERE s.id = ?`
      ).get(log.station_id, scheduleId) as any;
      const alertTitle = '站点延误提醒';
      const alertMsg = `班次${schedule?.schedule_no || ''}（${schedule?.route_name || ''}）在${schedule?.station_name || '站点'}晚到${delayMinutes}分钟，预计影响乘客乘车`;
      const alertRes = db.prepare(
        'INSERT INTO alerts (type, level, title, message, related_id) VALUES (?, ?, ?, ?, ?)'
      ).run('station_delay', 'warning', alertTitle, alertMsg, scheduleId);
      db.prepare('UPDATE schedule_station_logs SET delay_alerted = 1 WHERE id = ?').run(stationLogId);
      newAlert = { id: alertRes.lastInsertRowid, title: alertTitle, message: alertMsg };
    }

    const absentIds = data.absentPassengerIds || [];
    if (absentIds.length > 0) {
      db.prepare('UPDATE station_absent_records SET revoked = 1, revoked_at = datetime(\'now\', \'localtime\') WHERE station_log_id = ? AND revoked = 0').run(stationLogId);
      for (const employeeId of absentIds) {
        const request = db.prepare(
          'SELECT * FROM ride_requests WHERE schedule_id = ? AND employee_id = ? AND station_id = ? AND status = \'approved\' ORDER BY id DESC LIMIT 1'
        ).get(scheduleId, employeeId, log.station_id);
        if (request) {
          db.prepare(
            `INSERT INTO station_absent_records (schedule_id, station_log_id, station_id, employee_id, request_id)
             VALUES (?, ?, ?, ?, ?)`
          ).run(scheduleId, stationLogId, log.station_id, employeeId, request.id);
          const station = db.prepare('SELECT station_name FROM route_stations WHERE id = ?').get(log.station_id);
          const reason = `未乘车 - ${station?.station_name || '站点'}站未到`;
          await deductCreditScore(employeeId, 5, reason, 'station_absent', stationLogId);
        }
      }
    }

    const updatedLog = db.prepare('SELECT * FROM schedule_station_logs WHERE id = ?').get(stationLogId);
    const updatedSchedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);
    const absentPassengers = db.prepare(
      `SELECT a.*, e.name as employee_name, e.employee_no, e.department
       FROM station_absent_records a
       LEFT JOIN employees e ON a.employee_id = e.id
       WHERE a.station_log_id = ? AND a.revoked = 0`
    ).all(stationLogId);
    return {
      success: true,
      data: {
        stationLog: updatedLog,
        schedule: rowToSchedule(updatedSchedule),
        newAlert,
        absentPassengers,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getStationLogs(scheduleId: number): Promise<ApiResponse<any[]>> {
  try {
    const db = await getDb();
    let rows = db.prepare(
      `SELECT sl.*, rs.station_name, rs.station_address
       FROM schedule_station_logs sl
       LEFT JOIN route_stations rs ON sl.station_id = rs.id
       WHERE sl.schedule_id = ?
       ORDER BY sl.station_seq`
    ).all(scheduleId);
    if (rows.length === 0) {
      const stations = db.prepare(
        `SELECT rs.* FROM route_stations rs
         JOIN schedules s ON s.route_id = rs.route_id
         WHERE s.id = ? ORDER BY rs.sequence`
      ).all(scheduleId) as any[];
      for (const st of stations) {
        db.prepare(
          `INSERT INTO schedule_station_logs (schedule_id, station_id, station_seq, planned_arrival_time)
           VALUES (?, ?, ?, ?)`
        ).run(scheduleId, st.id, st.sequence, st.estimated_arrival_time);
      }
      if (stations.length > 0) {
        db.prepare('UPDATE schedules SET current_station_seq = 0 WHERE id = ? AND current_station_seq IS NULL').run(scheduleId);
      }
      rows = db.prepare(
      `SELECT sl.*, rs.station_name, rs.station_address
       FROM schedule_station_logs sl
       LEFT JOIN route_stations rs ON sl.station_id = rs.id
       WHERE sl.schedule_id = ?
       ORDER BY sl.station_seq`
    ).all(scheduleId);
    }
    const enriched = rows.map(row => {
      const absentees = db.prepare(
        `SELECT a.*, e.name as employee_name, e.employee_no, e.department, e.phone
         FROM station_absent_records a
         LEFT JOIN employees e ON a.employee_id = e.id
         WHERE a.station_log_id = ? AND a.revoked = 0`
      ).all(row.id);
      return { ...row, absent_passengers: absentees };
    });
    return { success: true, data: enriched };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getStationAffectedPassengers(scheduleId: number, stationId: number): Promise<ApiResponse<any[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare(
      `SELECT rr.*, e.name as employee_name, e.employee_no, e.department, e.phone,
              rs.station_name, rs.estimated_arrival_time
       FROM ride_requests rr
       LEFT JOIN employees e ON rr.employee_id = e.id
       LEFT JOIN route_stations rs ON rr.station_id = rs.id
       WHERE rr.schedule_id = ? AND rr.station_id = ?
         AND rr.status IN ('approved', 'completed')
       ORDER BY rr.seat_no`
    ).all(scheduleId, stationId);
    return { success: true, data: rows };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getStationAbsentPassengers(stationLogId: number): Promise<ApiResponse<any[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare(
      `SELECT a.*, e.name as employee_name, e.employee_no, e.department, e.phone
       FROM station_absent_records a
       LEFT JOIN employees e ON a.employee_id = e.id
       WHERE a.station_log_id = ? AND a.revoked = 0
       ORDER BY a.created_at DESC`
    ).all(stationLogId);
    return { success: true, data: rows };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function revokeStationAbsent(recordId: number): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const record = db.prepare('SELECT * FROM station_absent_records WHERE id = ? AND revoked = 0').get(recordId) as any;
    if (!record) return { success: false, error: '记录不存在或已撤销' };

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.prepare('UPDATE station_absent_records SET revoked = 1, revoked_at = ? WHERE id = ?').run(now, recordId);

    const station = db.prepare('SELECT station_name FROM route_stations WHERE id = ?').get(record.station_id);
    const reason = `撤销未到记录 - ${station?.station_name || '站点'}`;
    await restoreCreditScore(record.employee_id, 5, reason, 'station_absent_revoke', recordId);

    return { success: true, data: { revoked: true, revokedAt: now } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getScheduleRunSummary(scheduleId: number): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const logs = db.prepare(
      `SELECT * FROM schedule_station_logs WHERE schedule_id = ? ORDER BY station_seq`
    ).all(scheduleId);

    const totalBoarded = logs.reduce((sum: number, log: any) => sum + (log.boarded_count || 0), 0);
    const totalAbsent = logs.reduce((sum: number, log: any) => sum + (log.absent_count || 0), 0);
    const hasDelay = logs.some((log: any) => log.is_delayed === 1);
    const currentStationSeq = Math.max(...logs.filter((l: any) => l.actual_arrival_time).map((l: any) => l.station_seq), -1);

    return {
      success: true,
      data: {
        totalBoarded,
        totalAbsent,
        hasDelay,
        currentStationSeq,
        stationCount: logs.length,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
