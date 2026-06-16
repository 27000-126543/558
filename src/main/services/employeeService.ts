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

export async function validateEmployee(employeeId: number, direction: string): Promise<ApiResponse<{ valid: boolean; reason?: string }>> {
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
      return { success: true, data: { valid: false, reason: `员工信用分过低(${employee.credit_score}分)，低于60分禁止乘车` } };
    }
    return { success: true, data: { valid: true } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
