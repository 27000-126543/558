import { getDb } from '../database';
import type { Employee, ApiResponse } from '../../shared/types';

function rowToEmployee(row: any): Employee {
  return {
    id: row.id,
    employeeNo: row.employee_no,
    name: row.name,
    department: row.department,
    position: row.position,
    phone: row.phone,
    creditScore: row.credit_score,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getAllEmployees(): Promise<ApiResponse<Employee[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM employees ORDER BY employee_no').all();
    return { success: true, data: rows.map(rowToEmployee) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getEmployeeById(id: number): Promise<ApiResponse<Employee | null>> {
  try {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    return { success: true, data: row ? rowToEmployee(row) : null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createEmployee(data: Omit<Employee, 'id' | 'createdAt'>): Promise<ApiResponse<Employee>> {
  try {
    const db = await getDb();
    const result = db.prepare(
      `INSERT INTO employees (employee_no, name, department, position, phone, credit_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(data.employeeNo, data.name, data.department, data.position, data.phone, data.creditScore, data.status);
    return (await getEmployeeById(result.lastInsertRowid as number)) as ApiResponse<Employee>;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateEmployee(id: number, data: Partial<Employee>): Promise<ApiResponse<Employee>> {
  try {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.employeeNo !== undefined) { fields.push('employee_no = ?'); values.push(data.employeeNo); }
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.department !== undefined) { fields.push('department = ?'); values.push(data.department); }
    if (data.position !== undefined) { fields.push('position = ?'); values.push(data.position); }
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.creditScore !== undefined) { fields.push('credit_score = ?'); values.push(data.creditScore); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    values.push(id);
    db.prepare(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return (await getEmployeeById(id)) as ApiResponse<Employee>;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteEmployee(id: number): Promise<ApiResponse<boolean>> {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM employees WHERE id = ?').run(id);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function validateEmployee(employeeId: number, direction: string): Promise<ApiResponse<{ valid: boolean; reason?: string; recentLogs?: any[] }>> {
  try {
    const db = await getDb();
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);

    if (!employee) {
      return { success: true, data: { valid: false, reason: '员工不存在，请检查员工信息' } };
    }
    if (employee.status !== 'active') {
      return { success: true, data: { valid: false, reason: '员工已离职或状态异常，无法申请乘车' } };
    }
    if (employee.credit_score < 60) {
      const recentLogs = db.prepare(
        `SELECT * FROM credit_score_logs WHERE employee_id = ? AND score_change < 0 ORDER BY created_at DESC LIMIT 3`
      ).all(employeeId);
      return {
        success: true,
        data: {
          valid: false,
          reason: `员工信用分过低(${employee.credit_score}分)，低于60分禁止乘车`,
          recentLogs,
        },
      };
    }
    return { success: true, data: { valid: true } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deductCreditScore(
  employeeId: number,
  points: number,
  reason: string,
  relatedType?: string,
  relatedId?: number
): Promise<{ newScore: number; logId: number } | null> {
  try {
    const db = await getDb();
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
    if (!employee) return null;
    const newScore = Math.max(0, employee.credit_score - points);
    db.prepare('UPDATE employees SET credit_score = ? WHERE id = ?').run(newScore, employeeId);
    const result = db.prepare(
      `INSERT INTO credit_score_logs (employee_id, score_change, new_score, reason, related_type, related_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(employeeId, -points, newScore, reason, relatedType, relatedId);
    return { newScore, logId: result.lastInsertRowid as number };
  } catch (e) {
    return null;
  }
}

export async function restoreCreditScore(
  employeeId: number,
  points: number,
  reason: string,
  relatedType?: string,
  relatedId?: number
): Promise<{ newScore: number; logId: number } | null> {
  try {
    const db = await getDb();
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
    if (!employee) return null;
    const newScore = Math.min(100, employee.credit_score + points);
    db.prepare('UPDATE employees SET credit_score = ? WHERE id = ?').run(newScore, employeeId);
    const result = db.prepare(
      `INSERT INTO credit_score_logs (employee_id, score_change, new_score, reason, related_type, related_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(employeeId, points, newScore, reason, relatedType, relatedId);
    return { newScore, logId: result.lastInsertRowid as number };
  } catch (e) {
    return null;
  }
}

export async function getEmployeeCommutingProfile(employeeId: number): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
    if (!employee) return { success: false, error: '员工不存在' };

    const recentRequests = db.prepare(
      `SELECT r.*, s.schedule_no, rt.route_name, rs.station_name
       FROM ride_requests r
       LEFT JOIN schedules s ON r.schedule_id = s.id
       LEFT JOIN routes rt ON r.route_id = rt.id
       LEFT JOIN route_stations rs ON r.station_id = rs.id
       WHERE r.employee_id = ?
       ORDER BY r.created_at DESC LIMIT 20`
    ).all(employeeId);

    const recentNoShows = db.prepare(
      `SELECT a.*, s.schedule_no, rs.station_name
       FROM station_absent_records a
       LEFT JOIN schedules s ON a.schedule_id = s.id
       LEFT JOIN route_stations rs ON a.station_id = rs.id
       WHERE a.employee_id = ? AND a.revoked = 0
       ORDER BY a.created_at DESC LIMIT 10`
    ).all(employeeId);

    const recentCreditLogs = db.prepare(
      `SELECT * FROM credit_score_logs WHERE employee_id = ? ORDER BY created_at DESC LIMIT 10`
    ).all(employeeId);

    const stats = db.prepare(
      `SELECT
        COUNT(*) as totalRequests,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledCount,
        SUM(CASE WHEN reschedule_count > 0 THEN 1 ELSE 0 END) as rescheduleCount,
        SUM(CASE WHEN is_waitlist = 1 THEN 1 ELSE 0 END) as waitlistCount
       FROM ride_requests WHERE employee_id = ?`
    ).get(employeeId);

    const noShowCount = db.prepare(
      `SELECT COUNT(*) as count FROM station_absent_records WHERE employee_id = ? AND revoked = 0`
    ).get(employeeId);

    const last30DaysNoShow = db.prepare(
      `SELECT COUNT(*) as count FROM station_absent_records
       WHERE employee_id = ? AND revoked = 0 AND created_at >= datetime('now', '-30 days', 'localtime')`
    ).get(employeeId);

    return {
      success: true,
      data: {
        employee: rowToEmployee(employee),
        recentRequests,
        recentNoShows,
        recentCreditLogs,
        stats: {
          totalRequests: stats?.totalRequests || 0,
          approvedCount: stats?.approvedCount || 0,
          cancelledCount: stats?.cancelledCount || 0,
          noShowCount: noShowCount?.count || 0,
          rescheduleCount: stats?.rescheduleCount || 0,
          waitlistCount: stats?.waitlistCount || 0,
          last30DaysNoShow: last30DaysNoShow?.count || 0,
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
