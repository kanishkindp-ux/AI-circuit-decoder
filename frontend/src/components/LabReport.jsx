import { useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, Download, Printer } from 'lucide-react';

/**
 * Lab Report section — renders markdown as formatted document,
 * with PDF export via html2pdf.js or browser print.
 *
 * @param {Object} props
 * @param {string|null} props.markdown — generated markdown report
 * @param {boolean} props.loading — show skeleton
 */
export default function LabReport({ markdown, loading }) {
  const reportRef = useRef(null);

  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current) return;

    try {
      const html2pdf = (await import('html2pdf.js')).default;

      const opt = {
        margin: [0.6, 0.6, 0.6, 0.6],
        filename: `CircuitLens_Lab_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: {
          unit: 'in',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      await html2pdf().set(opt).from(reportRef.current).save();
    } catch (err) {
      console.error('PDF export failed, falling back to print:', err);
      window.print();
    }
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in-up">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
            Lab Report
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
          <div className="skeleton h-8 w-2/3 rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-5/6 rounded" />
          <div className="skeleton h-4 w-4/5 rounded" />
          <div className="skeleton h-20 w-full rounded mt-4" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-3/4 rounded" />
        </div>
      </div>
    );
  }

  if (!markdown) {
    return null;
  }

  return (
    <div className="space-y-3 animate-fade-in-up">
      {/* Header with export buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
            Generated Lab Report
          </span>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            onClick={handlePrint}
            className="
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              text-sm font-medium text-slate-600
              border border-slate-200 bg-white
              hover:bg-slate-50 hover:border-slate-300
              transition-all duration-200
              shadow-sm
            "
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button
            onClick={handleExportPDF}
            className="
              inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg
              text-sm font-medium text-white
              bg-indigo-600 hover:bg-indigo-700
              transition-all duration-200
              shadow-sm hover:shadow
            "
          >
            <Download className="w-3.5 h-3.5" />
            Export to PDF
          </button>
        </div>
      </div>

      {/* Report document card */}
      <div
        ref={reportRef}
        className="bg-white border border-slate-200 rounded-xl shadow-sm"
      >
        {/* Document header bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs text-slate-400 ml-2 font-mono">
            lab_report.md
          </span>
        </div>

        {/* Markdown content */}
        <div className="report-content px-8 py-6 max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
