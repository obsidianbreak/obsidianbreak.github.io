import type { ReactNode } from "react";

interface OverlayProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  actions?: ReactNode;
}

export default function Overlay({ eyebrow, title, subtitle, children, actions }: OverlayProps) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="overlay__panel">
        {eyebrow && <p className="caps">{eyebrow}</p>}
        <h2 className="overlay__title">{title}</h2>
        {subtitle && <p className="overlay__subtitle">{subtitle}</p>}
        {children}
        {actions && <div className="overlay__actions">{actions}</div>}
      </div>
    </div>
  );
}
