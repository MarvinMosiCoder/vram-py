import type { CSSProperties, ReactNode } from "react";

export type FieldValue = string | number;
export type FormValues = Record<string, FieldValue>;
export type SelectOption = { value: FieldValue; label: string };
export type FormField = {
  label?: string; type: string; required?: boolean; max?: number;
  options?: SelectOption[];
};
export type ModuleRow = {
  [key: string]: unknown;
  __rowIndex?: Record<string, { label?: unknown; className?: string; style?: CSSProperties }>;
};
export type ModuleColumn = { key: string; label: string };
export type ActionDescriptor = {
  label?: string; title?: string; icon?: string; iconAction?: string; action?: string;
  url?: string; method?: string; confirm?: string; newTab?: boolean; reload?: boolean;
  visible?: boolean; visibleWhen?: Record<string, unknown>;
  payload?: Record<string, unknown> | ((row: ModuleRow) => Record<string, unknown>);
  onClick?: (reload: () => void) => void;
};
export type Capability = boolean | number | string | ActionDescriptor | null;
export type BulkOption = { value: string; label: string; confirmTitle?: string };
export type ModuleData = {
  module: { name: string; path: string; icon?: string };
  tableName: string; primaryKey: string; columns: ModuleColumn[]; rows: ModuleRow[];
  pagination: { page: number; per_page: number; total: number; last_page: number };
  formFields: Record<string, FormField>;
  actions: Record<string, Capability>;
  moduleAccess: Record<string, boolean>;
  indexButtons?: Record<string, boolean>;
  customRowActions?: ActionDescriptor[]; customIndexButtons?: ActionDescriptor[];
  customBulkActions?: BulkOption[]; bulkActions?: boolean;
  useAddRoute?: boolean; useEditRoute?: boolean;
  pageMode?: "create" | "edit" | null; editRow?: ModuleRow | null;
};
export type ToastStatus = "success" | "error" | "warning" | "info" | "danger" | "default";
export type Panel = {
  mode: "view" | "create" | "edit"; row: ModuleRow | null; values: FormValues;
  errors: Record<string, string>; busy?: boolean;
};
export type FormContext = Panel & {
  data: ModuleData; setValue: (name: string, value: FieldValue) => void;
  close: () => void; reload: () => void; toast: (message: unknown, status?: ToastStatus) => void;
};
export type GeneratedModuleProps = {
  modulePath: string; action?: "add" | "edit"; recordId?: string; title?: string;
  renderCell?: (row: ModuleRow, column: ModuleColumn, defaultCell: (row: ModuleRow, column: ModuleColumn) => ReactNode) => ReactNode;
  renderBeforeTable?: (data: ModuleData) => ReactNode; renderAfterTable?: (data: ModuleData) => ReactNode;
  indexButtons?: Record<string, boolean>; actions?: Record<string, boolean>; moduleAccess?: Record<string, boolean>;
  bulkActions?: boolean; useAddRoute?: boolean; useEditRoute?: boolean;
  customIndexButtons?: ActionDescriptor[]; customRowActions?: ActionDescriptor[];
  customIndexButtonHandlers?: Record<string, (button: ActionDescriptor) => void>;
  customRowActionHandlers?: Record<string, (button: ActionDescriptor, row: ModuleRow) => void | Promise<void>>;
  renderFormField?: (name: string, config: FormField, context: FormContext) => ReactNode;
  renderBeforeForm?: (context: FormContext) => ReactNode; renderAfterForm?: (context: FormContext) => ReactNode;
  renderFormActions?: (context: FormContext) => ReactNode; hideDefaultFormSubmit?: boolean;
  buildSubmitPayload?: (values: FormValues, context: FormContext) => Record<string, unknown>;
  onFormSubmit?: (context: FormContext) => void | Promise<void>;
  onToast?: (message: unknown, status: ToastStatus) => void;
};
