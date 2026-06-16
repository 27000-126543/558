import { getDb } from '../database';
import type { MaintenanceWorkOrder, SparePart, MaintenanceTeam, DriverAdjustment, ApiResponse } from '../../shared/types';

function rowToWorkOrder(row: any): MaintenanceWorkOrder {
  return {
    id: row.id,
    workOrderNo: row.work_order_no,
    vehicleId: row.vehicle_id,
    type: row.type,
    description: row.description,
    mileageTriggered: row.mileage_triggered,
    teamId: row.team_id,
    status: row.status,
    partsUsed: row.parts_used ? JSON.parse(row.parts_used) : [],
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function rowToSparePart(row: any): SparePart {
  return {
    id: row.id,
    partNo: row.part_no,
    partName: row.part_name,
    category: row.category,
    stock: row.stock,
    safetyStock: row.safety_stock,
    unitPrice: row.unit_price,
    supplier: row.supplier,
  };
}

function rowToTeam(row: any): MaintenanceTeam {
  return {
    id: row.id,
    teamName: row.team_name,
    leader: row.leader,
    phone: row.phone,
    members: row.members,
  };
}

function rowToAdjustment(row: any): DriverAdjustment {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    driverId: row.driver_id,
    reason: row.reason,
    status: row.status,
    approver: row.approver,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  };
}

export async function getAllWorkOrders(): Promise<ApiResponse<MaintenanceWorkOrder[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM maintenance_work_orders ORDER BY created_at DESC').all();
    return { success: true, data: rows.map(rowToWorkOrder) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createWorkOrder(data: Omit<MaintenanceWorkOrder, 'id' | 'createdAt'>): Promise<ApiResponse<MaintenanceWorkOrder>> {
  try {
    const db = await getDb();
    const result = db.prepare(
      `INSERT INTO maintenance_work_orders (work_order_no, vehicle_id, type, description, mileage_triggered, team_id, status, parts_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(data.workOrderNo, data.vehicleId, data.type, data.description, data.mileageTriggered, data.teamId, data.status, JSON.stringify(data.partsUsed || []));
    const row = db.prepare('SELECT * FROM maintenance_work_orders WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, data: rowToWorkOrder(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateWorkOrder(id: number, data: Partial<MaintenanceWorkOrder>): Promise<ApiResponse<MaintenanceWorkOrder>> {
  try {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.teamId !== undefined) { fields.push('team_id = ?'); values.push(data.teamId); }
    if (data.partsUsed !== undefined) { fields.push('parts_used = ?'); values.push(JSON.stringify(data.partsUsed)); }
    values.push(id);
    db.prepare(`UPDATE maintenance_work_orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM maintenance_work_orders WHERE id = ?').get(id);
    return { success: true, data: rowToWorkOrder(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function completeWorkOrder(id: number, partsUsed: { partId: number; partName: string; quantity: number; unitPrice: number }[]): Promise<ApiResponse<MaintenanceWorkOrder>> {
  try {
    const db = await getDb();
    for (const part of partsUsed) {
      if (!part.partId || part.quantity <= 0) continue;
      const current = db.prepare('SELECT stock, part_name FROM spare_parts WHERE id = ?').get(part.partId) as any;
      if (!current) {
        return { success: false, error: `备件ID${part.partId}不存在` };
      }
      if (current.stock < part.quantity) {
        return { success: false, error: `备件"${current.part_name}"库存不足（当前库存${current.stock}，需要${part.quantity}）` };
      }
    }

    const tx = db.transaction(() => {
      for (const part of partsUsed) {
        if (!part.partId || part.quantity <= 0) continue;
        db.prepare('UPDATE spare_parts SET stock = stock - ? WHERE id = ?').run(part.quantity, part.partId);
        const updated = db.prepare('SELECT stock, safety_stock, part_name FROM spare_parts WHERE id = ?').get(part.partId) as any;
        if (updated.stock < updated.safety_stock) {
          const existingAlert = db.prepare("SELECT * FROM alerts WHERE related_id = ? AND type = 'stock' AND is_read = 0").get(part.partId);
          if (!existingAlert) {
            db.prepare(
              'INSERT INTO alerts (type, level, title, message, related_id) VALUES (?, ?, ?, ?, ?)'
            ).run('stock', 'warning', '备件库存不足', `${updated.part_name}库存低于安全库存(当前${updated.stock}，安全库存${updated.safety_stock})`, part.partId);
          }
        }
      }
      db.prepare("UPDATE maintenance_work_orders SET status = 'completed', completed_at = datetime('now', 'localtime'), parts_used = ? WHERE id = ?")
        .run(JSON.stringify(partsUsed), id);
      const wo = db.prepare('SELECT * FROM maintenance_work_orders WHERE id = ?').get(id);
      if (wo) {
        const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(wo.vehicle_id);
        if (vehicle) {
          const nextMileage = (vehicle.next_maintenance_mileage || 5000) + 5000;
          db.prepare("UPDATE vehicles SET status = 'idle', last_maintenance_date = date('now', 'localtime'), next_maintenance_mileage = ? WHERE id = ?")
            .run(nextMileage, wo.vehicle_id);
        }
      }
    });
    tx();
    const row = db.prepare('SELECT * FROM maintenance_work_orders WHERE id = ?').get(id);
    return { success: true, data: rowToWorkOrder(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAllSpareParts(): Promise<ApiResponse<SparePart[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM spare_parts ORDER BY part_no').all();
    return { success: true, data: rows.map(rowToSparePart) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getLowStockParts(): Promise<ApiResponse<SparePart[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM spare_parts WHERE stock < safety_stock ORDER BY stock ASC').all();
    return { success: true, data: rows.map(rowToSparePart) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createSparePart(data: Omit<SparePart, 'id'>): Promise<ApiResponse<SparePart>> {
  try {
    const db = await getDb();
    const result = db.prepare(
      'INSERT INTO spare_parts (part_no, part_name, category, stock, safety_stock, unit_price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(data.partNo, data.partName, data.category, data.stock, data.safetyStock, data.unitPrice, data.supplier);
    const row = db.prepare('SELECT * FROM spare_parts WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, data: rowToSparePart(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateSparePart(id: number, data: Partial<SparePart>): Promise<ApiResponse<SparePart>> {
  try {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.partNo !== undefined) { fields.push('part_no = ?'); values.push(data.partNo); }
    if (data.partName !== undefined) { fields.push('part_name = ?'); values.push(data.partName); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.stock !== undefined) { fields.push('stock = ?'); values.push(data.stock); }
    if (data.safetyStock !== undefined) { fields.push('safety_stock = ?'); values.push(data.safetyStock); }
    if (data.unitPrice !== undefined) { fields.push('unit_price = ?'); values.push(data.unitPrice); }
    if (data.supplier !== undefined) { fields.push('supplier = ?'); values.push(data.supplier); }
    values.push(id);
    db.prepare(`UPDATE spare_parts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM spare_parts WHERE id = ?').get(id);
    return { success: true, data: rowToSparePart(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAllTeams(): Promise<ApiResponse<MaintenanceTeam[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM maintenance_teams ORDER BY team_name').all();
    return { success: true, data: rows.map(rowToTeam) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createTeam(data: Omit<MaintenanceTeam, 'id'>): Promise<ApiResponse<MaintenanceTeam>> {
  try {
    const db = await getDb();
    const result = db.prepare(
      'INSERT INTO maintenance_teams (team_name, leader, phone, members) VALUES (?, ?, ?, ?)'
    ).run(data.teamName, data.leader, data.phone, data.members);
    const row = db.prepare('SELECT * FROM maintenance_teams WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, data: rowToTeam(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateTeam(id: number, data: Partial<MaintenanceTeam>): Promise<ApiResponse<MaintenanceTeam>> {
  try {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.teamName !== undefined) { fields.push('team_name = ?'); values.push(data.teamName); }
    if (data.leader !== undefined) { fields.push('leader = ?'); values.push(data.leader); }
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.members !== undefined) { fields.push('members = ?'); values.push(data.members); }
    values.push(id);
    db.prepare(`UPDATE maintenance_teams SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM maintenance_teams WHERE id = ?').get(id);
    return { success: true, data: rowToTeam(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAllAdjustments(): Promise<ApiResponse<DriverAdjustment[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM driver_adjustments ORDER BY created_at DESC').all();
    return { success: true, data: rows.map(rowToAdjustment) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createAdjustment(data: Omit<DriverAdjustment, 'id' | 'createdAt' | 'status' | 'approver' | 'approvedAt'>): Promise<ApiResponse<DriverAdjustment>> {
  try {
    const db = await getDb();
    const result = db.prepare(
      'INSERT INTO driver_adjustments (schedule_id, driver_id, reason) VALUES (?, ?, ?)'
    ).run(data.scheduleId, data.driverId, data.reason);
    const row = db.prepare('SELECT * FROM driver_adjustments WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, data: rowToAdjustment(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function approveAdjustment(id: number, approver: string): Promise<ApiResponse<DriverAdjustment>> {
  try {
    const db = await getDb();
    const adj = db.prepare('SELECT * FROM driver_adjustments WHERE id = ?').get(id);
    if (!adj) return { success: false, error: '申请不存在' };
    const tx = db.transaction(() => {
      db.prepare('UPDATE schedules SET driver_id = ? WHERE id = ?').run(adj.driver_id, adj.schedule_id);
      db.prepare("UPDATE driver_adjustments SET status = 'approved', approver = ?, approved_at = datetime('now', 'localtime') WHERE id = ?")
        .run(approver, id);
    });
    tx();
    const row = db.prepare('SELECT * FROM driver_adjustments WHERE id = ?').get(id);
    return { success: true, data: rowToAdjustment(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function rejectAdjustment(id: number, approver: string): Promise<ApiResponse<DriverAdjustment>> {
  try {
    const db = await getDb();
    db.prepare("UPDATE driver_adjustments SET status = 'rejected', approver = ?, approved_at = datetime('now', 'localtime') WHERE id = ?")
      .run(approver, id);
    const row = db.prepare('SELECT * FROM driver_adjustments WHERE id = ?').get(id);
    return { success: true, data: rowToAdjustment(row) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
