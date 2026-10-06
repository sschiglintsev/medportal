import { ArrowLeftOutlined, FileTextOutlined, FolderOutlined } from '@ant-design/icons';
import { Breadcrumb, Select, Space, Spin, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDate } from '../../Core/date.utils';
import { fetchCalibrationSchedule } from '../../Core/services/calibration-schedule.service';
import { fetchDocuments } from '../../Core/services/document.service';
import { fetchDepartments } from '../../Core/services/incident.service';
import {
  buildFolderTree,
  fetchFolders,
  getFolderPath,
  type FolderNode,
} from '../../Core/services/documentFolder.service';
import type { CalibrationScheduleItem, Department, DocumentFolder, PortalDocument } from '../../Core/types/common';
import {
  CALIBRATION_SORT_OPTIONS,
  sortCalibrationItems,
  type CalibrationSortKey,
} from '../../Core/utils/calibrationSchedule.view';
import { Footer } from '../../components/Footer/Footer';
import { Header } from '../../components/Header/Header';
import './DocumentsPage.scss';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:4000';

const CALIBRATION_COLUMNS: ColumnsType<CalibrationScheduleItem> = [
  {
    title: 'Дата ввода в эксплуатацию',
    dataIndex: 'commissioning_date',
    width: 88,
    render: (value: string | null) => (value ? formatDate(value) : '—'),
  },
  { title: 'Номенклатура (наименование)', dataIndex: 'nomenclature', width: 140 },
  { title: 'Тип', dataIndex: 'type', width: 80, render: (value: string | null) => value ?? '—' },
  {
    title: 'Инвентарный номер',
    dataIndex: 'inventory_number',
    width: 96,
    render: (value: string | null) => value ?? '—',
  },
  {
    title: 'Заводской номер',
    dataIndex: 'serial_number',
    width: 88,
    render: (value: string | null) => value ?? '—',
  },
  {
    title: 'Дата выпуска',
    dataIndex: 'manufacture_date',
    width: 78,
    render: (value: string | null) => (value ? formatDate(value) : '—'),
  },
  {
    title: 'Отделение',
    dataIndex: 'department_name',
    width: 110,
    render: (value: string | null) => value ?? '—',
  },
  { title: 'Кол-во', dataIndex: 'quantity', width: 54, render: (value: number | null) => value ?? '—' },
  {
    title: 'Поверка, МКС, ПИ',
    dataIndex: 'verification_kind',
    width: 78,
    render: (value: string | null) => value ?? '—',
  },
  {
    title: 'Дата действующей поверки, МКС или ПИ',
    dataIndex: 'current_verification_date',
    width: 96,
    render: (value: string | null) => (value ? formatDate(value) : '—'),
  },
  {
    title: 'Дата следующей поверки, МКС или ПИ',
    dataIndex: 'next_verification_date',
    width: 96,
    render: (value: string | null) => (value ? formatDate(value) : '—'),
  },
  {
    title: 'Примечание',
    dataIndex: 'note',
    width: 90,
    render: (value: string | null) => value ?? '—',
  },
];

function CalibrationSchedulePublicTable() {
  const [items, setItems] = useState<CalibrationScheduleItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<CalibrationSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [data, departmentList] = await Promise.all([
          fetchCalibrationSchedule(),
          fetchDepartments(),
        ]);
        setItems(data);
        setDepartments(departmentList);
      } catch {
        setItems([]);
        setDepartments([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    const next = departmentId == null
      ? items
      : items.filter((item) => item.department_id === departmentId);
    return sortCalibrationItems(next, sortKey, sortDirection);
  }, [items, departmentId, sortKey, sortDirection]);

  return (
    <div className="docs-page__schedule">
      <Space wrap className="docs-page__schedule-toolbar">
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Отделение"
          value={departmentId ?? undefined}
          onChange={(value) => setDepartmentId(value ?? null)}
          options={departments.map((department) => ({ value: department.id, label: department.name }))}
          style={{ minWidth: 260 }}
        />
        <Select
          allowClear
          placeholder="Сортировать по"
          value={sortKey ?? undefined}
          onChange={(value) => setSortKey(value ?? null)}
          options={CALIBRATION_SORT_OPTIONS}
          style={{ minWidth: 250 }}
        />
        <Select
          value={sortDirection}
          onChange={setSortDirection}
          options={[
            { value: 'asc', label: 'По возрастанию' },
            { value: 'desc', label: 'По убыванию' },
          ]}
          style={{ minWidth: 170 }}
        />
      </Space>
      <Table
        rowKey="id"
        size="small"
        className="docs-page__schedule-table"
        loading={loading}
        dataSource={filtered}
        columns={CALIBRATION_COLUMNS}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Всего: ${total}` }}
        tableLayout="fixed"
        locale={{ emptyText: 'График поверок пока не заполнен' }}
      />
    </div>
  );
}

export function DocumentsPage() {
  const [activeTab, setActiveTab] = useState('documents');
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

  const documentsContent = (
    <>
      {currentFolderId != null && (
        <div className="docs-page__top">
          <Breadcrumb items={breadcrumbItems} className="docs-page__breadcrumb" />
        </div>
      )}

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
                      <div key={doc.id} className="docs-page__doc-item">
                        <FileTextOutlined className="docs-page__doc-icon" />
                        <div className="docs-page__doc-info">
                          <div className="docs-page__doc-name">{doc.title}</div>
                          {doc.description && (
                            <div className="docs-page__doc-desc">{doc.description}</div>
                          )}
                        </div>
                        <div className="docs-page__doc-actions">
                          <a
                            href={`${API_BASE}${doc.file_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="docs-page__doc-btn docs-page__doc-btn--open"
                          >
                            Открыть
                          </a>
                          <a
                            href={`${API_BASE}${doc.file_url}`}
                            download={doc.original_filename ?? true}
                            className="docs-page__doc-btn docs-page__doc-btn--download"
                          >
                            Скачать
                          </a>
                        </div>
                      </div>
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
    </>
  );

  return (
    <div className="docs-page">
      <Header />
      <main className="docs-page__main">
        <div className="docs-page__inner">
          <div className="docs-page__top">
            <Link to="/" className="docs-page__back">
              <ArrowLeftOutlined /> На главную
            </Link>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            className="docs-page__tabs"
            items={[
              { key: 'documents', label: 'Документы', children: documentsContent },
              {
                key: 'calibrations',
                label: 'График поверок МКС и ПИ',
                children: (
                  <>
                    <h1 className="docs-page__heading">График поверок МКС и ПИ</h1>
                    <CalibrationSchedulePublicTable />
                  </>
                ),
              },
            ]}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
