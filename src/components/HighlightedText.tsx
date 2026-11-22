import React from 'react';
import type { SchoolConfig } from '../types/casm';

/**
 * Safely renders text while highlighting [COMPLETAR] in yellow and [VERIFICAR] in soft orange
 * using pure React nodes (zero dangerouslySetInnerHTML).
 */
export const HighlightedText: React.FC<{ text?: string; className?: string }> = ({
  text = '',
  className,
}) => {
  if (!text) {
    return <span className="marker-completar">[COMPLETAR]</span>;
  }

  const tokens = text.split(/(\[COMPLETAR[^\]]*\]|\[VERIFICAR[^\]]*\])/g);
  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        if (/^\[COMPLETAR[^\]]*\]$/.test(tok)) {
          return (
            <span key={i} className="marker-completar">
              {tok}
            </span>
          );
        }
        if (/^\[VERIFICAR[^\]]*\]$/.test(tok)) {
          return (
            <span key={i} className="marker-verificar">
              {tok}
            </span>
          );
        }
        return <React.Fragment key={i}>{tok}</React.Fragment>;
      })}
    </span>
  );
};

interface SchoolDocHeaderProps {
  config: SchoolConfig;
  documentTitle: string;
  subtitle?: string;
  compact?: boolean;
}

/**
 * Official CASM header for printed/exported school documents (strictly CASM identity, NEVER RENOVA).
 */
export const SchoolDocHeader: React.FC<SchoolDocHeaderProps> = ({
  config,
  documentTitle,
  subtitle,
  compact = false,
}) => {
  return (
    <div
      className={`border-b-2 pb-2.5 mb-3 flex items-center justify-between gap-4 ${
        compact ? 'pb-2 mb-2' : ''
      }`}
      style={{ borderColor: config.primaryColor }}
    >
      <div className="flex items-center gap-3">
        <img
          src={config.casmLogo || '/assets/casm-logo.png'}
          alt="Logo Educación Adventista - Colegio San Miguel"
          className={`${compact ? 'w-11 h-11' : 'w-14 h-14'} object-contain shrink-0`}
          referrerPolicy="no-referrer"
        />
        <div>
          <div
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: config.accentColor }}
          >
            Educación Adventista
          </div>
          <div
            className={`${compact ? 'text-sm' : 'text-base'} font-extrabold uppercase leading-tight`}
            style={{ color: config.primaryColor }}
          >
            {config.schoolName}
          </div>
          <div className="text-[10px] text-slate-600">
            {config.schoolCity} · Tel. {config.schoolPhone} · Año Lectivo {config.academicYear}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div
          className={`${compact ? 'text-xs' : 'text-sm'} font-extrabold uppercase`}
          style={{ color: config.primaryColor }}
        >
          {documentTitle}
        </div>
        {subtitle && <div className="text-[11px] text-slate-600 mt-0.5">{subtitle}</div>}
        <div
          className="h-1 w-20 ml-auto mt-1 rounded-full"
          style={{ backgroundColor: config.accentColor }}
        />
      </div>
    </div>
  );
};
