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
  sort_order: number;
  created_at: string;
  updated_at: string;
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
