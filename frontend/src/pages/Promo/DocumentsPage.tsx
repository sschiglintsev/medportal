import { ArrowLeftOutlined, FileTextOutlined, FolderOutlined } from '@ant-design/icons';
import { Breadcrumb, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchDocuments } from '../../Core/services/document.service';
import {
  buildFolderTree,
  fetchFolders,
  getFolderPath,
  type FolderNode,
} from '../../Core/services/documentFolder.service';
import type { DocumentFolder, PortalDocument } from '../../Core/types/common';
import { Footer } from '../../components/Footer/Footer';
import { Header } from '../../components/Header/Header';
import './DocumentsPage.scss';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:4000';

export function DocumentsPage() {
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchFolders();
        setFolders(data);
      } catch {
        setFolders([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (currentFolderId == null) {
      setDocuments([]);
      return;
    }
    const load = async () => {
      setDocsLoading(true);
      try {
        const data = await fetchDocuments(currentFolderId);
        setDocuments(data);
      } catch {
        setDocuments([]);
      } finally {
        setDocsLoading(false);
      }
    };
    void load();
  }, [currentFolderId]);

  const tree = buildFolderTree(folders);
  const currentChildren: FolderNode[] =
    currentFolderId == null
      ? tree
      : (buildFolderTree(folders, currentFolderId) as FolderNode[]);

  const breadcrumbPath: DocumentFolder[] =
    currentFolderId != null ? getFolderPath(folders, currentFolderId) : [];

  const breadcrumbItems = [
    {
      key: 'root',
      title: (
        <span
          className={currentFolderId == null ? 'docs-page__crumb-active' : 'docs-page__crumb-link'}
          onClick={() => setCurrentFolderId(null)}
        >
          Документы
        </span>
      ),
    },
    ...breadcrumbPath.map((f) => ({
      key: String(f.id),
      title: (
        <span
          className={f.id === currentFolderId ? 'docs-page__crumb-active' : 'docs-page__crumb-link'}
          onClick={() => setCurrentFolderId(f.id)}
        >
          {f.name}
        </span>
      ),
    })),
  ];

  return (
    <div className="docs-page">
      <Header />
      <main className="docs-page__main">
        <div className="docs-page__inner">
          <div className="docs-page__top">
            <Link to="/" className="docs-page__back">
              <ArrowLeftOutlined /> На главную
            </Link>
            <Breadcrumb items={breadcrumbItems} className="docs-page__breadcrumb" />
          </div>

          <h1 className="docs-page__heading">
            {currentFolderId == null
              ? 'Документы'
              : folders.find((f) => f.id === currentFolderId)?.name ?? 'Документы'}
          </h1>

          {loading ? (
            <div className="docs-page__spinner">
              <Spin size="large" />
            </div>
          ) : (
            <>
              {currentChildren.length > 0 && (
                <div className="docs-page__folders">
                  {currentChildren.map((folder) => (
                    <button
                      key={folder.id}
                      className="docs-page__folder-card"
                      onClick={() => setCurrentFolderId(folder.id)}
                    >
                      <FolderOutlined className="docs-page__folder-icon" />
                      <span className="docs-page__folder-name">{folder.name}</span>
                      {folder.children.length > 0 && (
                        <span className="docs-page__folder-meta">
                          {folder.children.length} подразд.
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {currentFolderId != null && (
                <div className="docs-page__documents">
                  {docsLoading ? (
                    <Spin />
                  ) : documents.length === 0 && currentChildren.length === 0 ? (
                    <div className="docs-page__empty">В этом разделе пока нет документов</div>
                  ) : documents.length > 0 ? (
                    <>
                      <h3 className="docs-page__docs-title">Документы раздела</h3>
                      <div className="docs-page__doc-list">
                        {documents.map((doc) => (
                          <a
                            key={doc.id}
                            href={`${API_BASE}${doc.file_url}`}
                            target="_blank"
                            rel="noreferrer"
                            download={doc.original_filename ?? true}
                            className="docs-page__doc-item"
                          >
                            <FileTextOutlined className="docs-page__doc-icon" />
                            <div className="docs-page__doc-info">
                              <div className="docs-page__doc-name">{doc.title}</div>
                              {doc.description && (
                                <div className="docs-page__doc-desc">{doc.description}</div>
                              )}
                            </div>
                            <span className="docs-page__doc-download">Открыть</span>
                          </a>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {currentFolderId == null && currentChildren.length === 0 && (
                <div className="docs-page__empty">Разделы документов пока не добавлены</div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
