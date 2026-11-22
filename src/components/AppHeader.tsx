import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  Database,
  Download,
  FileSpreadsheet,
  FolderClock,
  Home,
  LayoutTemplate,
  Lock,
  RotateCcw,
  Settings,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { SchoolConfig } from '../types/casm';
import {
  exportFullBackupJSON,
  exportRosterAndGradesCSV,
  importFullBackupJSON,
  promptResetAllData,
} from '../db/indexedDb';
import { PWAInstallButton } from './PWAInstallButton';

export type MainView = 'inicio' | 'modulo' | 'historial' | 'plantillas' | 'configuracion';

interface AppHeaderProps {
  config: SchoolConfig;
  activeView: MainView;
  onNavigate: (view: MainView) => void;
  onLockApp: () => void;
  onOpenApiKeyModal?: () => void;
  onOpenManual?: () => void;
  onSecretNexusClick?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  config,
  activeView,
  onNavigate,
  onLockApp,
  onOpenApiKeyModal,
  onOpenManual,
  onSecretNexusClick,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showBackupMenu, setShowBackupMenu] = useState(false);
  const backupMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (backupMenuRef.current && !backupMenuRef.current.contains(e.target as Node)) {
        setShowBackupMenu(false);
      }
    };
    if (showBackupMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBackupMenu]);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void importFullBackupJSON(file);
      setShowBackupMenu(false);
    }
  };

  return (
    <header className="no-print sticky top-0 z-40 bg-[#003366] text-white shadow-md border-b-4 border-[#FFA92D] w-full overflow-x-clip">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Left: RENOVA logo in white rounded box + CASM Docente stack */}
        <button
          type="button"
          onClick={() => onNavigate('inicio')}
          className="flex items-center gap-2 sm:gap-3 text-left group cursor-pointer shrink-0 min-w-0"
        >
          <div className="bg-white rounded-xl px-1.5 sm:px-2 py-1 shadow-sm h-10 w-20 sm:h-12 sm:w-28 flex items-center justify-center shrink-0">
            <img
              src={config.renovaLogo || '/assets/aistudio/Logo_largo_renova_5b497c22.png'}
              alt="Logo Corporación Médica Integral RENOVA"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-base sm:text-lg font-black tracking-tight text-white whitespace-nowrap">
              Asistente Docente
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-sky-100/90 hidden xl:block whitespace-nowrap">
              Corporación Médica Integral RENOVA
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSecretNexusClick?.();
              }}
              className="text-[9px] sm:text-[10px] font-bold tracking-wider text-[#FFA92D] whitespace-nowrap cursor-pointer select-none"
              title="RENOVA NEXUS"
            >
              RENOVA NEXUS
            </div>
          </div>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-2 lg:gap-4 xl:gap-6 text-xs lg:text-sm font-medium text-sky-100 shrink-0">
          {(
            [
              { id: 'inicio', label: 'Módulos' },
              { id: 'historial', label: 'Historial' },
              { id: 'plantillas', label: 'Plantillas' },
              { id: 'configuracion', label: 'Configuración' },
            ] as const
          ).map((item) => {
            const isActive =
              activeView === item.id || (item.id === 'inicio' && activeView === 'modulo');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-1 whitespace-nowrap shrink-0 transition border-b-2 cursor-pointer ${
                  isActive
                    ? 'text-white font-bold border-[#FFA92D]'
                    : 'border-transparent hover:text-white hover:border-white/40'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Backup Tools + API Key + PWA Install + Lock */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Hidden File Input for JSON restore */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />

          {/* Respaldo Dropdown Menu Button */}
          <div className="relative" ref={backupMenuRef}>
            <button
              type="button"
              onClick={() => setShowBackupMenu((prev) => !prev)}
              title="Opciones de respaldo de seguridad y datos"
              className="min-h-[36px] px-2 sm:px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 text-[11px] font-semibold transition cursor-pointer border border-white/15"
            >
              <Database className="w-3.5 h-3.5 text-[#FFA92D]" />
              <span className="hidden lg:inline">Respaldo</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {showBackupMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white text-slate-800 shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Gestión de Datos y Respaldos
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowBackupMenu(false);
                    void exportFullBackupJSON();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition font-medium"
                >
                  <Download className="w-4 h-4 text-[#FFA92D]" />
                  <div>
                    <div className="font-bold text-[#003366]">Descargar Respaldo JSON</div>
                    <div className="text-[10px] text-slate-500">Guarda alumnos, notas y documentos</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowBackupMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition font-medium"
                >
                  <Upload className="w-4 h-4 text-sky-600" />
                  <div>
                    <div className="font-bold text-[#003366]">Restaurar Respaldo JSON</div>
                    <div className="text-[10px] text-slate-500">Cargar archivo previo de respaldo</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowBackupMenu(false);
                    void exportRosterAndGradesCSV();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition font-medium"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-bold text-emerald-800">Exportar Nómina / CSV</div>
                    <div className="text-[10px] text-slate-500">Abrir lista y notas en Excel</div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    setShowBackupMenu(false);
                    void promptResetAllData();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-700 flex items-center gap-2.5 cursor-pointer transition font-medium"
                >
                  <RotateCcw className="w-4 h-4 text-rose-500" />
                  <div>
                    <div className="font-bold">Reiniciar / Limpiar Datos</div>
                    <div className="text-[10px] text-rose-500/80">Restaurar demo o iniciar en blanco</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Manual de Uso */}
          <button
            type="button"
            onClick={onOpenManual}
            title="Manual Oficial de Uso y Referencia Operativa"
            aria-label="Abrir Manual de Uso"
            className="min-h-[36px] px-2 sm:px-2.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-100 border border-sky-400/30 flex items-center justify-center gap-1.5 text-xs font-semibold transition cursor-pointer shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#FFA92D]" />
            <span className="hidden md:inline">Manual</span>
          </button>

          {/* Clave IA */}
          <button
            type="button"
            onClick={onOpenApiKeyModal}
            title="Configurar Clave Gemini API"
            aria-label="Configurar Clave Gemini API"
            className="min-h-[36px] px-2 sm:px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 flex items-center justify-center gap-1.5 text-xs font-semibold transition cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FFA92D]" />
            <span className="hidden lg:inline">Clave IA</span>
          </button>

          {/* Instalar App PWA */}
          <PWAInstallButton />

          {/* Bloquear */}
          <button
            type="button"
            onClick={onLockApp}
            title="Bloquear con PIN"
            aria-label="Bloquear aplicación con PIN"
            className="min-h-[36px] px-2 sm:px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center gap-1.5 text-xs font-medium transition cursor-pointer shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Bloquear</span>
          </button>
        </div>
      </div>
    </header>
  );
};

interface MobileBottomNavProps {
  activeView: MainView;
  onNavigate: (view: MainView) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeView, onNavigate }) => {
  const tabs: Array<{ id: MainView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'inicio', label: 'Módulos', icon: Home },
    { id: 'historial', label: 'Historial', icon: FolderClock },
    { id: 'plantillas', label: 'Plantillas', icon: LayoutTemplate },
    { id: 'configuracion', label: 'Ajustes', icon: Settings },
  ];

  return (
    <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
      <div className="grid grid-cols-4 h-16 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeView === tab.id || (tab.id === 'inicio' && activeView === 'modulo');
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                isActive ? 'text-[#003366] font-bold' : 'text-slate-500 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#003366]' : 'text-slate-400'}`} />
              <span className="text-[11px] leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
