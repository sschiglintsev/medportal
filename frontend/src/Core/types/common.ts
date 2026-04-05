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
};

export type AuthResponse = {
  token: string;
  user: User;
};
