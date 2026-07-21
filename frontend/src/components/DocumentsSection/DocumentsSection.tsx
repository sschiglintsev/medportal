import { FileTextOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

import './DocumentsSection.scss';

export function DocumentsSection() {
  return (
    <section id="documents" className="documents-section">
      <div className="documents-section__inner">
        <div className="documents-section__icon">
          <FileTextOutlined />
        </div>
        <h2 className="documents-section__title">Документы</h2>
        <p className="documents-section__desc">
          Нормативные акты, приказы, инструкции, регламенты и шаблоны для сотрудников учреждения
        </p>
        <Link to="/documents" className="documents-section__btn">
          Перейти к документам
        </Link>
      </div>
    </section>
  );
}
