import { getDb } from '../database';
import type { Driver, ApiResponse } from '../../shared/types';

function rowToDriver(row: any): Driver {
  return {
    id: row.id,
    driverNo: row.driver_no,
    name: row.name,
    phone: row.phone,
    licenseNo: row.license_no,
    licenseType: row.license_type,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getAllDrivers(): Promise<ApiResponse<Driver[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM drivers ORDER BY driver_no').all();
    return { success: true, data: rows.map(rowToDriver) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createDriver(data: Omit<Driver, 'id' | 'createdAt'>): Promise<ApiResponse<Driver>> {
  try {
    const db = await getDb();
    const result = db.prepare(
      `INSERT INTO drivers (driver_no, name, phone, license_no, license_type, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(data.driverNo, data.name, data.phone, data.licenseNo, data.licenseType, data.status);
    const row = db.prepare('SELECT * FROM drivers WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, data: rowToDriver(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateDriver(id: number, data: Partial<Driver>): Promise<ApiResponse<Driver>> {
  try {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.driverNo !== undefined) { fields.push('driver_no = ?'); values.push(data.driverNo); }
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.licenseNo !== undefined) { fields.push('license_no = ?'); values.push(data.licenseNo); }
    if (data.licenseType !== undefined) { fields.push('license_type = ?'); values.push(data.licenseType); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    values.push(id);
    db.prepare(`UPDATE drivers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
    return { success: true, data: rowToDriver(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteDriver(id: number): Promise<ApiResponse<boolean>> {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM drivers WHERE id = ?').run(id);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
