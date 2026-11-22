import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileText,
  Lightbulb,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  generateUserManualPdf,
  MANUAL_SECTIONS,
  type ManualSection,
} from '../utils/manualPdfGenerator';
import type { SchoolConfig } from '../types/casm';

interface UserManualModalProps {
  open: boolean;
  config?: SchoolConfig;
  onClose: () => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({
  open,
  config,
  onClose,
}) => {
  const [activeSectionId, setActiveSectionId] = useState<string>(MANUAL_SECTIONS[0]?.id || 'intro');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MANUAL_SECTIONS;
    return MANUAL_SECTIONS.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.summary.toLowerCase().includes(q) ||
        sec.content.some((p) => p.toLowerCase().includes(q)) ||
        (sec.tips && sec.tips.some((t) => t.toLowerCase().includes(q)))
    );
  }, [searchQuery]);

  const activeSection = useMemo(() => {
    return (
      filteredSections.find((s) => s.id === activeSectionId) ||
      filteredSections[0] ||
      MANUAL_SECTIONS[0]
    );
  }, [filteredSections, activeSectionId]);

  if (!open) return null;

  const handleDownloadPdf = () => {
    setDownloading(true);
    try {
      const doc = generateUserManualPdf(config);
      doc.save('Manual_Asistente_Docente_RENOVA_2026.pdf');
    } catch (e) {
      console.error('Error al generar PDF del manual:', e);
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl h-[92vh] rounded-2xl bg-white shadow-2xl text-slate-900 flex flex-col overflow-hidden border border-slate-200">
        {/* TOP BAR */}
        <div className="bg-[#003366] text-white px-4 sm:px-6 py-3 flex items-center justify-between border-b-4 border-[#FFA92D] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-[#FFA92D]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight truncate text-white">
                  Manual de Uso y Referencia Operativa
                </h2>
                <span className="hidden md:inline px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFA92D] text-[#002244]">
                  RENOVA NEXUS 2026
                </span>
              </div>
              <p className="text-[11px] text-sky-100/90 truncate">
                Corporación Médica Integral RENOVA · Asistente Docente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="min-h-[36px] px-3 rounded-xl bg-[#FFA92D] hover:bg-[#f59e0b] active:scale-[0.98] text-[#002244] font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Descargar Manual Completo en formato PDF"
            >
              <Download className="w-3.5 h-3.5 text-[#002244]" />
              <span className="hidden sm:inline">
                {downloading ? 'Generando PDF...' : 'Descargar PDF'}
              </span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[36px] px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              title="Imprimir"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer ml-1"
              title="Cerrar manual"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SEARCH AND SUB-BANNER */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el manual (ej. notas, WhatsApp, Ley Crecer Juntos, diplomas...)"
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">Privacidad garantizada:</span>
            <span className="text-slate-700 font-semibold">
              Datos 100% locales en tu dispositivo
            </span>
          </div>
        </div>

        {/* MAIN BODY: SIDEBAR INDEX + CONTENT VIEWER */}
        <div className="flex-1 flex overflow-hidden">
          {/* SIDEBAR INDEX */}
          <aside className="w-72 lg:w-80 border-r border-slate-200 bg-slate-50/70 overflow-y-auto p-2 sm:p-3 shrink-0 hidden md:block">
            <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Índice de Contenidos ({filteredSections.length})
            </div>
            <nav className="space-y-1 mt-1">
              {filteredSections.map((sec) => {
                const isActive = sec.id === activeSection?.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition cursor-pointer flex items-start gap-2 ${
                      isActive
                        ? 'bg-[#003366] text-white font-bold shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200/60 font-medium'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        <span className={`font-mono text-[11px] mr-1.5 font-bold ${isActive ? 'text-[#FFA92D]' : 'text-slate-400'}`}>
                          {sec.chapterNum}.
                        </span>
                        <span>{sec.title}</span>
                      </div>
                      {sec.badge && (
                        <div
                          className={`text-[10px] truncate mt-0.5 ${
                            isActive ? 'text-[#FFA92D]' : 'text-slate-500'
                          }`}
                        >
                          {sec.badge}
                        </div>
                      )}
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#FFA92D] shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* CONTENT VIEWER */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 bg-white">
            {/* Mobile chapter dropdown selector */}
            <div className="md:hidden pb-3 border-b border-slate-200">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Capítulo seleccionado:
              </label>
              <select
                value={activeSection?.id}
                onChange={(e) => setActiveSectionId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-[#003366] bg-slate-50"
              >
                {filteredSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.chapterNum}. {s.title}
                  </option>
                ))}
              </select>
            </div>

            {activeSection ? (
              <article className="max-w-3xl space-y-5">
                {/* Section Header */}
                <header className="border-b border-slate-100 pb-4">
                  {activeSection.badge && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 mb-2">
                      {activeSection.badge}
                    </span>
                  )}
                  <h1 className="text-xl sm:text-2xl font-black text-[#003366] tracking-tight">
                    <span className="text-[#FFA92D] mr-2">{activeSection.chapterNum}.</span>
                    {activeSection.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1.5 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    {activeSection.summary}
                  </p>
                </header>

                {/* Section Content Paragraphs (Crisp Left-Aligned Text) */}
                <div className="space-y-3.5 text-xs sm:text-sm text-slate-700 leading-relaxed text-left">
                  {activeSection.content.map((paragraph, idx) => {
                    const isBullet = paragraph.startsWith('-') || paragraph.startsWith('•');
                    const isNumbered = /^[0-9]+\./.test(paragraph);

                    if (isBullet) {
                      return (
                        <div key={idx} className="flex items-start gap-2.5 pl-3 text-left">
                          <span className="w-2 h-2 rounded-full bg-[#FFA92D] shrink-0 mt-1.5" />
                          <p className="flex-1 text-slate-700 leading-relaxed">{paragraph.replace(/^[-•]\s*/, '')}</p>
                        </div>
                      );
                    }

                    if (isNumbered) {
                      return (
                        <div key={idx} className="flex items-start gap-2.5 pl-2 font-medium text-left">
                          <span className="px-2 py-0.5 rounded-md bg-[#003366] text-white font-bold text-xs shrink-0">
                            {paragraph.match(/^[0-9]+\./)?.[0]}
                          </span>
                          <p className="flex-1 text-slate-800 leading-relaxed">{paragraph.replace(/^[0-9]+\.\s*/, '')}</p>
                        </div>
                      );
                    }

                    return (
                      <p key={idx} className="leading-relaxed">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>

                {/* Practical Fictional Example Card */}
                {activeSection.fictionalExample && (
                  <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200/90 space-y-2.5 mt-5">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-sky-900">
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      <span>{activeSection.fictionalExample.title}</span>
                    </div>
                    <p className="text-xs text-sky-800 font-medium">
                      {activeSection.fictionalExample.description}
                    </p>
                    <div className="bg-white/80 p-3 rounded-xl border border-sky-100 space-y-1.5 text-xs text-sky-950 font-medium">
                      {activeSection.fictionalExample.details.map((item, dIdx) => (
                        <div key={dIdx} className="flex items-start gap-2">
                          <span className="text-sky-500 font-bold">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips Box */}
                {activeSection.tips && activeSection.tips.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2 mt-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <Lightbulb className="w-4 h-4 text-[#FFA92D]" />
                      <span>Recomendaciones y Buenas Prácticas:</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-amber-950 pl-6 list-disc">
                      {activeSection.tips.map((tip, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Executive Contact Card on Section 17 or General Footer */}
                {activeSection.id === 'contacto_corporativo' && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#001f3f] to-[#003366] text-white shadow-lg space-y-4 border border-[#FFA92D]/30 mt-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-[#FFA92D]">
                          Dirección Corporativa & Mesa de Soporte
                        </div>
                        <h3 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                          Corporación Médica Integral RENOVA
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-[#FFA92D] text-[#001f3f] text-xs font-extrabold">
                        RENOVA NEXUS
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1 bg-white/5 p-3 rounded-xl border border-white/10">
                        <div className="text-[10px] font-bold text-slate-300 uppercase">Director Ejecutivo / CEO</div>
                        <div className="text-sm font-extrabold text-white">Dr. Oscar Alexander Guevara</div>
                        <div className="text-[11px] text-amber-200">CEO Corporación Médica Integral</div>
                      </div>

                      <div className="space-y-1 bg-white/5 p-3 rounded-xl border border-white/10">
                        <div className="text-[10px] font-bold text-slate-300 uppercase">Contacto Directo & Licencias</div>
                        <div className="text-sm font-extrabold text-[#FFA92D]">Tel. 71405449</div>
                        <div className="text-[11px] text-slate-300">San Miguel, El Salvador · Centroamérica</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <span className="text-[11px] text-slate-300">
                        Atención para activaciones de prueba (7 días), planes anuales y licencias vitalicias permanentes.
                      </span>
                      <a
                        href="https://wa.me/50371405449?text=Hola%20Dr.%20Oscar%20Guevara%2C%20le%20contacto%20sobre%20la%20licencia%20de%20Asistente%20Docente"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
                      >
                        <span>Escribir al WhatsApp (71405449)</span>
                      </a>
                    </div>
                  </div>
                )}
              </article>
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs">
                No se encontraron temas coincidentes con "{searchQuery}".
              </div>
            )}
          </main>
        </div>

        {/* FOOTER */}
        <footer className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-700">
              © 2026 Corporación Médica Integral RENOVA
            </span>
            <span>·</span>
            <span className="text-[#FFA92D] font-black">RENOVA NEXUS</span>
            <span className="hidden lg:inline">·</span>
            <span className="hidden lg:inline text-slate-600 font-medium">
              Contacto: Dr. Oscar Alexander Guevara (Tel. 71405449)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="text-[#003366] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Descargar Manual en PDF
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
