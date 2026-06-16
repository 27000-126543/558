import initSqlJs, { SqlJsDatabase, SqlJsStatic } from 'sql.js';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export interface Statement {
  run(...params: any[]): { changes: number; lastInsertRowid: number };
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

export interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  pragma(sql: string): void;
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T;
  close(): void;
  export(): Uint8Array;
}

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;
let innerDbRef: SqlJsDatabase | null = null;
let dbPathRef: string = '';

async function initSql() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

export async function saveDbNow() {
  if (innerDbRef && dbPathRef) {
    saveDb(dbPathRef, innerDbRef);
  }
}

function toArray(args: IArguments | any[]): any[] {
  return Array.isArray(args) ? args : Array.prototype.slice.call(args);
}

function wrapDatabase(innerDb: SqlJsDatabase): Database {
  const wrapper: Database = {
    exec(sql: string) {
      innerDb.run(sql);
    },
    prepare(sql: string): Statement {
      return {
        run(...params: any[]) {
          const p = toArray(params);
          innerDb.run(sql, p);
          const changesInfo = innerDb.exec('SELECT changes() as c, last_insert_rowid() as id')[0];
          const row = changesInfo?.values?.[0] || [0, 0];
          return { changes: row[0], lastInsertRowid: row[1] };
        },
        get(...params: any[]) {
          const p = toArray(params);
          const stmt = innerDb.prepare(sql);
          stmt.bind(p);
          if (stmt.step()) {
            const result = stmt.getAsObject();
            stmt.free();
            return result;
          }
          stmt.free();
          return undefined;
        },
        all(...params: any[]) {
          const p = toArray(params);
          const results: any[] = [];
          const stmt = innerDb.prepare(sql);
          stmt.bind(p);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        },
      };
    },
    pragma(sql: string) {
      innerDb.run(`PRAGMA ${sql}`);
    },
    transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
      return (...args: any[]): T => {
        innerDb.run('BEGIN TRANSACTION');
        try {
          const result = fn(...args);
          innerDb.run('COMMIT');
          return result;
        } catch (e) {
          innerDb.run('ROLLBACK');
          throw e;
        }
      };
    },
    close() {
      innerDb.close();
    },
    export() {
      return innerDb.export();
    },
  };
  return wrapper;
}

export async function getDb(): Promise<Database> {
  if (!db) {
    const SQL = await initSql();
    const dbDir = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'shuttle_system.db');

    let innerDb: SqlJsDatabase;
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      innerDb = new SQL.Database(buffer);
    } else {
      innerDb = new SQL.Database();
    }

    db = wrapDatabase(innerDb);
    db.pragma('foreign_keys = ON');
    innerDbRef = innerDb;
    dbPathRef = dbPath;
    initTables(db);
    initSeedData(db);
    saveDb(dbPath, innerDb);

    setInterval(() => {
      try {
        saveDb(dbPath, innerDb);
      } catch (e) {
        console.error('Failed to save DB:', e);
      }
    }, 30000);
  }
  return db;
}

function saveDb(dbPath: string, innerDb: SqlJsDatabase) {
  const data = innerDb.export();
  const buffer = Buffer.from(data);
  const tempPath = dbPath + '.tmp';
  fs.writeFileSync(tempPath, buffer);
  fs.renameSync(tempPath, dbPath);
}

