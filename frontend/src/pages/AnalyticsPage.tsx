import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { FileExcelOutlined } from '@ant-design/icons';
import { Button, DatePicker, Select, Typography } from 'antd';
import * as XLSX from 'xlsx';
import type { Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';

import { useAppStore } from '../Core/store/app.store';
import { fetchRequestsAnalytics, type AnalyticsPoint, type RequestType } from '../Core/services/analytics.service';
import './AnalyticsPage.scss';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type RangeValue = [Dayjs, Dayjs] | null;

const REQUEST_TYPES: { key: RequestType; label: string; color: string }[] = [
  { key: 'incident',    label: 'Нежелательные события', color: '#f5222d' },
  { key: 'it',          label: 'Заявки в ИТ',            color: '#4C4FEA' },
  { key: 'metrologist', label: 'Заявки метрологу',       color: '#52c41a' },
  { key: 'ahch',        label: 'Заявки в АХЧ',           color: '#fa8c16' },
  { key: 'transport',   label: 'Транспортные заявки',    color: '#13c2c2' },
];

const ALL_KEYS = REQUEST_TYPES.map((rt) => rt.key);

const TYPE_SELECT_OPTIONS = [
  { value: 'all', label: 'Все' },
  ...REQUEST_TYPES.map((rt) => ({ value: rt.key, label: rt.label })),
];

function generateDateRange(from: Dayjs, to: Dayjs): string[] {
  const dates: string[] = [];
  let current = from.startOf('day');
  const end = to.startOf('day');
  while (!current.isAfter(end)) {
    dates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  return dates;
}

function handleExport(
  rawPoints: AnalyticsPoint[],
  activeTypes: RequestType[],
  range: RangeValue,
) {
  if (!range) return;

  const periodStr = `${range[0].format('DD.MM.YYYY')} — ${range[1].format('DD.MM.YYYY')}`;
  const typeLabels = Object.fromEntries(REQUEST_TYPES.map((rt) => [rt.key, rt.label]));

  const totals: Partial<Record<RequestType, number>> = {};
  for (const p of rawPoints) {
    if (activeTypes.includes(p.type)) {
      totals[p.type] = (totals[p.type] ?? 0) + p.count;
    }
  }

  const rows = activeTypes.map((type) => ({
    'Событие':    typeLabels[type],
    'Период':     periodStr,
    'Количество': totals[type] ?? 0,
  }));

  const workbook  = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Аналитика');
  XLSX.writeFile(workbook, `analytics_${range[0].format('YYYY-MM-DD')}_${range[1].format('YYYY-MM-DD')}.xlsx`);
}

function buildChartData(
  points: AnalyticsPoint[],
  dates: string[],
  activeTypes: RequestType[],
) {
  const map: Partial<Record<RequestType, Record<string, number>>> = {};
  for (const p of points) {
    if (!map[p.type]) map[p.type] = {};
    const dateStr = typeof p.date === 'string' ? p.date.slice(0, 10) : p.date;
    map[p.type]![dateStr] = p.count;
  }

  return {
    labels: dates.map((d) => {
      const [, month, day] = d.split('-');
      return `${day}.${month}`;
    }),
    datasets: REQUEST_TYPES.filter((rt) => activeTypes.includes(rt.key)).map((rt) => ({
      label: rt.label,
      data: dates.map((d) => map[rt.key]?.[d] ?? 0),
      borderColor: rt.color,
      backgroundColor: rt.color + '22',
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
    })),
  };
}

export function AnalyticsPage() {
  const token = useAppStore((s) => s.token) ?? '';

  const [range, setRange] = useState<RangeValue>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rawPoints, setRawPoints] = useState<AnalyticsPoint[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [hasData, setHasData] = useState(false);

  const [selectedType, setSelectedType] = useState<RequestType | 'all'>('all');

  const activeTypes = selectedType === 'all' ? ALL_KEYS : [selectedType];

  const chartData = useMemo(
    () => (hasData ? buildChartData(rawPoints, dates, activeTypes) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawPoints, dates, selectedType, hasData],
  );

  async function handleApply() {
    if (!range) return;
    setError(null);
    setLoading(true);
    try {
      const from = range[0].format('YYYY-MM-DD');
      const to = range[1].format('YYYY-MM-DD');
      const points = await fetchRequestsAnalytics(from, to, token);
      setRawPoints(points);
      setDates(generateDateRange(range[0], range[1]));
      setHasData(true);
    } catch {
      setError('Не удалось загрузить данные. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="analytics-page">
      <div className="analytics-page__filters">
        <DatePicker.RangePicker
          value={range}
          onChange={(val) => {
            setRange(val as RangeValue);
            setHasData(false);
          }}
          format="DD.MM.YYYY"
          allowClear
          placeholder={['Начальная дата', 'Конечная дата']}
        />
        <Select
          value={selectedType}
          onChange={(val) => setSelectedType(val as RequestType | 'all')}
          options={TYPE_SELECT_OPTIONS}
          className="analytics-page__type-select"
        />
        <Button
          type="primary"
          onClick={handleApply}
          disabled={!range}
          loading={loading}
        >
          Применить фильтр
        </Button>
        <Button
          icon={<FileExcelOutlined />}
          onClick={() => handleExport(rawPoints, activeTypes, range)}
          disabled={!hasData}
        >
          Экспорт в Excel
        </Button>
      </div>

      {error && (
        <Typography.Text type="danger" className="analytics-page__error">
          {error}
        </Typography.Text>
      )}

      {!error && chartData && (
        <div className="analytics-page__chart-wrapper">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                title: {
                  display: true,
                  text: 'Количество событий по дням',
                  font: { size: 15, weight: 'bold' },
                  padding: { bottom: 16 },
                  color: '#1a1a2e',
                },
                legend: {
                  position: 'bottom',
                  labels: {
                    padding: 24,
                    usePointStyle: true,
                    pointStyleWidth: 12,
                    font: { size: 13 },
                  },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} шт.`,
                  },
                },
              },
              scales: {
                x: {
                  title: { display: true, text: 'Дата', font: { size: 12 } },
                  grid: { color: '#f0f0f0' },
                },
                y: {
                  title: { display: true, text: 'Количество заявок', font: { size: 12 } },
                  beginAtZero: true,
                  ticks: { stepSize: 1, precision: 0 },
                  grid: { color: '#f0f0f0' },
                },
              },
            }}
          />
        </div>
      )}

      {!error && !hasData && !loading && (
        <div className="analytics-page__empty">
          <Typography.Text type="secondary">
            Выберите период и нажмите «Применить фильтр»
          </Typography.Text>
        </div>
      )}
    </div>
  );
}
