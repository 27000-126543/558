import { getDb } from '../database';
import type { Route, RouteStation, ApiResponse } from '../../shared/types';

function rowToRoute(row: any, stations?: any[]): Route {
  return {
    id: row.id,
    routeNo: row.route_no,
    routeName: row.route_name,
    direction: row.direction,
    stations: stations ? stations.map(rowToStation) : [],
    createdAt: row.created_at,
  };
}

function rowToStation(row: any): RouteStation {
  return {
    id: row.id,
    stationName: row.station_name,
    stationAddress: row.station_address,
    sequence: row.sequence,
    estimatedArrivalTime: row.estimated_arrival_time,
  };
}

export async function getAllRoutes(): Promise<ApiResponse<Route[]>> {
  try {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM routes ORDER BY route_no').all() as any[];
    const result: Route[] = [];
    for (const row of rows) {
      const stations = db.prepare('SELECT * FROM route_stations WHERE route_id = ? ORDER BY sequence').all(row.id);
      result.push(rowToRoute(row, stations));
    }
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRouteById(id: number): Promise<ApiResponse<Route | null>> {
  try {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM routes WHERE id = ?').get(id);
    if (!row) return { success: true, data: null };
    const stations = db.prepare('SELECT * FROM route_stations WHERE route_id = ? ORDER BY sequence').all(id);
    return { success: true, data: rowToRoute(row, stations) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createRoute(data: { routeNo: string; routeName: string; direction: string; stations: Omit<RouteStation, 'id'>[] }): Promise<ApiResponse<Route>> {
  try {
    const db = await getDb();
    const insertRoute = db.prepare('INSERT INTO routes (route_no, route_name, direction) VALUES (?, ?, ?)');
    const insertStation = db.prepare(
      'INSERT INTO route_stations (route_id, station_name, station_address, sequence, estimated_arrival_time) VALUES (?, ?, ?, ?, ?)'
    );
    const tx = db.transaction(() => {
      const result = insertRoute.run(data.routeNo, data.routeName, data.direction);
      const routeId = result.lastInsertRowid as number;
      for (const station of data.stations) {
        insertStation.run(routeId, station.stationName, station.stationAddress, station.sequence, station.estimatedArrivalTime);
      }
      return routeId;
    });
    const routeId = tx();
    return (await getRouteById(routeId)) as ApiResponse<Route>;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateRoute(id: number, data: Partial<Route> & { stations?: Omit<RouteStation, 'id'>[] }): Promise<ApiResponse<Route>> {
  try {
    const db = await getDb();
    const fields: string[] = [];
    const values: any[] = [];
    if (data.routeNo !== undefined) { fields.push('route_no = ?'); values.push(data.routeNo); }
    if (data.routeName !== undefined) { fields.push('route_name = ?'); values.push(data.routeName); }
    if (data.direction !== undefined) { fields.push('direction = ?'); values.push(data.direction); }
    values.push(id);
    const tx = db.transaction(() => {
      if (fields.length > 0) {
        db.prepare(`UPDATE routes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      if (data.stations) {
        db.prepare('DELETE FROM route_stations WHERE route_id = ?').run(id);
        const insertStation = db.prepare(
          'INSERT INTO route_stations (route_id, station_name, station_address, sequence, estimated_arrival_time) VALUES (?, ?, ?, ?, ?)'
        );
        for (const station of data.stations) {
          insertStation.run(id, station.stationName, station.stationAddress, station.sequence, station.estimatedArrivalTime);
        }
      }
    });
    tx();
    return (await getRouteById(id)) as ApiResponse<Route>;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteRoute(id: number): Promise<ApiResponse<boolean>> {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM routes WHERE id = ?').run(id);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