function initTables(database: Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      position TEXT,
      phone TEXT,
      credit_score INTEGER DEFAULT 100,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      license_no TEXT,
      license_type TEXT,
      status TEXT DEFAULT 'off_duty',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate_no TEXT UNIQUE NOT NULL,
      model TEXT,
      capacity INTEGER DEFAULT 30,
      mileage REAL DEFAULT 0,
      last_maintenance_date TEXT,
      next_maintenance_mileage REAL DEFAULT 5000,
      status TEXT DEFAULT 'idle',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_no TEXT UNIQUE NOT NULL,
      route_name TEXT NOT NULL,
      direction TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS route_stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      station_name TEXT NOT NULL,
      station_address TEXT,
      sequence INTEGER NOT NULL,
      estimated_arrival_time TEXT,
      FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_no TEXT UNIQUE NOT NULL,
      route_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      driver_id INTEGER NOT NULL,
      departure_time TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      actual_departure_time TEXT,
      actual_arrival_time TEXT,
      passenger_count INTEGER DEFAULT 0,
      passenger_confirmed INTEGER DEFAULT 0,
      passenger_confirmed_at TEXT,
      current_station_id INTEGER,
      current_station_seq INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS schedule_station_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      station_id INTEGER NOT NULL,
      station_seq INTEGER NOT NULL,
      planned_arrival_time TEXT,
      actual_arrival_time TEXT,
      actual_departure_time TEXT,
      boarded_count INTEGER DEFAULT 0,
      absent_count INTEGER DEFAULT 0,
      is_delayed INTEGER DEFAULT 0,
      delay_minutes INTEGER DEFAULT 0,
      delay_alerted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ride_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_no TEXT UNIQUE NOT NULL,
      employee_id INTEGER NOT NULL,
      schedule_id INTEGER,
      route_id INTEGER NOT NULL,
      station_id INTEGER NOT NULL,
      ride_date TEXT NOT NULL,
      ride_time TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      seat_no INTEGER,
      ticket_code TEXT,
      rejection_reason TEXT,
      is_waitlist INTEGER DEFAULT 0,
      waitlist_order INTEGER,
      rescheduled_from INTEGER,
      reschedule_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_no TEXT UNIQUE NOT NULL,
      vehicle_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      mileage_triggered REAL,
      team_id INTEGER,
      status TEXT DEFAULT 'pending',
      parts_used TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS spare_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_no TEXT UNIQUE NOT NULL,
      part_name TEXT NOT NULL,
      category TEXT,
      stock INTEGER DEFAULT 0,
      safety_stock INTEGER DEFAULT 10,
      unit_price REAL DEFAULT 0,
      supplier TEXT
    );

    CREATE TABLE IF NOT EXISTS maintenance_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_name TEXT NOT NULL,
      leader TEXT,
      phone TEXT,
      members TEXT
    );

    CREATE TABLE IF NOT EXISTS driver_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      driver_id INTEGER NOT NULL,
      old_driver_id INTEGER,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approver TEXT,
      approved_at TEXT,
      rejection_reason TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      level TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      related_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS monthly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_month TEXT UNIQUE NOT NULL,
      department_stats TEXT,
      vehicle_utilization TEXT,
      overall_on_time_rate REAL,
      overall_commute_rate REAL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS station_absent_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      station_log_id INTEGER NOT NULL,
      station_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      request_id INTEGER NOT NULL,
      revoked INTEGER DEFAULT 0,
      revoked_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (station_log_id) REFERENCES schedule_station_logs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS credit_score_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      score_change INTEGER NOT NULL,
      new_score INTEGER NOT NULL,
      reason TEXT NOT NULL,
      related_type TEXT,
      related_id INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
}

