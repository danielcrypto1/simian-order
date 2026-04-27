import { ReactNode } from "react";

type PanelProps = {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
};

/**
 * Hard-edged panel. No rounded corners, no soft shadow.
 * Header is a courier-mono caps strip. Title prefix uses an angle-bracket
 * marker rather than the usual "::" — feels more like a directory entry
 * than a SaaS card.
 */
export default function Panel({
  title,
  right,
  children,
  className = "",
  padded = true,
}: PanelProps) {
  return (
    <div className={`panel ${className}`}>
      {title && (
        <div className="panel-header">
          <span>
            <span className="text-elec">&gt;</span> {title}
          </span>
          {right && (
            <span className="text-mute normal-case font-mono text-xxxs tracking-widest">
              {right}
            </span>
          )}
        </div>
      )}
      <div className={padded ? "panel-body" : ""}>{children}</div>
    </div>
  );
}
