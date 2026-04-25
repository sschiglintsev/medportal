CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  incident_date DATE NOT NULL,
  incident_time TIME NOT NULL,
  place VARCHAR(255) NOT NULL,
  patient_fio VARCHAR(255) NOT NULL,
  patient_birth_date DATE NOT NULL,
  circumstances TEXT NOT NULL,
  employee_fio VARCHAR(255) NOT NULL,
  employee_position VARCHAR(255) NOT NULL,
  legal_presence VARCHAR(100) NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  incident_type_id INTEGER NOT NULL REFERENCES incident_types(id) ON DELETE RESTRICT,
  consequences TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
