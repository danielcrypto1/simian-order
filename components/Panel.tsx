import { ReactNode } from "react";

type PanelProps = {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
};

export default function Panel({ title, right, children, className = "", padded = true }: PanelProps) {
  return (
    <div className={`panel shadow-hard ${className}`}>
      {title && (
        <div className="panel-header">
          <span>:: {title}</span>
          {right && <span className="text-ape-300 normal-case font-normal">{right}</span>}
        </div>
      )}
      <div className={padded ? "panel-body" : ""}>{children}</div>
    </div>
  );
}
