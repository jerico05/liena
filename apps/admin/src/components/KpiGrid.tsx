import type { ReactNode } from "react";

export type KpiItem = {
  id: string;
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  onClick?: () => void;
};

export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpi-grid">
      {items.map((item) => {
        const content = (
          <>
            <span>
              <span className="kpi-label">{item.label}</span>
              <strong>{item.value}</strong>
              {item.hint && <span className="kpi-hint">{item.hint}</span>}
            </span>
            <span className="kpi-icon" aria-hidden="true">{item.icon}</span>
          </>
        );
        if (item.onClick) {
          return (
            <button key={item.id} type="button" className="kpi-card" onClick={item.onClick}>
              {content}
            </button>
          );
        }
        return (
          <div key={item.id} className="kpi-card kpi-card-static">
            {content}
          </div>
        );
      })}
    </div>
  );
}
