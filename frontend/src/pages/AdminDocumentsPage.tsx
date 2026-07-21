import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderAddOutlined,
  FolderOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, Form, Input, Modal, Space, Table, Tree, TreeSelect, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useState } from 'react';

import { formatDateTime } from '../Core/date.utils';
import {
  buildFolderTree,
  createFolder,
  deleteFolder,
  fetchFolders,
  getFolderPath,
  updateFolder,
  type FolderNode,
} from '../Core/services/documentFolder.service';
import {
  createDocument,
  deleteDocument,
  fetchDocuments,
  updateDocument,
} from '../Core/services/document.service';
import { useAppStore } from '../Core/store/app.store';
import type { DocumentFolder, PortalDocument } from '../Core/types/common';
import './AdminDocumentsPage.scss';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:4000';

type DocFormValues = {
  title: string;
  description?: string;
  folder_id: number;
};

type FolderFormValues = {
  name: string;
};

export function AdminDocumentsPage() {
  const token = useAppStore((state) => state.token);

  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [docModalOpen, setDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<PortalDocument | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submittingDoc, setSubmittingDoc] = useState(false);
  const [docForm] = Form.useForm<DocFormValues>();

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderModalTitle, setFolderModalTitle] = useState('Новый раздел');
  const [editingFolder, setEditingFolder] = useState<DocumentFolder | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(null);
  const [submittingFolder, setSubmittingFolder] = useState(false);
  const [folderForm] = Form.useForm<FolderFormValues>();

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const data = await fetchFolders();
      setFolders(data);
    } catch {
      message.error('Не удалось загрузить разделы');
    } finally {
      setLoadingFolders(false);
    }
  };

  const loadDocuments = async (folderId: number) => {
    setLoadingDocs(true);
    try {
      const data = await fetchDocuments(folderId);
      setDocuments(data);
    } catch {
      message.error('Не удалось загрузить документы');
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    void loadFolders();
  }, []);

  useEffect(() => {
    if (selectedFolderId != null) {
      void loadDocuments(selectedFolderId);
    } else {
      setDocuments([]);
    }
  }, [selectedFolderId]);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const breadcrumb = selectedFolderId != null ? getFolderPath(folders, selectedFolderId) : [];
  const treeData = buildTreeData(buildFolderTree(folders));

  const openCreateRootFolder = () => {
    setEditingFolder(null);
    setNewFolderParentId(null);
    setFolderModalTitle('Новый корневой раздел');
    folderForm.resetFields();
    setFolderModalOpen(true);
  };

  const openCreateSubFolder = (parentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(null);
    setNewFolderParentId(parentId);
    setFolderModalTitle('Новый подраздел');
    folderForm.resetFields();
    setFolderModalOpen(true);
  };

  const openRenameFolder = (folder: DocumentFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setNewFolderParentId(null);
    setFolderModalTitle('Переименовать раздел');
    folderForm.setFieldsValue({ name: folder.name });
    setFolderModalOpen(true);
  };

  const handleDeleteFolder = (folder: DocumentFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    Modal.confirm({
      title: 'Удалить раздел?',
      content: `Раздел "${folder.name}" и все вложенные разделы и документы будут удалены.`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteFolder(folder.id, { token });
          message.success('Раздел удален');
          if (selectedFolderId === folder.id) {
            setSelectedFolderId(null);
          }
          await loadFolders();
        } catch {
          message.error('Не удалось удалить раздел');
        }
      },
    });
  };

  const onSubmitFolder = async (values: FolderFormValues) => {
    if (!token) return;
    setSubmittingFolder(true);
    try {
      if (editingFolder) {
        await updateFolder(editingFolder.id, { name: values.name }, { token });
        message.success('Раздел переименован');
      } else {
        await createFolder({ name: values.name, parent_id: newFolderParentId }, { token });
        message.success('Раздел создан');
      }
      setFolderModalOpen(false);
      folderForm.resetFields();
      await loadFolders();
    } catch {
      message.error('Не удалось сохранить раздел');
    } finally {
      setSubmittingFolder(false);
    }
  };

  const openCreateDoc = () => {
    setEditingDoc(null);
    docForm.resetFields();
    if (selectedFolderId != null) {
      docForm.setFieldValue('folder_id', selectedFolderId);
    }
    setFileList([]);
    setDocModalOpen(true);
  };

  const openEditDoc = (doc: PortalDocument) => {
    setEditingDoc(doc);
    docForm.setFieldsValue({
      title: doc.title,
      description: doc.description ?? undefined,
      folder_id: doc.folder_id ?? undefined,
    });
    setFileList([]);
    setDocModalOpen(true);
  };

  const onSubmitDoc = async (values: DocFormValues) => {
    if (!token) return;
    if (!editingDoc && fileList.length === 0) {
      message.error('Выберите файл документа');
      return;
    }
    setSubmittingDoc(true);
    try {
      const payload = {
        folder_id: values.folder_id,
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        file: fileList[0]?.originFileObj,
      };

      if (editingDoc) {
        await updateDocument(editingDoc.id, payload, { token });
        message.success('Документ сохранён');
        // reload the folder that is currently shown
        const reloadFolderId = values.folder_id ?? selectedFolderId;
        if (reloadFolderId != null) {
          await loadDocuments(reloadFolderId);
        }
        // if document was moved to another folder, switch to it
        if (values.folder_id !== editingDoc.folder_id && values.folder_id != null) {
          setSelectedFolderId(values.folder_id);
        }
      } else {
        await createDocument(payload, { token });
        message.success('Документ добавлен');
        if (values.folder_id != null) {
          await loadDocuments(values.folder_id);
        }
      }

      setDocModalOpen(false);
      setEditingDoc(null);
      docForm.resetFields();
      setFileList([]);
    } catch {
      message.error('Не удалось сохранить документ');
    } finally {
      setSubmittingDoc(false);
    }
  };

  const handleDeleteDoc = (doc: PortalDocument) => {
    if (!token) return;
    Modal.confirm({
      title: 'Удалить документ?',
      content: `Документ "${doc.title}" будет удален.`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteDocument(doc.id, { token });
          message.success('Документ удален');
          if (selectedFolderId != null) {
            await loadDocuments(selectedFolderId);
          }
        } catch {
          message.error('Не удалось удалить документ');
        }
      },
    });
  };

  function buildTreeData(nodes: FolderNode[]): TreeNode[] {
    return nodes.map((node) => ({
      key: node.id,
      title: (
        <div className="folder-tree-node">
          <span className="folder-tree-node__name">{node.name}</span>
          <span className="folder-tree-node__actions" onClick={(e) => e.stopPropagation()}>
            <Button
              type="text"
              size="small"
              icon={<FolderAddOutlined />}
              title="Добавить подраздел"
              onClick={(e) => openCreateSubFolder(node.id, e)}
            />
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              title="Переименовать"
              onClick={(e) => openRenameFolder(node, e)}
            />
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              title="Удалить"
              danger
              onClick={(e) => handleDeleteFolder(node, e)}
            />
          </span>
        </div>
      ),
      icon: <FolderOutlined />,
      children: buildTreeData(node.children),
    }));
  }

  return (
    <section className="admin-documents-page">
      <div className="admin-documents-page__toolbar">
        <Button icon={<PlusOutlined />} onClick={openCreateRootFolder}>
          Добавить корневой раздел
        </Button>
        <Button onClick={() => void loadFolders()} loading={loadingFolders}>
          Обновить
        </Button>
      </div>

      <div className="admin-documents-page__body">
        <div className="admin-documents-page__tree-panel">
          <div className="admin-documents-page__tree-label">Разделы</div>
          {treeData.length === 0 && !loadingFolders ? (
            <div className="admin-documents-page__tree-empty">Нет разделов. Создайте первый.</div>
          ) : (
            <Tree
              treeData={treeData}
              showIcon
              selectedKeys={selectedFolderId != null ? [selectedFolderId] : []}
              onSelect={(keys) => {
                const id = keys[0];
                setSelectedFolderId(typeof id === 'number' ? id : null);
              }}
              defaultExpandAll
            />
          )}
        </div>

        <div className="admin-documents-page__content">
          {selectedFolder == null ? (
            <div className="admin-documents-page__placeholder">
              <FolderOutlined className="admin-documents-page__placeholder-icon" />
              <p>Выберите раздел слева, чтобы просмотреть его содержимое</p>
            </div>
          ) : (
            <>
              <div className="admin-documents-page__content-header">
                <div className="admin-documents-page__breadcrumb">
                  {breadcrumb.map((f, i) => (
                    <span key={f.id}>
                      {i > 0 && <span className="admin-documents-page__breadcrumb-sep"> / </span>}
                      <span
                        className={i === breadcrumb.length - 1 ? 'admin-documents-page__breadcrumb-current' : 'admin-documents-page__breadcrumb-link'}
                        onClick={() => i < breadcrumb.length - 1 && setSelectedFolderId(f.id)}
                      >
                        {f.name}
                      </span>
                    </span>
                  ))}
                </div>
                <Space>
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={openCreateDoc}
                  >
                    Добавить документ
                  </Button>
                </Space>
              </div>

              <Table
                rowKey="id"
                loading={loadingDocs}
                dataSource={documents}
                pagination={{ pageSize: 15 }}
                locale={{ emptyText: 'В этом разделе нет документов' }}
                columns={[
                  { title: 'Название', dataIndex: 'title', key: 'title' },
                  {
                    title: 'Описание',
                    dataIndex: 'description',
                    key: 'description',
                    ellipsis: true,
                    render: (v: string | null) => v ?? '—',
                  },
                  {
                    title: 'Файл',
                    dataIndex: 'file_url',
                    key: 'file_url',
                    width: 100,
                    render: (v: string) => (
                      <a href={`${API_BASE}${v}`} target="_blank" rel="noreferrer">
                        Открыть
                      </a>
                    ),
                  },
                  {
                    title: 'Дата',
                    dataIndex: 'created_at',
                    key: 'created_at',
                    width: 160,
                    render: (v: string) => formatDateTime(v),
                  },
                  {
                    title: '',
                    key: 'actions',
                    width: 90,
                    render: (_: unknown, record: PortalDocument) => (
                      <Space size={0}>
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => openEditDoc(record)}
                          title="Редактировать документ"
                        />
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteDoc(record)}
                          title="Удалить документ"
                        />
                      </Space>
                    ),
                  },
                ]}
              />
            </>
          )}
        </div>
      </div>

      <Modal
        title={folderModalTitle}
        open={folderModalOpen}
        onCancel={() => setFolderModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={folderForm} layout="vertical" onFinish={onSubmitFolder}>
          <Form.Item name="name" label="Название раздела" rules={[{ required: true, message: 'Введите название' }]}>
            <Input autoFocus />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submittingFolder} block>
            {editingFolder ? 'Сохранить' : 'Создать'}
          </Button>
        </Form>
      </Modal>

      <Modal
        title={editingDoc ? 'Редактировать документ' : 'Добавить документ'}
        open={docModalOpen}
        onCancel={() => {
          setDocModalOpen(false);
          setEditingDoc(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={docForm} layout="vertical" onFinish={onSubmitDoc}>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="folder_id"
            label="Раздел"
            rules={[{ required: true, message: 'Выберите раздел' }]}
          >
            <TreeSelect
              treeData={buildSelectTreeData(buildFolderTree(folders))}
              placeholder="Выберите раздел"
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>
          <Form.Item label={editingDoc ? 'Файл (оставьте пустым, чтобы не менять)' : 'Файл'} required={!editingDoc}>
            <Upload
              fileList={fileList}
              maxCount={1}
              beforeUpload={() => false}
              onChange={({ fileList: newList }) => setFileList(newList)}
              accept=".pdf,.doc,.docx,.xls,.xlsx"
            >
              <Button icon={<UploadOutlined />}>Выбрать файл</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submittingDoc} block>
            {editingDoc ? 'Сохранить изменения' : 'Добавить'}
          </Button>
        </Form>
      </Modal>
    </section>
  );
}

type TreeNode = {
  key: number;
  title: React.ReactNode;
  icon: React.ReactNode;
  children: TreeNode[];
};

type SelectTreeNode = {
  value: number;
  title: string;
  children: SelectTreeNode[];
};

function buildSelectTreeData(nodes: FolderNode[]): SelectTreeNode[] {
  return nodes.map((node) => ({
    value: node.id,
    title: node.name,
    children: buildSelectTreeData(node.children),
  }));
}
