CREATE TABLE IF NOT EXISTS ahch_requests (
  id SERIAL PRIMARY KEY,
  address VARCHAR(500) NOT NULL,
  department VARCHAR(255) NOT NULL,
  request_text TEXT NOT NULL,
  employee_phone VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
