export type FieldType =
  | "uuid"
  | "string"
  | "text"
  | "int"
  | "bigint"
  | "decimal"
  | "boolean"
  | "date"
  | "json"
  | "enum";

export type FieldConfig = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  list?: boolean;
  create?: boolean;
  update?: boolean;
  options?: { label: string; value: string | number | boolean }[];
};

export type EntityConfig = {
  key: string;
  label: string;
  softDelete?: boolean;
  count?: number;
  defaultSort?: string;
  fields: FieldConfig[];
};

export type ListResponse = {
  data: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type Dashboard = {
  cards: Record<string, string | number>;
  inventoryByStatus: { status: number; _count: { status: number } }[];
  ordersByStatus: { status: number | null; _count: { status: number } }[];
  recentOrders: Record<string, unknown>[];
  recentTickets: Record<string, unknown>[];
};

export type Toast = { id: number; type: "success" | "error"; message: string };

export type ModalState =
  | { type: "create" }
  | { type: "edit"; record: Record<string, unknown> }
  | { type: "detail"; record: Record<string, unknown> }
  | null;

export type FormValues = Record<string, string | boolean>;
