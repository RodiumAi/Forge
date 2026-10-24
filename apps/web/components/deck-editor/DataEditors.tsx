"use client";

/**
 * Simple grids for chart data (rows = labels, columns = series) and tables
 * (rows x columns of plain cells; marks inside cells are kept as they are
 * unless the cell text is edited).
 */

import { Minus, Plus } from "lucide-react";
import type { ChartElement, TableElement } from "./model";
import type { DeckT } from "./strings";

type ChartData = ChartElement["data"];

export function ChartDataEditor({ data, onChange, t, disabled }: { data: ChartData; onChange: (data: ChartData) => void; t: DeckT; disabled?: boolean }) {
  const rows = data.labels.length;
  const setLabel = (i: number, label: string) => onChange({ ...data, labels: data.labels.map((l, j) => (j === i ? label.slice(0, 120) : l)) });
  const setName = (s: number, name: string) => onChange({ ...data, series: data.series.map((x, j) => (j === s ? { ...x, name: name.slice(0, 120) } : x)) });
  const setValue = (s: number, i: number, raw: string) => {
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value)) return;
    onChange({
      ...data,
      series: data.series.map((x, j) => {
        if (j !== s) return x;
        const values = [...x.values];
        while (values.length < rows) values.push(0);
        values[i] = value;
        return { ...x, values };
      }),
    });
  };
  const addRow = () =>
    onChange({
      labels: [...data.labels, String.fromCharCode(65 + (rows % 26))],
      series: data.series.map((x) => ({ ...x, values: [...x.values, 0] })),
    });
  const removeRow = (i: number) =>
    onChange({ labels: data.labels.filter((_, j) => j !== i), series: data.series.map((x) => ({ ...x, values: x.values.filter((_, j) => j !== i) })) });
  const addSeries = () => onChange({ ...data, series: [...data.series, { name: `${t("chartData")} ${data.series.length + 1}`, values: data.labels.map(() => 0) }] });
  const removeSeries = (s: number) => onChange({ ...data, series: data.series.filter((_, j) => j !== s) });

  return (
    <div className="de-grid-editor">
      <table>
        <thead>
          <tr>
            <th scope="col">{t("chartLabel")}</th>
            {data.series.map((series, s) => (
              <th key={s} scope="col">
                <input value={series.name} aria-label={`${t("chartData")} ${s + 1}`} disabled={disabled} onChange={(e) => setName(s, e.target.value)} />
                {data.series.length > 1 ? (
                  <button type="button" className="de-icon-button" aria-label={t("removeSeries")} title={t("removeSeries")} disabled={disabled} onClick={() => removeSeries(s)}>
                    <Minus size={12} aria-hidden />
                  </button>
                ) : null}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {data.labels.map((label, i) => (
            <tr key={i}>
              <td>
                <input value={label} aria-label={`${t("chartLabel")} ${i + 1}`} disabled={disabled} onChange={(e) => setLabel(i, e.target.value)} />
              </td>
              {data.series.map((series, s) => (
                <td key={s}>
                  <input
                    type="number"
                    value={series.values[i] ?? 0}
                    aria-label={`${series.name} ${label}`}
                    disabled={disabled}
                    onChange={(e) => setValue(s, i, e.target.value)}
                  />
                </td>
              ))}
              <td>
                <button type="button" className="de-icon-button" aria-label={t("removeRow")} title={t("removeRow")} disabled={disabled || rows <= 1} onClick={() => removeRow(i)}>
                  <Minus size={12} aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="de-row">
        <button type="button" className="de-button de-button-ghost" disabled={disabled || rows >= 100} onClick={addRow}>
          <Plus size={14} aria-hidden /> {t("addRow")}
        </button>
        <button type="button" className="de-button de-button-ghost" disabled={disabled || data.series.length >= 12} onClick={addSeries}>
          <Plus size={14} aria-hidden /> {t("addSeries")}
        </button>
      </div>
    </div>
  );
}

type Rows = TableElement["rows"];

function cellText(cell: Rows[number][number]): string {
  return cell.runs ? cell.runs.map((r) => r.text).join("") : (cell.text ?? "");
}

export function TableEditor({ rows, onChange, t, disabled }: { rows: Rows; onChange: (rows: Rows) => void; t: DeckT; disabled?: boolean }) {
  const columns = Math.max(1, ...rows.map((r) => r.length));
  const setCell = (r: number, c: number, text: string) =>
    onChange(
      rows.map((row, i) => {
        if (i !== r) return row;
        const next = [...row];
        while (next.length < columns) next.push({ text: "" });
        next[c] = { text: text.slice(0, 5000) };
        return next;
      }),
    );
  const addRow = () => onChange([...rows, Array.from({ length: columns }, () => ({ text: "" }))]);
  const removeRow = (r: number) => onChange(rows.filter((_, i) => i !== r));
  const addColumn = () => onChange(rows.map((row) => [...row, { text: "" }]));
  const removeColumn = (c: number) => onChange(rows.map((row) => row.filter((_, i) => i !== c)));
  return (
    <div className="de-grid-editor">
      <table>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c}>
                  <input value={row[c] ? cellText(row[c]) : ""} aria-label={`${r + 1}, ${c + 1}`} disabled={disabled} onChange={(e) => setCell(r, c, e.target.value)} />
                </td>
              ))}
              <td>
                <button type="button" className="de-icon-button" aria-label={t("removeRow")} title={t("removeRow")} disabled={disabled || rows.length <= 1} onClick={() => removeRow(r)}>
                  <Minus size={12} aria-hidden />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            {Array.from({ length: columns }, (_, c) => (
              <td key={c}>
                <button type="button" className="de-icon-button" aria-label={t("removeColumn")} title={t("removeColumn")} disabled={disabled || columns <= 1} onClick={() => removeColumn(c)}>
                  <Minus size={12} aria-hidden />
                </button>
              </td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
      <div className="de-row">
        <button type="button" className="de-button de-button-ghost" disabled={disabled || rows.length >= 50} onClick={addRow}>
          <Plus size={14} aria-hidden /> {t("addRow")}
        </button>
        <button type="button" className="de-button de-button-ghost" disabled={disabled || columns >= 20} onClick={addColumn}>
          <Plus size={14} aria-hidden /> {t("addColumn")}
        </button>
      </div>
    </div>
  );
}
