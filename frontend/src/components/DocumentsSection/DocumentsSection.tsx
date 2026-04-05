import { Button } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { fetchDocuments } from '../../Core/services/document.service';
import type { PortalDocument } from '../../Core/types/common';
import './DocumentsSection.scss';

const categories = ['Нормативные акты', 'Приказы', 'Инструкции и регламенты', 'Формы и шаблоны'];

export function DocumentsSection() {
  const [documents, setDocuments] = useState<PortalDocument[]>([]);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const data = await fetchDocuments();
        setDocuments(data);
      } catch {
        setDocuments([]);
      }
    };

    void loadDocuments();
  }, []);

  const groupedDocs = useMemo(
    () =>
      categories.map((category) => ({
        title: category,
        docs: documents.filter((doc) => doc.category === category),
      })),
    [documents],
  );

  return (
    <section id="documents" className="documents-section">
      <div className="documents-section__inner">
        <p className="documents-section__subtitle">
          Нормативные акты, приказы, инструкции, шаблоны для сотрудников учреждения
        </p>

        <div className="documents-section__grid">
          {groupedDocs.map((block) => (
            <article key={block.title} className="documents-section__card">
              <h4>{block.title}</h4>
              {block.docs.length > 0 ? (
                <ul>
                  {block.docs.map((doc) => (
                    <li key={doc.id}>
                      <div className="documents-section__doc-title">{doc.title}</div>
                      {doc.description ? <div className="documents-section__doc-desc">{doc.description}</div> : null}
                      <a href={toAbsoluteFileUrl(doc.file_url)} target="_blank" rel="noreferrer">
                        <Button>Скачать</Button>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="documents-section__empty">Пока нет документов</div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function toAbsoluteFileUrl(fileUrl: string): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
  const backendBase = apiUrl.replace(/\/api\/?$/, '');
  return `${backendBase}${fileUrl}`;
}
