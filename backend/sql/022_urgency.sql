-- Справочник уровней срочности
CREATE TABLE IF NOT EXISTS urgency_levels (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  days INTEGER     NOT NULL
);

INSERT INTO urgency_levels (name, days) VALUES
  ('1 день',    1),
  ('2 дня',     2),
  ('3 дня',     3),
  ('Неделя',    7),
  ('Две недели',14),
  ('Месяц',     30)
ON CONFLICT DO NOTHING;

-- Добавляем поле срочности в ИТ и АХЧ заявки (nullable — старые записи останутся NULL)
ALTER TABLE it_requests   ADD COLUMN IF NOT EXISTS urgency_id INTEGER REFERENCES urgency_levels(id);
ALTER TABLE ahch_requests ADD COLUMN IF NOT EXISTS urgency_id INTEGER REFERENCES urgency_levels(id);
