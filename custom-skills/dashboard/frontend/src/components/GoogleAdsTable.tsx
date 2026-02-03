import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  id: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortAccessor?: (row: T) => number | string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  tooltip?: string;
}

export interface GoogleAdsTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyAccessor: (row: T) => string;
  loading?: boolean;
  // Pagination
  pagination?: {
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    totalItems?: number;
  };
  onPageChange?: (page: number) => void;
  // Sorting
  defaultSortColumn?: string;
  defaultSortDirection?: 'asc' | 'desc';
  // Selection (future)
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  // Row click
  onRowClick?: (row: T) => void;
  // Empty state
  emptyMessage?: string;
}

export function GoogleAdsTable<T>({
  columns,
  data,
  keyAccessor,
  loading,
  pagination,
  onPageChange,
  defaultSortColumn,
  defaultSortDirection = 'desc',
  onRowClick,
  emptyMessage = 'No hay datos disponibles',
}: GoogleAdsTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(defaultSortColumn || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

  // Handle sort
  const handleSort = (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column?.sortAccessor) return;

    if (sortColumn === columnId) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('desc');
    }
  };

  // Sort data locally if we have a sort accessor
  let sortedData = data;
  if (sortColumn) {
    const column = columns.find(c => c.id === sortColumn);
    if (column?.sortAccessor) {
      sortedData = [...data].sort((a, b) => {
        const aVal = column.sortAccessor!(a);
        const bVal = column.sortAccessor!(b);

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortDirection === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }
  }

  if (loading && data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500">
        Cargando...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              {columns.map((column) => {
                const isSortable = !!column.sortAccessor;
                const isSorted = sortColumn === column.id;

                return (
                  <th
                    key={column.id}
                    onClick={() => isSortable && handleSort(column.id)}
                    className={`
                      px-4 py-3 font-medium text-gray-600 dark:text-gray-300
                      ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}
                      ${isSortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none' : ''}
                      ${column.width || ''}
                    `}
                    title={column.tooltip}
                  >
                    <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                      <span>{column.header}</span>
                      {isSortable && (
                        <span className="flex flex-col">
                          <ChevronUp className={`w-3 h-3 -mb-1 ${isSorted && sortDirection === 'asc' ? 'text-blue-500' : 'text-gray-400'}`} />
                          <ChevronDown className={`w-3 h-3 ${isSorted && sortDirection === 'desc' ? 'text-blue-500' : 'text-gray-400'}`} />
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedData.map((row) => (
              <tr
                key={keyAccessor(row)}
                onClick={() => onRowClick?.(row)}
                className={`
                  hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors
                  ${onRowClick ? 'cursor-pointer' : ''}
                `}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`
                      px-4 py-3 text-gray-900 dark:text-gray-100
                      ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}
                    `}
                  >
                    {column.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {pagination.totalItems && (
              <span>{pagination.totalItems.toLocaleString()} elementos</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={!pagination.hasPrev}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>

            <span className="text-sm text-gray-600 dark:text-gray-300 px-3">
              {pagination.page} de {pagination.totalPages}
            </span>

            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Reusable Cell Components (Google Ads style)
// ============================================================================

export function StatusDot({ active }: { active: boolean }) {
  return (
    <div className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
  );
}

export function MatchTypeBadge({ matchType }: { matchType: string }) {
  const colors: Record<string, string> = {
    EXACT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PHRASE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    BROAD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[matchType] || 'bg-gray-100 text-gray-700'}`}>
      {matchType}
    </span>
  );
}

export function ConversionCell({
  acquisitions,
  firstRebills,
  attributionLevel
}: {
  acquisitions: number;
  firstRebills: number;
  attributionLevel?: string;
}) {
  return (
    <div className="flex items-center gap-1" title={attributionLevel === 'campaign' ? 'Atribución por campaña' : 'Atribución por keyword (utm_term)'}>
      <span className="text-blue-600 dark:text-blue-400 font-medium">{acquisitions}</span>
      <span className="text-gray-400">/</span>
      <span className="text-green-600 dark:text-green-400 font-medium">{firstRebills}</span>
      {attributionLevel === 'campaign' && (
        <span className="text-gray-400 text-xs">*</span>
      )}
    </div>
  );
}

export function PerformanceIndicator({ status }: { status: 'good' | 'warning' | 'poor' }) {
  const colors = {
    good: 'bg-green-500',
    warning: 'bg-yellow-500',
    poor: 'bg-red-500',
  };

  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
  );
}

export function ActionBadge({ action }: { action: string | null }) {
  if (!action) return <span className="text-gray-400">-</span>;

  const styles: Record<string, string> = {
    NEGATIVE_SUGGESTION: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    INTENT_MISMATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    PROMOTE_TO_KEYWORD: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    REVIEW_MATCH_TYPE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    SCALE_KEYWORD: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    MONITOR: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };

  const labels: Record<string, string> = {
    NEGATIVE_SUGGESTION: 'Negativizar',
    INTENT_MISMATCH: 'Intent. Incorrecta',
    PROMOTE_TO_KEYWORD: 'Promover',
    REVIEW_MATCH_TYPE: 'Revisar Match',
    SCALE_KEYWORD: 'Escalar',
    MONITOR: 'Monitorear',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[action] || styles.MONITOR}`}>
      {labels[action] || action}
    </span>
  );
}

export function TruncatedText({ text, maxLength = 30 }: { text: string; maxLength?: number }) {
  const truncated = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  return (
    <span title={text} className="block truncate max-w-[200px]">
      {truncated}
    </span>
  );
}
