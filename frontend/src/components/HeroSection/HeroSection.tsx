import { Button } from 'antd';

import { useAppStore } from '../../Core/store/app.store';
import './HeroSection.scss';

type HeroSectionProps = {
  onOpenIncidentModal: () => void;
  onOpenItRequestModal: () => void;
};

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:4000';

export function HeroSection({ onOpenIncidentModal, onOpenItRequestModal }: HeroSectionProps) {
  const organization = useAppStore((state) => state.organization);

  const heroUrl = organization?.hero_image_url
    ? organization.hero_image_url.startsWith('http')
      ? organization.hero_image_url
      : `${API_BASE}${organization.hero_image_url}`
    : null;

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
        {heroUrl ? (
          <img
            src={heroUrl}
            alt="Главное изображение"
            className="hero-section__image-img"
          />
        ) : (
          <div className="hero-section__image-placeholder">Медицинская иллюстрация</div>
        )}
      </div>
    </section>
  );
}
