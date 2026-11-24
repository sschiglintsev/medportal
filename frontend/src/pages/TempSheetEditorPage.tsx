import {
  ArrowLeftOutlined,
  ClearOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { Button, Modal, Space, Spin, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';

import { TempSheetForm } from '../components/TempSheetForm/TempSheetForm';
import {
  clearTempSheetAllColumns,
  clearTempSheetColumn,
  fetchTempSheet,
  updateTempSheetColumn,
  updateTempSheetHeader,
} from '../Core/services/temp-sheet.service';
import { useAppStore } from '../Core/store/app.store';
import type { TemperatureBand, TempSheet, TempSheetColumnData } from '../Core/types/common';
import {
  downloadTempSheetExcel,
  downloadTempSheetPdf,
  printTempSheetElement,
} from '../Core/utils/tempSheetExport';
import { emptyColumn, normalizeColumns } from '../Core/utils/tempSheetForm';
import './TempSheetsPage.scss';

const { Title, Text } = Typography;

type Props = {
  sheetId: number;
  onBack: () => void;
};

type SaveJob = () => Promise<void>;

export function TempSheetEditorPage({ sheetId, onBack }: Props) {
  const token = useAppStore((s) => s.token)!;

  const [sheet, setSheet] = useState<(TempSheet & { can_edit?: boolean }) | null>(null);
  const [columns, setColumns] = useState<TempSheetColumnData[]>([]);
  const [heightDraft, setHeightDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const printRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const enqueue = useCallback((job: SaveJob) => {
    setSaveState('saving');
    queueRef.current = queueRef.current
      .then(async () => {
        await job();
        setSaveState('saved');
      })
      .catch(() => {
        setSaveState('error');
        void message.error('Ошибка сохранения');
      });
    return queueRef.current;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTempSheet(token, sheetId);
      if (data.can_edit === false) {
        void message.warning('Редактирование недоступно');
        onBack();
        return;
      }
      setSheet(data);
      setColumns(normalizeColumns(data.columns));
      setHeightDraft(data.height_cm != null ? String(data.height_cm) : '');
    } catch {
      void message.error('Не удалось загрузить лист');
      onBack();
    } finally {
      setLoading(false);
    }
  }, [token, sheetId, onBack]);

  useEffect(() => {
    void load();
  }, [load]);

  const isColumnEmpty = (col: TempSheetColumnData): boolean => {
    return (
      !col.stay_day &&
      !col.observation_date &&
      !col.observation_time &&
      !col.temperature_band &&
      !col.respiratory_rate &&
      !col.spo2 &&
      !col.weight_kg &&
      !col.oral_fluid_ml &&
      !col.parenteral_fluid_ml &&
      !col.urine_volume_ml &&
      !col.stool
    );
  };

  const handleCellChange = (
    colIndex: number,
    field: keyof TempSheetColumnData,
    value: string | null,
  ) => {
    setColumns((prev) => {
      const next = prev.map((c) => {
        if (c.column_index !== colIndex) return c;
        const updated = { ...c, [field]: value };
        // Первое заполнение пустой колонки — подставить текущую дату, если даты ещё нет
        // и пользователь не очищает поле даты явно.
        if (
          field !== 'observation_date' &&
          isColumnEmpty(c) &&
          value != null &&
          !updated.observation_date
        ) {
          updated.observation_date = dayjs().format('YYYY-MM-DD');
          updated.observation_time = updated.observation_time ?? dayjs().format('HH:mm');
        }
        return updated;
      });
      return next;
    });

    const payload: Partial<TempSheetColumnData> = { [field]: value };
    // Если подставили дату при первом заполнении — отправить её тоже
    const current = columnsRef.current.find((c) => c.column_index === colIndex);
    if (
      current &&
      field !== 'observation_date' &&
      isColumnEmpty(current) &&
      value != null &&
      !current.observation_date
    ) {
      payload.observation_date = dayjs().format('YYYY-MM-DD');
      payload.observation_time = current.observation_time ?? dayjs().format('HH:mm');
    }

    void enqueue(async () => {
      await updateTempSheetColumn(token, sheetId, colIndex, payload);
    });
  };

  const handleTempBandToggle = (colIndex: number, band: TemperatureBand) => {
    const current = columnsRef.current.find((c) => c.column_index === colIndex);
    const nextBand = current?.temperature_band === band ? null : band;

    setColumns((prev) =>
      prev.map((c) => {
        if (c.column_index !== colIndex) return c;
        const updated = { ...c, temperature_band: nextBand };
        if (isColumnEmpty(c) && nextBand) {
          updated.observation_date = c.observation_date ?? dayjs().format('YYYY-MM-DD');
          updated.observation_time = c.observation_time ?? dayjs().format('HH:mm');
        }
        return updated;
      }),
    );

    const payload: Partial<TempSheetColumnData> = { temperature_band: nextBand };
    if (current && isColumnEmpty(current) && nextBand) {
      payload.observation_date = current.observation_date ?? dayjs().format('YYYY-MM-DD');
      payload.observation_time = current.observation_time ?? dayjs().format('HH:mm');
    }

    void enqueue(async () => {
      await updateTempSheetColumn(token, sheetId, colIndex, payload);
    });
  };

  const handleHeightBlur = () => {
    const trimmed = heightDraft.trim().replace(',', '.');
    const value = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && (isNaN(value as number) || (value as number) < 0 || (value as number) > 300)) {
      void message.error('Рост: число от 0 до 300');
      return;
    }
    void enqueue(async () => {
      await updateTempSheetHeader(token, sheetId, value);
      setSheet((s) => (s ? { ...s, height_cm: value } : s));
    });
  };

  const handleClearColumn = (colIndex: number) => {
    if (!sheet) return;
    Modal.confirm({
      title: 'Очистить колонку?',
      content: `Будут очищены все показатели колонки ${colIndex} листа ребёнка «${sheet.patient_name}».`,
      okText: 'Очистить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () =>
        enqueue(async () => {
          await clearTempSheetColumn(token, sheetId, colIndex);
          setColumns((prev) =>
            prev.map((c) => (c.column_index === colIndex ? emptyColumn(colIndex) : c)),
          );
        }),
    });
  };

  const handleClearAll = () => {
    if (!sheet) return;
    Modal.confirm({
      title: 'Очистить всю таблицу?',
      content: `Будут очищены все 15 колонок листа ребёнка «${sheet.patient_name}». Шапка и сам лист сохранятся.`,
      okText: 'Очистить всё',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () =>
        enqueue(async () => {
          await clearTempSheetAllColumns(token, sheetId);
          setColumns(Array.from({ length: 15 }, (_, i) => emptyColumn(i + 1)));
        }),
    });
  };

  const flushAndExport = async (action: 'excel' | 'pdf' | 'print') => {
    try {
      await queueRef.current;
      if (saveState === 'error') {
        void message.error('Есть ошибки сохранения — выгрузка отменена');
        return;
      }
      const fresh = await fetchTempSheet(token, sheetId);
      const cols = normalizeColumns(fresh.columns);
      setSheet(fresh);
      setColumns(cols);

      if (action === 'excel') {
        downloadTempSheetExcel(fresh, cols);
        return;
      }

      await new Promise((r) => setTimeout(r, 80));
      if (!printRef.current) return;
      if (action === 'pdf') {
        const safe = fresh.patient_name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
        await downloadTempSheetPdf(printRef.current, `temperaturnyy_list_${safe}`);
      } else {
        printTempSheetElement(printRef.current);
      }
    } catch {
      void message.error('Не удалось выполнить выгрузку');
    }
  };

  if (loading || !sheet) {
    return (
      <div className="temp-sheets-page" style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const statusText =
    saveState === 'saving'
      ? 'Сохранение…'
      : saveState === 'saved'
        ? 'Сохранено'
        : saveState === 'error'
          ? 'Ошибка сохранения'
          : '';

  return (
    <div className="temp-sheets-page temp-sheets-page--editor">
      <div className="temp-sheets-page__toolbar">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            К списку
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Заполнение: {sheet.patient_name}
          </Title>
          {statusText && (
            <Text type={saveState === 'error' ? 'danger' : 'secondary'}>{statusText}</Text>
          )}
        </Space>
        <Space wrap>
          <SelectColumnClear onClear={handleClearColumn} />
          <Button danger icon={<ClearOutlined />} onClick={handleClearAll}>
            Очистить таблицу
          </Button>
          <Button icon={<PrinterOutlined />} onClick={() => void flushAndExport('print')}>
            Печать
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={() => void flushAndExport('pdf')}>
            PDF
          </Button>
          <Button icon={<FileExcelOutlined />} onClick={() => void flushAndExport('excel')}>
            Excel
          </Button>
        </Space>
      </div>

      <TempSheetForm
        sheet={{ ...sheet, height_cm: heightDraft === '' ? null : Number(heightDraft) || sheet.height_cm }}
        columns={columns}
        mode="edit"
        heightDraft={heightDraft}
        onHeightChange={setHeightDraft}
        onHeightBlur={handleHeightBlur}
        onCellChange={handleCellChange}
        onTempBandToggle={handleTempBandToggle}
      />

      {/* Скрытый бланк для PDF/печати с графиком */}
      <div className="temp-sheets-page__print-source" aria-hidden>
        <div ref={printRef}>
          <TempSheetForm
            sheet={{
              ...sheet,
              height_cm:
                heightDraft.trim() === ''
                  ? null
                  : Number(heightDraft.replace(',', '.')) || sheet.height_cm,
            }}
            columns={columns}
            mode="print"
            showColumnNumbers={false}
          />
        </div>
      </div>
    </div>
  );
}

function SelectColumnClear({ onClear }: { onClear: (col: number) => void }) {
  return (
    <Space.Compact>
      <Button
        onClick={() => {
          Modal.confirm({
            title: 'Какую колонку очистить?',
            content: (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 12 }}>
                {Array.from({ length: 15 }, (_, i) => (
                  <Button
                    key={i + 1}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      Modal.destroyAll();
                      onClear(i + 1);
                    }}
                  >
                    {i + 1}
                  </Button>
                ))}
              </div>
            ),
            footer: null,
            closable: true,
          });
        }}
      >
        Очистить колонку…
      </Button>
    </Space.Compact>
  );
}
