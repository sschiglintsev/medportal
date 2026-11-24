import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { TempSheet, TempSheetColumnData, TemperatureBand } from '../../Core/types/common';
import { TEMP_BAND_ORDER } from '../../Core/types/common';
import {
  TEMP_SHEET_ROWS,
  TEMP_SHEET_TITLE,
  buildTempPoints,
  buildTempSegments,
  formatAge,
  formatDateDisplay,
  formatTimeDisplay,
} from '../../Core/utils/tempSheetForm';
import './TempSheetForm.scss';

type Props = {
  sheet: Pick<TempSheet, 'patient_name' | 'birth_date' | 'height_cm' | 'department_name'>;
  columns: TempSheetColumnData[];
  mode: 'view' | 'edit' | 'print';
  heightDraft?: string;
  onHeightChange?: (value: string) => void;
  onHeightBlur?: () => void;
  onCellChange?: (colIndex: number, field: keyof TempSheetColumnData, value: string | null) => void;
  onTempBandToggle?: (colIndex: number, band: TemperatureBand) => void;
  onCellClear?: (colIndex: number, field: keyof TempSheetColumnData) => void;
  showColumnNumbers?: boolean;
};

type PointPx = { col: number; bandIdx: number; x: number; y: number };

export function TempSheetForm({
  sheet,
  columns,
  mode,
  heightDraft,
  onHeightChange,
  onHeightBlur,
  onCellChange,
  onTempBandToggle,
  showColumnNumbers = mode === 'edit',
}: Props) {
  const showGraph = mode === 'view' || mode === 'print';
  const editable = mode === 'edit';

  const points = useMemo(() => buildTempPoints(columns), [columns]);
  const segments = useMemo(() => buildTempSegments(points), [points]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [graphSize, setGraphSize] = useState({ w: 0, h: 0 });
  const [pointCoords, setPointCoords] = useState<PointPx[]>([]);

  // Координаты точек — по реальным центрам ячеек, а не по «равным» строкам
  useLayoutEffect(() => {
    if (!showGraph) return;

    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      setGraphSize({ w: wrap.offsetWidth, h: wrap.offsetHeight });

      const next: PointPx[] = [];
      for (const p of points) {
        const el = wrap.querySelector(
          `[data-tsf-band="${p.bandIdx}"][data-tsf-col="${p.col}"]`,
        ) as HTMLElement | null;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        next.push({
          col: p.col,
          bandIdx: p.bandIdx,
          x: r.left - wrapRect.left + r.width / 2,
          y: r.top - wrapRect.top + r.height / 2,
        });
      }
      setPointCoords(next);
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [showGraph, points, columns, sheet.patient_name, sheet.height_cm, heightDraft]);

  const coordsByCol = useMemo(() => {
    const map = new Map<number, PointPx>();
    for (const p of pointCoords) map.set(p.col, p);
    return map;
  }, [pointCoords]);

  const renderValueCell = (col: TempSheetColumnData, rowIdx: number) => {
    const row = TEMP_SHEET_ROWS[rowIdx];
    const colIndex = col.column_index;

    if (row.kind === 'temp_header') {
      return <td key={colIndex} className="tsf__cell tsf__cell--muted" />;
    }

    if (row.kind === 'temp_band' && row.band) {
      const marked = col.temperature_band === row.band;
      const bandIdx = TEMP_BAND_ORDER.indexOf(row.band);
      return (
        <td
          key={colIndex}
          className={`tsf__cell tsf__cell--band ${marked ? 'tsf__cell--marked' : ''} ${editable ? 'tsf__cell--clickable' : ''}`}
          data-tsf-band={bandIdx}
          data-tsf-col={colIndex - 1}
          onClick={
            editable
              ? () => onTempBandToggle?.(colIndex, row.band!)
              : undefined
          }
          title={editable ? (marked ? 'Снять отметку' : 'Отметить') : undefined}
        >
          {/* В просмотре/печати точку рисует SVG по центру ячейки; в редакторе — маркер */}
          {marked && editable ? <span className="tsf__mark">●</span> : null}
        </td>
      );
    }

    if (!row.field) return <td key={colIndex} className="tsf__cell" />;

    const raw = col[row.field];
    const display =
      row.kind === 'observation_date'
        ? formatDateDisplay(raw as string | null)
        : row.kind === 'observation_time'
          ? formatTimeDisplay(raw as string | null)
          : raw == null
            ? ''
            : String(raw);

    if (!editable) {
      return (
        <td key={colIndex} className="tsf__cell">
          {display}
        </td>
      );
    }

    if (row.kind === 'observation_date') {
      return (
        <td key={colIndex} className="tsf__cell tsf__cell--input">
          <input
            type="date"
            className="tsf__input"
            value={(raw as string | null) ?? ''}
            onChange={(e) =>
              onCellChange?.(colIndex, 'observation_date', e.target.value || null)
            }
          />
        </td>
      );
    }

    if (row.kind === 'observation_time') {
      return (
        <td key={colIndex} className="tsf__cell tsf__cell--input">
          <input
            type="time"
            className="tsf__input"
            value={formatTimeDisplay(raw as string | null)}
            onChange={(e) =>
              onCellChange?.(colIndex, 'observation_time', e.target.value || null)
            }
          />
        </td>
      );
    }

    return (
      <td key={colIndex} className="tsf__cell tsf__cell--input">
        <input
          className="tsf__input"
          value={raw == null ? '' : String(raw)}
          maxLength={row.field === 'stool' ? 500 : row.field === 'stay_day' ? 100 : 20}
          onChange={(e) => onCellChange?.(colIndex, row.field!, e.target.value || null)}
        />
      </td>
    );
  };

  return (
    <div className={`tsf tsf--${mode}`}>
      <div className="tsf__title">{TEMP_SHEET_TITLE}</div>
      <div className="tsf__header">
        <span>
          Фамилия, имя, отчество (при наличии){' '}
          <strong className="tsf__underline">{sheet.patient_name || '__________________'}</strong>
          , возраст{' '}
          <strong className="tsf__underline">{formatAge(sheet.birth_date) || '________'}</strong>
          , рост пациента, см{' '}
          {editable ? (
            <input
              className="tsf__height-input"
              value={heightDraft ?? (sheet.height_cm != null ? String(sheet.height_cm) : '')}
              onChange={(e) => onHeightChange?.(e.target.value)}
              onBlur={() => onHeightBlur?.()}
              placeholder="____"
            />
          ) : (
            <strong className="tsf__underline">
              {sheet.height_cm != null ? String(sheet.height_cm) : '________'}
            </strong>
          )}
        </span>
        {mode !== 'print' && (
          <span className="tsf__dept">Отделение: {sheet.department_name}</span>
        )}
      </div>

      <div className="tsf__table-wrap">
        {showColumnNumbers && (
          <div className="tsf__col-numbers" aria-hidden>
            <div className="tsf__col-numbers-label" />
            {columns.map((c) => (
              <div key={c.column_index} className="tsf__col-num">
                {c.column_index}
              </div>
            ))}
          </div>
        )}

        <div className="tsf__table-relative" ref={wrapRef}>
          <table className="tsf__table">
            <tbody>
              {TEMP_SHEET_ROWS.map((row, rowIdx) => (
                <tr
                  key={row.key}
                  className={
                    row.kind === 'temp_band'
                      ? 'tsf__row--band'
                      : row.kind === 'temp_header'
                        ? 'tsf__row--temp-header'
                        : undefined
                  }
                >
                  <th className="tsf__label">{row.label}</th>
                  {columns.map((col) => renderValueCell(col, rowIdx))}
                </tr>
              ))}
            </tbody>
          </table>

          {showGraph && graphSize.w > 0 && (
            <svg
              className="tsf__graph"
              width={graphSize.w}
              height={graphSize.h}
              viewBox={`0 0 ${graphSize.w} ${graphSize.h}`}
            >
              {segments.map((seg, si) => {
                const pts = seg
                  .map((p) => coordsByCol.get(p.col))
                  .filter((c): c is PointPx => !!c);
                if (pts.length < 2) return null;
                const d = pts
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                  .join(' ');
                return (
                  <path
                    key={`seg-${si}`}
                    d={d}
                    fill="none"
                    stroke="#c41d7f"
                    strokeWidth={2}
                  />
                );
              })}
              {pointCoords.map((p) => (
                <circle
                  key={`pt-${p.col}`}
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill="#c41d7f"
                />
              ))}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
