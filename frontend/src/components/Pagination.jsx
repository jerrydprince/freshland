import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

/**
 * A reusable pagination control with premium styling.
 * Props:
 * - currentPage: number (1‑based)
 * - totalPages: number
 * - onPageChange: (newPage: number) => void
 * - limit: number (items per page, optional for display)
 */
const Pagination = ({ currentPage, totalPages, onPageChange, limit }) => {
  if (totalPages <= 1) return null;

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };
  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-dark-900/60 p-3 rounded-2xl border border-dark-700 shadow-md">
      <div className="text-xs text-gray-400 font-medium">
        Showing Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
        {limit ? ` (· ${limit} items per page)` : ''}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={handlePrev}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-dark-800/80 text-gray-300 hover:bg-brand-500 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed group border border-dark-700"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-semibold text-[13px] tracking-wide">Prev</span>
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="px-2 text-gray-500 flex items-center justify-center">
                  <MoreHorizontal size={14} />
                </span>
              ) : (
                <button
                  onClick={() => onPageChange(page)}
                  className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-[13px] font-bold transition-all border ${
                    currentPage === page
                      ? 'bg-brand-500 text-white border-brand-500 shadow-[0_0_10px_rgba(223,104,83,0.3)]'
                      : 'bg-dark-800/50 text-gray-400 border-dark-700 hover:border-brand-500/50 hover:text-brand-400 hover:bg-dark-800'
                  }`}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-dark-800/80 text-gray-300 hover:bg-brand-500 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed group border border-dark-700"
          aria-label="Next page"
        >
          <span className="font-semibold text-[13px] tracking-wide">Next</span>
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
