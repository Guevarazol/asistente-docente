import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Search, Trash2, Calendar } from 'lucide-react';
import type { ModuleId, SavedDocument, SchoolConfig } from '../types/casm';
import { deleteDocumentFromHistory, getAllDocuments } from '../db/indexedDb';

export const MODULE_LABELS: Record<ModuleId, string> = {
  grados: 'Mis Grados y Alumnos',
  desempeno: 'Desempeño Escolar',
  jornalizacion: 'Jornalización Docente',
  planificacion: 'Planificación (Guion de clases)',
  guias: 'Guías por Clase',
  temarios: 'Temarios de Examen',
  examenes: 'Exámenes',
  bitacora: 'Bitácora de Incidentes',
  actas: 'Actas',
  diplomas: 'Diplomas de Graduación',
};

interface HistoryViewProps {
  config: SchoolConfig;
  onOpenDocument: (doc: SavedDocument) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ config, onOpenDocument }) => {
  const [docs, setDocs] = useState<SavedDocument[]>([]);
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<ModuleId | 'all'>('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const loadDocs = async () => {
    const all = await getAllDocuments();
    setDocs(all);
  };

  useEffect(() => {
    void loadDocs();
  }, []);

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (moduleFilter !== 'all' && d.module !== moduleFilter) return false;
      if (gradeFilter !== 'all' && d.grade !== gradeFilter) return false;
      if (subjectFilter !== 'all' && d.subject !== subjectFilter) return false;
      if (dateFilter && !d.date.startsWith(dateFilter)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${d.title} ${d.grade} ${d.subject} ${MODULE_LABELS[d.module]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, moduleFilter, gradeFilter, subjectFilter, dateFilter, query]);

  const handleDelete = async (id: string) => {
    await deleteDocumentFromHistory(id);
    await loadDocs();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#003366] tracking-tight">
          Historial de Documentos
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Guardados de forma privada en este dispositivo (IndexedDB). Busca por módulo, grado, asignatura o fecha.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar título..."
            className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-slate-300 text-xs"
          />
        </div>

        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value as ModuleId | 'all')}
          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
        >
          <option value="all">Todos los módulos</option>
          {(Object.keys(MODULE_LABELS) as ModuleId[]).map((m) => (
            <option key={m} value={m}>
              {MODULE_LABELS[m]}
            </option>
          ))}
        </select>

        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
        >
          <option value="all">Todos los grados</option>
          {config.grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-xs bg-white"
        >
          <option value="all">Todas las asignaturas</option>
          {config.subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="relative">
          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-slate-300 text-xs"
          />
        </div>
      </div>

      {/* Results List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No se encontraron documentos</h3>
          <p className="text-xs text-slate-500">
            Cuando guardes un documento desde cualquiera de los 8 módulos, aparecerá aquí para reabrirlo o duplicarlo.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#003366]/40 transition shadow-xs"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-bold text-[#003366]">{MODULE_LABELS[doc.module]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{doc.grade}</span>
                  <span aria-hidden="true">·</span>
                  <span>{doc.subject}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{doc.date}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 truncate">{doc.title}</h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenDocument(doc)}
                  className="min-h-[42px] px-4 rounded-xl bg-[#003366] hover:bg-[#00254a] text-white text-xs font-semibold cursor-pointer"
                >
                  Abrir y editar
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(doc.id)}
                  aria-label="Eliminar documento"
                  className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
