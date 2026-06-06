import { useEffect, useRef } from "react";
import Icon, { IconName } from "@/components/Icon";

export interface MenuItem {
  label?: string;
  icon?: IconName;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Element)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // defer so the opening click doesn't immediately close it
    const t = setTimeout(() => {
      window.addEventListener("mousedown", close);
      window.addEventListener("keydown", esc);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  // keep menu on screen
  const style: React.CSSProperties = { left: x, top: y };

  return (
    <div className="ctx-menu" style={style} ref={ref}>
      {items.map((it, i) =>
        it.divider ? (
          <div key={i} className="ctx-divider" />
        ) : (
          <button
            key={i}
            className={`ctx-item ${it.danger ? "danger" : ""}`}
            disabled={it.disabled}
            onClick={() => {
              it.onClick?.();
              onClose();
            }}
          >
            <span className="ctx-ic">{it.icon && <Icon name={it.icon} size={14} />}</span>
            <span className="ctx-label">{it.label}</span>
            {it.shortcut && <span className="ctx-shortcut">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
