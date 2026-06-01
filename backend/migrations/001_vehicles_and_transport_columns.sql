-- Создание таблицы автомобилей
CREATE TABLE IF NOT EXISTS vehicles (
  id            SERIAL PRIMARY KEY,
  make          VARCHAR(100) NOT NULL,
  model         VARCHAR(100) NOT NULL,
  license_plate VARCHAR(20)  NOT NULL,
  driver        VARCHAR(255),
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Добавление новых колонок в transport_requests
ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS vehicle_id INTEGER;
ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS position   VARCHAR(255);
ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS phone      VARCHAR(20);
