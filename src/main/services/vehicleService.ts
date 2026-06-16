import { getDb } from '../database';
import type { Vehicle, ApiResponse } from '../../shared/types';

function rowToVehicle(row: any): Vehicle {
  return {
    id: row.id,
    plateNo: row.plate_no,
    model: row.model,
    capacity: row.capacity,
    mileage: row.mileage,
    lastMaintenanceDate: row.last_maintenance_date,
    nextMaintenanceMileage: row.next_maintenance_mileage,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getAllVehicles(): Promise<ApiResponse<Vehicle[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM vehicles ORDER BY plate_no').all();
    return { success: true, data: rows.map(rowToVehicle) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createVehicle(data: Omit<Vehicle, 'id' | 'createdAt'>): Promise<ApiResponse<Vehicle>> {
  try {
    const db = await getDb();
    const result = db.prepare(
      `INSERT INTO vehicles (plate_no, model, capacity, mileage, last_maintenance_date, next_maintenance_mileage, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(data.plateNo, data.model, data.capacity, data.mileage, data.lastMaintenanceDate, data.nextMaintenanceMileage, data.status);
    const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, data: rowToVehicle(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateVehicle(id: number, data: Partial<Vehicle>): Promise<ApiResponse<Vehicle>> {
  try {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.plateNo !== undefined) { fields.push('plate_no = ?'); values.push(data.plateNo); }
    if (data.model !== undefined) { fields.push('model = ?'); values.push(data.model); }
    if (data.capacity !== undefined) { fields.push('capacity = ?'); values.push(data.capacity); }
    if (data.mileage !== undefined) { fields.push('mileage = ?'); values.push(data.mileage); }
    if (data.lastMaintenanceDate !== undefined) { fields.push('last_maintenance_date = ?'); values.push(data.lastMaintenanceDate); }
    if (data.nextMaintenanceMileage !== undefined) { fields.push('next_maintenance_mileage = ?'); values.push(data.nextMaintenanceMileage); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    values.push(id);
    db.prepare(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
    return { success: true, data: rowToVehicle(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateVehicleStatus(id: number, status: string, mileage?: number): Promise<ApiResponse<Vehicle>> {
  try {
    const db = await getDb();
    if (mileage !== undefined) {
      db.prepare('UPDATE vehicles SET status = ?, mileage = ? WHERE id = ?').run(status, mileage, id);
    } else {
      db.prepare('UPDATE vehicles SET status = ? WHERE id = ?').run(status, id);
    }
    const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
    const vehicle = rowToVehicle(row);
    if (mileage !== undefined && mileage >= vehicle.nextMaintenanceMileage) {
      const existingWO = db.prepare("SELECT * FROM maintenance_work_orders WHERE vehicle_id = ? AND status IN ('pending', 'in_progress')")
        .get(id);
      if (!existingWO) {
        const teams = db.prepare('SELECT * FROM maintenance_teams LIMIT 1').get();
        const woNo = 'WO' + Date.now();
        db.prepare(
          `INSERT INTO maintenance_work_orders (work_order_no, vehicle_id, type, description, mileage_triggered, team_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(woNo, id, 'routine', `里程达到${mileage}公里，触发常规保养`, mileage, teams?.id || 1, 'pending');
        db.prepare(
          'INSERT INTO alerts (type, level, title, message, related_id) VALUES (?, ?, ?, ?, ?)'
        ).run('maintenance', 'warning', '自动生成维保工单', `车辆${vehicle.plateNo}行驶里程已达${mileage}公里，自动生成维保工单`, id);
      }
    }
    return { success: true, data: vehicle };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteVehicle(id: number): Promise<ApiResponse<boolean>> {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
