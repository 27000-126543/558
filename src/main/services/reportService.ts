import { getDb } from '../database';
import type { MonthlyReport, Alert, ApiResponse, DepartmentStat, VehicleUtilization } from '../../shared/types';
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const fs = require('fs');
const { dialog } = require('electron');

export async function getDashboardStats(): Promise<ApiResponse<{
  totalVehicles: number;
  runningVehicles: number;
  pendingRequests: number;
  todaySchedules: number;
  activeAlerts: number;
  totalEmployees: number;
}>> {
  try {
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];
    const totalVehicles = (db.prepare('SELECT COUNT(*) as c FROM vehicles').get() as any).c;
    const runningVehicles = (db.prepare("SELECT COUNT(*) as c FROM vehicles WHERE status = 'running'").get() as any).c;
    const pendingRequests = (db.prepare("SELECT COUNT(*) as c FROM ride_requests WHERE status = 'pending'").get() as any).c;
    const todaySchedules = (db.prepare('SELECT COUNT(*) as c FROM schedules WHERE date = ?').get(today) as any).c;
    const activeAlerts = (db.prepare('SELECT COUNT(*) as c FROM alerts WHERE is_read = 0').get() as any).c;
    const totalEmployees = (db.prepare("SELECT COUNT(*) as c FROM employees WHERE status = 'active'").get() as any).c;

    return {
      success: true,
      data: { totalVehicles, runningVehicles, pendingRequests, todaySchedules, activeAlerts, totalEmployees },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRealtimeData(): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];

    const schedules = db.prepare(
      `SELECT s.*, r.route_name, v.plate_no, d.name as driver_name
       FROM schedules s
       LEFT JOIN routes r ON s.route_id = r.id
       LEFT JOIN vehicles v ON s.vehicle_id = v.id
       LEFT JOIN drivers d ON s.driver_id = d.id
       WHERE s.date = ?
       ORDER BY s.departure_time`
    ).all(today);

    return { success: true, data: { schedules, today } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAllAlerts(): Promise<ApiResponse<Alert[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM alerts ORDER BY is_read ASC, created_at DESC LIMIT 100').all() as any[];
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        type: r.type,
        level: r.level,
        title: r.title,
        message: r.message,
        relatedId: r.related_id,
        isRead: r.is_read === 1,
        createdAt: r.created_at,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getUnreadAlerts(): Promise<ApiResponse<Alert[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM alerts WHERE is_read = 0 ORDER BY created_at DESC').all() as any[];
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        type: r.type,
        level: r.level,
        title: r.title,
        message: r.message,
        relatedId: r.related_id,
        isRead: false,
        createdAt: r.created_at,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function markAlertRead(id: number): Promise<ApiResponse<boolean>> {
  try {
    const db = await getDb();
    db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function generateMonthlyReport(month: string): Promise<ApiResponse<MonthlyReport>> {
  try {
    const db = await getDb();
    const [year, m] = month.split('-');
    const startDate = `${year}-${m}-01`;
    const endDate = `${year}-${m}-31`;

    const deptRows = db.prepare(
      `SELECT e.department,
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(DISTINCT rr.employee_id) as commute_count,
        COUNT(DISTINCT CASE WHEN s.status IN ('arrived', 'departed') AND s.actual_arrival_time IS NOT NULL
          AND (
            (r.direction = 'to_company' AND CAST(strftime('%H%M', s.actual_arrival_time) AS INTEGER) <= 830)
            OR (r.direction = 'from_company')
          ) THEN rr.employee_id END) as on_time_count
       FROM employees e
       LEFT JOIN ride_requests rr ON e.id = rr.employee_id AND rr.ride_date BETWEEN ? AND ? AND rr.status = 'approved'
       LEFT JOIN schedules s ON rr.schedule_id = s.id
       LEFT JOIN routes r ON s.route_id = r.id
       WHERE e.status = 'active'
       GROUP BY e.department`
    ).all(startDate, endDate) as any[];

    const departmentStats: DepartmentStat[] = deptRows.map((d) => ({
      department: d.department,
      totalEmployees: d.total_employees,
      commuteCount: d.commute_count,
      commuteRate: d.total_employees > 0 ? Math.round((d.commute_count / d.total_employees) * 10000) / 100 : 0,
      onTimeCount: d.on_time_count,
      onTimeRate: d.commute_count > 0 ? Math.round((d.on_time_count / d.commute_count) * 10000) / 100 : 0,
    }));

    const totalSchedulesCount = (db.prepare('SELECT COUNT(*) as c FROM schedules WHERE date BETWEEN ? AND ? AND status != ?')
      .get(startDate, endDate, 'cancelled') as any).c || 1;

    const vehicleRows = db.prepare(
      `SELECT v.plate_no,
        COUNT(s.id) as total_trips,
        SUM(CASE WHEN s.actual_arrival_time IS NOT NULL THEN 50 ELSE 0 END) as total_mileage,
        ROUND(COUNT(s.id) * 100.0 / ?, 2) as utilization_rate
       FROM vehicles v
       LEFT JOIN schedules s ON v.id = s.vehicle_id AND s.date BETWEEN ? AND ? AND s.status != 'cancelled'
       GROUP BY v.id`
    ).all(totalSchedulesCount, startDate, endDate) as any[];

    const vehicleUtilization: VehicleUtilization[] = vehicleRows.map((v) => ({
      plateNo: v.plate_no,
      totalTrips: v.total_trips || 0,
      totalMileage: v.total_mileage || 0,
      utilizationRate: v.utilization_rate || 0,
    }));

    const totalEmployees = departmentStats.reduce((s, d) => s + d.totalEmployees, 0);
    const totalCommute = departmentStats.reduce((s, d) => s + d.commuteCount, 0);
    const totalOnTime = departmentStats.reduce((s, d) => s + d.onTimeCount, 0);

    const overallCommuteRate = totalEmployees > 0 ? Math.round((totalCommute / totalEmployees) * 10000) / 100 : 0;
    const overallOnTimeRate = totalCommute > 0 ? Math.round((totalOnTime / totalCommute) * 10000) / 100 : 0;

    const existing = db.prepare('SELECT * FROM monthly_reports WHERE report_month = ?').get(month) as any;
    if (existing) {
      db.prepare(
        `UPDATE monthly_reports SET department_stats = ?, vehicle_utilization = ?,
         overall_on_time_rate = ?, overall_commute_rate = ? WHERE report_month = ?`
      ).run(JSON.stringify(departmentStats), JSON.stringify(vehicleUtilization), overallOnTimeRate, overallCommuteRate, month);
    } else {
      db.prepare(
        `INSERT INTO monthly_reports (report_month, department_stats, vehicle_utilization, overall_on_time_rate, overall_commute_rate)
         VALUES (?, ?, ?, ?, ?)`
      ).run(month, JSON.stringify(departmentStats), JSON.stringify(vehicleUtilization), overallOnTimeRate, overallCommuteRate);
    }

    const row = db.prepare('SELECT * FROM monthly_reports WHERE report_month = ?').get(month) as any;
    return {
      success: true,
      data: {
        id: row.id,
        reportMonth: row.report_month,
        departmentStats: JSON.parse(row.department_stats),
        vehicleUtilization: JSON.parse(row.vehicle_utilization),
        overallOnTimeRate: row.overall_on_time_rate,
        overallCommuteRate: row.overall_commute_rate,
        createdAt: row.created_at,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getReportHistory(): Promise<ApiResponse<MonthlyReport[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM monthly_reports ORDER BY report_month DESC').all() as any[];
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        reportMonth: r.report_month,
        departmentStats: JSON.parse(r.department_stats),
        vehicleUtilization: JSON.parse(r.vehicle_utilization),
        overallOnTimeRate: r.overall_on_time_rate,
        overallCommuteRate: r.overall_commute_rate,
        createdAt: r.created_at,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function exportReportPdf(month: string): Promise<ApiResponse<boolean>> {
  try {
    const result = await dialog.showSaveDialog({
      title: '导出PDF报表',
      defaultPath: `通勤月报_${month}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: true, data: false };
    }

    const report = await generateMonthlyReport(month);
    if (!report.success || !report.data) {
      return { success: false, error: report.error || '生成报表失败' };
    }

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Enterprise Shuttle Monthly Report`, 14, 22);
    doc.setFontSize(14);
    doc.text(`Report Month: ${month}`, 14, 32);

    doc.setFontSize(12);
    doc.text(`Overall Commute Rate: ${report.data.overallCommuteRate}%`, 14, 44);
    doc.text(`Overall On-Time Rate: ${report.data.overallOnTimeRate}%`, 14, 52);

    const deptData = report.data.departmentStats.map((d) => [
      d.department,
      String(d.totalEmployees),
      String(d.commuteCount),
      `${d.commuteRate}%`,
      String(d.onTimeCount),
      `${d.onTimeRate}%`,
    ]);

    (doc as any).autoTable({
      startY: 60,
      head: [['Department', 'Total', 'Commute', 'Commute Rate', 'On-Time', 'On-Time Rate']],
      body: deptData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [22, 119, 255] },
    });

    const vehData = report.data.vehicleUtilization.map((v) => [
      v.plateNo,
      String(v.totalTrips),
      `${v.totalMileage}km`,
      `${v.utilizationRate}%`,
    ]);

    (doc as any).autoTable({
      head: [['Plate No.', 'Total Trips', 'Total Mileage', 'Utilization Rate']],
      body: vehData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [114, 46, 209] },
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(result.filePath, pdfBuffer);

    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getStats(): Promise<ApiResponse<any>> {
  try {
    const db = await getDb();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const rows = db.prepare(
      `SELECT ride_date, direction, COUNT(*) as count
       FROM ride_requests
       WHERE ride_date >= ? AND status = 'approved'
       GROUP BY ride_date, direction
       ORDER BY ride_date`
    ).all(sevenDaysAgo);
    return { success: true, data: rows };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
