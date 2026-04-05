import { Button, Statistic } from 'antd';

import './HeroSection.scss';

type HeroSectionProps = {
  onOpenIncidentModal: () => void;
  onOpenItRequestModal: () => void;
};

export function HeroSection({ onOpenIncidentModal, onOpenItRequestModal }: HeroSectionProps) {
  return (
    <section id="hero" className="hero-section">
      <div className="hero-section__content">
        <h1>Медицинский портал</h1>
        <h2>Внутренняя система для сотрудников</h2>
        <h2>ГБУЗ РБ ГДКБ №17 гор. Уфа</h2>
        <p>Обращения, инциденты, объявления и документы  — всё в одном месте.</p>

        <div className="hero-section__buttons">
          <Button type="primary" onClick={onOpenIncidentModal}>
            Сообщить о нежелательном событии
          </Button>
          <Button onClick={onOpenItRequestModal}>Заявка в отдел ИТ</Button>
          <Button>Заявка в АХЧ</Button>
          <Button>Заявка метрологу</Button>
        </div>
      </div>

      <div className="hero-section__image">
        <div className="hero-section__image-placeholder">Медицинская иллюстрация</div>
      </div>
    </section>
  );
}