function initSeedData(database: Database) {
  const employeeCount = database.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number };
  if (!employeeCount || employeeCount.count === 0) {
    const insertEmployee = database.prepare(
      'INSERT INTO employees (employee_no, name, department, position, phone, credit_score) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const employees = [
      ['E001', '张三', '技术部', '高级工程师', '13800138001', 100],
      ['E002', '李四', '技术部', '工程师', '13800138002', 95],
      ['E003', '王五', '市场部', '经理', '13800138003', 90],
      ['E004', '赵六', '人事部', '专员', '13800138004', 100],
      ['E005', '钱七', '财务部', '会计', '13800138005', 85],
      ['E006', '孙八', '技术部', '架构师', '13800138006', 100],
      ['E007', '周九', '运营部', '运营主管', '13800138007', 92],
      ['E008', '吴十', '市场部', '销售', '13800138008', 88],
    ];
    const tx = database.transaction((emps: string[][]) => {
      for (const emp of emps) insertEmployee.run(...emp);
    });
    tx(employees);

    const insertDriver = database.prepare(
      'INSERT INTO drivers (driver_no, name, phone, license_no, license_type, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const drivers = [
      ['D001', '陈师傅', '13900139001', 'A12345678', 'A1', 'on_duty'],
      ['D002', '刘师傅', '13900139002', 'A12345679', 'A1', 'on_duty'],
      ['D003', '王师傅', '13900139003', 'A12345680', 'A1', 'rest'],
    ];
    const tx2 = database.transaction((drs: string[][]) => {
      for (const dr of drs) insertDriver.run(...dr);
    });
    tx2(drivers);

    const insertVehicle = database.prepare(
      'INSERT INTO vehicles (plate_no, model, capacity, mileage, next_maintenance_mileage, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const vehicles = [
      ['京A12345', '宇通客车ZK6115', 45, 3200, 8200, 'idle'],
      ['京A12346', '宇通客车ZK6115', 45, 4800, 9800, 'running'],
      ['京A12347', '金龙客车XMQ6117', 39, 6500, 11500, 'idle'],
      ['京A12348', '金龙客车XMQ6117', 39, 1200, 6200, 'maintenance'],
    ];
    const tx3 = database.transaction((vhs: (string | number)[][]) => {
      for (const vh of vhs) insertVehicle.run(...vh);
    });
    tx3(vehicles);

    const insertRoute = database.prepare(
      'INSERT INTO routes (route_no, route_name, direction) VALUES (?, ?, ?)'
    );
    const routes = [
      ['R001', '中关村线(上班)', 'to_company'],
      ['R002', '中关村线(下班)', 'from_company'],
      ['R003', '望京线(上班)', 'to_company'],
      ['R004', '望京线(下班)', 'from_company'],
    ];
    const tx4 = database.transaction((rts: string[][]) => {
      for (const rt of rts) insertRoute.run(...rt);
    });
    tx4(routes);

    const insertStation = database.prepare(
      'INSERT INTO route_stations (route_id, station_name, station_address, sequence, estimated_arrival_time) VALUES (?, ?, ?, ?, ?)'
    );
    const stations = [
      [1, '中关村地铁站', '海淀区中关村大街1号', 1, '07:30'],
      [1, '五道口地铁站', '海淀区成府路28号', 2, '07:40'],
      [1, '西二旗地铁站', '海淀区上地十街', 3, '07:55'],
      [1, '公司总部', '海淀区上地信息路8号', 4, '08:10'],
      [2, '公司总部', '海淀区上地信息路8号', 1, '18:00'],
      [2, '西二旗地铁站', '海淀区上地十街', 2, '18:15'],
      [2, '五道口地铁站', '海淀区成府路28号', 3, '18:30'],
      [2, '中关村地铁站', '海淀区中关村大街1号', 4, '18:40'],
      [3, '望京SOHO', '朝阳区望京街10号', 1, '07:30'],
      [3, '望京地铁站', '朝阳区广顺北大街', 2, '07:40'],
      [3, '来广营地铁站', '朝阳区来广营西路', 3, '07:55'],
      [3, '公司总部', '海淀区上地信息路8号', 4, '08:20'],
      [4, '公司总部', '海淀区上地信息路8号', 1, '18:00'],
      [4, '来广营地铁站', '朝阳区来广营西路', 2, '18:25'],
      [4, '望京地铁站', '朝阳区广顺北大街', 3, '18:40'],
      [4, '望京SOHO', '朝阳区望京街10号', 4, '18:50'],
    ];
    const tx5 = database.transaction((sts: (string | number)[][]) => {
      for (const st of sts) insertStation.run(...st);
    });
    tx5(stations);

    const insertSchedule = database.prepare(
      'INSERT INTO schedules (schedule_no, route_id, vehicle_id, driver_id, departure_time, date, status, passenger_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const today = new Date().toISOString().split('T')[0];
    const schedules = [
      ['S001', 1, 1, 1, '07:30', today, 'pending', 28],
      ['S002', 3, 2, 2, '07:30', today, 'departed', 35],
      ['S003', 2, 1, 1, '18:00', today, 'pending', 30],
      ['S004', 4, 3, 2, '18:00', today, 'pending', 25],
    ];
    const tx6 = database.transaction((schs: (string | number)[][]) => {
      for (const sch of schs) insertSchedule.run(...sch);
    });
    tx6(schedules);

    const insertPart = database.prepare(
      'INSERT INTO spare_parts (part_no, part_name, category, stock, safety_stock, unit_price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const parts = [
      ['P001', '机油滤清器', '发动机件', 50, 20, 35, '博世'],
      ['P002', '空气滤清器', '发动机件', 8, 20, 45, '曼牌'],
      ['P003', '刹车片', '制动系统', 30, 15, 280, '天合'],
      ['P004', '轮胎', '行走系统', 12, 8, 850, '米其林'],
      ['P005', '雨刮片', '车身件', 5, 10, 65, '法雷奥'],
    ];
    const tx7 = database.transaction((prts: (string | number)[][]) => {
      for (const prt of prts) insertPart.run(...prt);
    });
    tx7(parts);

    const insertTeam = database.prepare(
      'INSERT INTO maintenance_teams (team_name, leader, phone, members) VALUES (?, ?, ?, ?)'
    );
    const teams = [
      ['一班', '郑班长', '13700137001', '郑班长,冯师傅,蒋师傅'],
      ['二班', '沈班长', '13700137002', '沈班长,韩师傅,杨师傅'],
    ];
    const tx8 = database.transaction((tms: string[][]) => {
      for (const tm of tms) insertTeam.run(...tm);
    });
    tx8(teams);

    const insertAlert = database.prepare(
      'INSERT INTO alerts (type, level, title, message, related_id) VALUES (?, ?, ?, ?, ?)'
    );
    const alerts = [
      ['stock', 'warning', '备件库存不足', '空气滤清器库存低于安全库存(当前8个，安全库存20个)', 2],
      ['stock', 'info', '备件库存预警', '雨刮片库存接近安全库存(当前5个，安全库存10个)', 5],
      ['maintenance', 'warning', '维保提醒', '车辆京A12346行驶里程已接近维保里程(4800/5000)', 2],
    ];
    const tx9 = database.transaction((alts: (string | number)[][]) => {
      for (const alt of alts) insertAlert.run(...alt);
    });
    tx9(alerts);

    const insertRequest = database.prepare(
      'INSERT INTO ride_requests (request_no, employee_id, schedule_id, route_id, station_id, ride_date, ride_time, direction, status, seat_no, ticket_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const requests = [
      ['REQ001', 1, 1, 1, 1, today, '07:30', 'to_company', 'approved', 1, 'TICKET-20240616-0001'],
      ['REQ002', 2, 1, 1, 2, today, '07:40', 'to_company', 'approved', 2, 'TICKET-20240616-0002'],
      ['REQ003', 3, 2, 3, 9, today, '07:30', 'to_company', 'approved', 5, 'TICKET-20240616-0003'],
      ['REQ004', 4, null, 1, 1, today, '07:30', 'to_company', 'pending', null, null],
    ];
    const tx10 = database.transaction((reqs: (string | number | null)[][]) => {
      for (const req of reqs) insertRequest.run(...req);
    });
    tx10(requests);
  }
}
