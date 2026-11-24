export type Department = {
  id: number;
  name: string;
  care_type: string | null;
  created_at: string;
};

export type IncidentType = {
  id: number;
  name: string;
  created_at: string;
};

export type IncidentViewType = {
  id: number;
  name: string;
  care_type: string;
  created_at: string;
  incident_types: { id: number; name: string }[];
};

export type Announcement = {
  id: number;
  title: string;
  description: string;
  full_description: string;
  image_url: string | null;
  published_date: string;
  created_at: string;
  updated_at: string;
};

export type DocumentFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  created_at: string;
};

export type PortalDocument = {
  id: number;
  folder_id: number | null;
  title: string;
  description: string | null;
  file_url: string;
  original_filename: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type UrgencyLevel = {
  id: number;
  name: string;
  days: number;
};

export type ItRequest = {
  id: number;
  full_name: string;
  phone: string;
  department: string;
  location: string;
  request_text: string;
  remote_access_id: string | null;
  status: string;
  comment: string | null;
  created_at: string;
  urgency_name: string | null;
  urgency_days: number | null;
};

export type CalibrationScheduleItem = {
  id: number;
  commissioning_date: string | null;
  nomenclature: string;
  name: string | null;
  type: string | null;
  inventory_number: string | null;
  serial_number: string | null;
  manufacture_date: string | null;
  department_id: number | null;
  department_name: string | null;
  quantity: number | null;
  verification_kind: string | null;
  current_verification_date: string | null;
  next_verification_date: string | null;
  note: string | null;
  created_at: string;
};

export type MetrologistRequest = {
  id: number;
  full_name: string;
  phone: string;
  department: string;
  location: string;
  request_text: string;
  status: string;
  comment: string | null;
  created_at: string;
};

export type AhchRequest = {
  id: number;
  address: string;
  department: string;
  request_text: string;
  employee_phone: string;
  status: string;
  comment: string | null;
  created_at: string;
  urgency_name: string | null;
  urgency_days: number | null;
};

export type Incident = {
  id: number;
  incident_date: string;
  incident_time: string;
  place: string;
  patient_fio: string;
  patient_birth_date: string;
  circumstances: string;
  employee_fio: string;
  employee_position: string;
  legal_presence: string;
  department_id: number;
  department_name: string | null;
  incident_view_type_id: number | null;
  incident_view_type_name: string | null;
  care_type: string | null;
  incident_type_id: number;
  incident_type_name: string | null;
  consequences: string;
  severity_level: string | null;
  status: string;
  created_at: string;
};

export type User = {
  id: number;
  fullName: string;
  role: string;
  roleTitle: string;
  permissions: RolePermissions;
  mustChangePassword?: boolean;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type RolePermissions = {
  canAccessCabinet: boolean;
  canAccessAdminCabinet: boolean;
  canAccessQualityCabinet: boolean;
  canAccessCabinetChief: boolean;
  canManageReferences: boolean;
  canManageDocuments: boolean;
  canViewIncidents: boolean;
  canViewItRequests: boolean;
  canManageItRequests: boolean;
  // Новые разрешения (добавлены миграцией 025)
  canManageEmployees?: boolean;
  canManageOwnJournals?: boolean;
  canManageAllJournals?: boolean;
  canManageJournalAccess?: boolean;
  // Модуль «Температурный лист» (миграция 028)
  canManageTempSheet?: boolean;
};

export type RoleOption = {
  id: number;
  title: string;
  value: string;
};

export type UserListItem = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  role_title: string;
  created_at: string;
};

export type Vehicle = {
  id: number;
  make: string;
  model: string;
  license_plate: string;
  driver: string | null;
  created_at: string;
};

export type TransportRequest = {
  id: number;
  department: string;
  initiator: string;
  position: string | null;
  phone: string | null;
  submission_date: string;
  submission_time: string;
  route_from: string;
  route_to: string;
  purpose: string;
  passenger_count: number;
  special_notes: string | null;
  status: string;
  comment: string | null;
  created_at: string;
  vehicle_id: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_license_plate: string | null;
  vehicle_driver: string | null;
};

export type OrganizationProfile = {
  id: number;
  logo_url: string | null;
  hero_image_url: string | null;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────
// Сотрудники
// ─────────────────────────────────────────────────────────────

export type EmployeeDepartmentAssignment = {
  id: number;
  name: string;
  position: string;
  is_active: boolean;
  dept_version?: number;
};

export type EmployeeItem = {
  id: number;
  username: string;
  full_name: string;
  role: string;
  role_title: string;
  is_active: boolean;
  employee_code: string | null;
  departments: EmployeeDepartmentAssignment[];
  created_at: string;
  must_change_password?: boolean;
  profile_version?: number;
};

export type EmployeeCredentials = {
  username: string;
  temporaryPassword: string;
};

// ─────────────────────────────────────────────────────────────
// Журналы
// ─────────────────────────────────────────────────────────────

export type JournalColumnType = 'text' | 'date' | 'confirmation';

export type JournalColumn = {
  id: string;
  journal_id: number;
  title: string;
  type: JournalColumnType;
  sort_order: number;
  /** Может ли сотрудник заполнять это поле при подтверждении строки */
  is_editable_by_employee: boolean;
};

export type JournalStatus = 'draft' | 'published' | 'archived';

export type Journal = {
  id: number;
  title: string;
  department_id: number;
  department_name: string;
  owner_user_id?: number;
  owner_name?: string;
  status: JournalStatus;
  version: number;
  schema_version?: number;
  first_published_at: string | null;
  created_at: string;
  updated_at: string;
  row_count?: number;
  columns?: JournalColumn[];
};

export type JournalRowConfirmation = {
  id: number;
  signer_full_name: string;
  signer_position: string | null;
  confirmed_at: string;
  status: 'active' | 'voided';
};

export type JournalRow = {
  id: number;
  sort_order: number;
  current_revision: number;
  values: Record<string, string | null>;
  created_at: string;
  updated_at: string;
  confirmation_id?: number;
  signer_full_name?: string;
  signer_position?: string;
  confirmed_at?: string;
  confirmation_status?: 'active' | 'voided';
};

export type DepartmentAccessEmployee = {
  user_id: number;
  full_name: string;
  position: string;
  has_access: boolean;
  granted_at?: string;
  revoked_at?: string;
};

// ─────────────────────────────────────────────────────────────
// Температурный лист
// ─────────────────────────────────────────────────────────────

export type TemperatureBand =
  | 'above41' | '40_409' | '39_399' | '38_389'
  | '37_379' | '36_369' | '35_359' | 'below35';

export const TEMP_BAND_LABELS: Record<TemperatureBand, string> = {
  above41: 'выше 41',
  '40_409': '40-40,9',
  '39_399': '39-39,9',
  '38_389': '38-38,9',
  '37_379': '37-37,9',
  '36_369': '36-36,9',
  '35_359': '35 -35,9',
  below35:  'ниже 35',
};

export const TEMP_BAND_ORDER: TemperatureBand[] = [
  'above41', '40_409', '39_399', '38_389',
  '37_379', '36_369', '35_359', 'below35',
];

export type TempSheetColumnData = {
  column_index: number;
  stay_day: string | null;
  observation_date: string | null;  // ISO date
  observation_time: string | null;  // HH:MM
  temperature_band: TemperatureBand | null;
  respiratory_rate: string | null;
  spo2: string | null;
  weight_kg: string | null;
  oral_fluid_ml: string | null;
  parenteral_fluid_ml: string | null;
  urine_volume_ml: string | null;
  stool: string | null;
};

export type Patient = {
  id: number;
  full_name: string;
  birth_date: string | null;  // ISO date
};

export type TempSheet = {
  id: number;
  patient_id: number;
  patient_name: string;
  birth_date: string | null;
  department_id: number;
  department_name: string;
  height_cm: number | null;
  created_at: string;
  updated_at: string;
  columns?: TempSheetColumnData[];
  can_edit?: boolean;
};

export type TempSheetAccessUser = {
  user_id: number;
  full_name: string;
  departments: string[] | null;
  has_access: boolean;
};
