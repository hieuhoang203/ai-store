export type AdminFieldType =
  | 'uuid'
  | 'string'
  | 'text'
  | 'int'
  | 'bigint'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'json'
  | 'enum';

export interface AdminEnumOption {
  label: string;
  value: string | number | boolean;
}

export interface AdminFieldConfig {
  name: string;
  label: string;
  type: AdminFieldType;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  list?: boolean;
  create?: boolean;
  update?: boolean;
  options?: AdminEnumOption[];
}

export interface AdminEntityConfig {
  key: string;
  label: string;
  delegate: string;
  idField?: string;
  compositeIdFields?: string[];
  compoundWhereName?: string;
  softDelete?: boolean;
  defaultSort?: string;
  searchableFields?: string[];
  fields: AdminFieldConfig[];
}

export interface AdminEntitySummary extends AdminEntityConfig {
  count: number;
}

export interface AdminListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

export interface AdminListResult<T = unknown> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
