export type Department = {
  id: number;
  name: string;
  created_at: string;
};

export type IncidentType = {
  id: number;
  name: string;
  created_at: string;
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

export type PortalDocument = {
  id: number;
  category: string;
  title: string;
  description: string | null;
  file_url: string;
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
  incident_type_id: number;
  incident_type_name: string | null;
  consequences: string;
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

export type OrganizationProfile = {
  id: number;
  logo_url: string | null;
  hero_image_url: string | null;
  updated_at: string;
};
