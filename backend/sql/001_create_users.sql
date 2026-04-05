CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL CHECK (
    role IN (
      'Главный врач',
      'Администратор',
      'Контроль качества',
      'ИТ отдел',
      'АХЧ отдел',
      'Metrolog',
      'Сотрудник'
    )
  ),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
