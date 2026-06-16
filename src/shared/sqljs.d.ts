declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
  }

  export interface SqlJsDatabase {
    run(sql: string, params?: any[]): void;
    exec(sql: string, params?: any[]): { columns: string[]; values: any[][] }[];
    prepare(sql: string): SqlJsStatement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  export interface SqlJsStatement {
    bind(params?: any[]): boolean;
    step(): boolean;
    get(params?: any[]): any[];
    getAsObject(params?: any[]): Record<string, any>;
    getColumnNames(): string[];
    free(): boolean;
    reset(): void;
  }

  export interface InitSqlJsOptions {
    locateFile?: (file: string) => string;
  }

  const initSqlJs: (options?: InitSqlJsOptions) => Promise<SqlJsStatic>;
  export default initSqlJs;
}
