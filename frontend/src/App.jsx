import { useState, useCallback, useRef } from 'react';
import { Zap, Loader2, AlertTriangle, RotateCcw, Sparkles } from 'lucide-react';
import UploadZone from './components/UploadZone.jsx';
import ComponentBanner from './components/ComponentBanner.jsx';
import SvgOverlay from './components/SvgOverlay.jsx';
import LabReport from './components/LabReport.jsx';
import { runFullPipeline } from './lib/api.js';

export default function App() {
  // ── Upload state ──
  const [circuitFiles, setCircuitFiles] = useState([]);
  const [manualFiles, setManualFiles] = useState([]);

  // ── Backend response state (matches /api/analyze response) ──
  const [analysis, setAnalysis] = useState(null);   // Gemini structured JSON
  const [ocrResults, setOcrResults] = useState([]);  // Rekognition OCR
  const [detections, setDetections] = useState(null); // Roboflow detections

  // ── Derived display state ──
  const [components, setComponents] = useState([]);  // Editable component list
  const [netlist, setNetlist] = useState(null);       // For SVG overlay
  const [reportMd, setReportMd] = useState(null);    // Generated markdown

  // ── UI state ──
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // Track the S3 key from the last upload
  const s3KeyRef = useRef(null);

  /**
   * Transform the Gemini analysis JSON into display-friendly structures.
   */
  const processAnalysisResult = useCallback((result) => {
    const { analysis: analysisData, ocr, detections: dets } = result;

    setOcrResults(ocr || []);
    setDetections(dets || null);

    if (!analysisData) return;

    setAnalysis(analysisData);

    // ── Extract components for the editable banner ──
    const comps = (analysisData.components || []).map((c) => {
      const label = c.type || c.id || 'Unknown';
      return label;
    });
    setComponents(comps);

    // ── Map connections to SVG netlist format ──
    // The backend returns connections with from/to as descriptive strings.
    // We extract any breadboard coordinates (e.g., "row 15 col A") and
    // also map connection status to our SVG overlay status.
    if (analysisData.connections && analysisData.connections.length > 0) {
      const wires = analysisData.connections.map((conn) => {
        const status = conn.status === 'correct' ? 'correct'
          : conn.status === 'missing' ? 'error'
          : conn.status === 'wrong' ? 'error'
          : 'neutral';

        return {
          from: conn.from,
          to: conn.to,
          status,
          note: conn.note || '',
        };
      });

      setNetlist({
        wires,
        raw_connections: analysisData.connections,
      });
    }

    // ── Build a markdown report from the structured analysis ──
    const md = buildReportMarkdown(analysisData);
    setReportMd(md);
  }, []);

  /**
   * Primary analysis — compress, upload to S3, analyze.
   */
  const runDiagnostic = useCallback(async () => {
    if (circuitFiles.length === 0) {
      setError('Please upload a breadboard photo first.');
      return;
    }

    setLoading(true);
    setError(null);
    setProgressMsg('Starting…');

    try {
      const result = await runFullPipeline(circuitFiles[0], {
        labContext: manualFiles.length > 0
          ? `User uploaded ${manualFiles.length} lab manual reference image(s) for context.`
          : undefined,
        onProgress: setProgressMsg,
      });

      s3KeyRef.current = result.s3Key;
      processAnalysisResult(result);
      setHasAnalyzed(true);
    } catch (err) {
      console.error('Diagnostic failed:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  }, [circuitFiles, manualFiles, processAnalysisResult]);

  /**
   * Handle component banner edits — update displayed components.
   * (Re-analysis would require re-uploading; here we just update the local state.)
   */
  const handleComponentsChange = useCallback((updated) => {
    setComponents(updated);
  }, []);

  /**
   * Reset everything.
   */
  const handleReset = useCallback(() => {
    setCircuitFiles([]);
    setManualFiles([]);
    setComponents([]);
    setAnalysis(null);
    setOcrResults([]);
    setDetections(null);
    setNetlist(null);
    setReportMd(null);
    setError(null);
    setHasAnalyzed(false);
    setProgressMsg('');
    s3KeyRef.current = null;
  }, []);

  const canAnalyze = circuitFiles.length > 0 && !loading;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight tracking-tight">
                CircuitLens
              </h1>
              <p className="text-[11px] text-slate-400 leading-none -mt-0.5">
                AI-Powered Circuit Diagnostics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasAnalyzed && (
              <button
                onClick={handleReset}
                className="
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                  text-sm font-medium text-slate-600
                  border border-slate-200 bg-white
                  hover:bg-slate-50 hover:border-slate-300
                  transition-all duration-200 no-print
                "
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New Analysis
              </button>
            )}
            <div className="h-5 w-px bg-slate-200 mx-1 no-print" />
            <span className="text-xs text-slate-400 no-print font-mono">
              Gemini 2.5 Flash
            </span>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-5 py-4 animate-fade-in-up">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-rose-800">
                Analysis Error
              </p>
              <p className="text-sm text-rose-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-rose-400 hover:text-rose-600 transition-colors text-lg leading-none"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Component Banner (shown after analysis) */}
        {(hasAnalyzed || loading) && (
          <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <ComponentBanner
              components={components}
              onComponentsChange={handleComponentsChange}
              loading={loading && !hasAnalyzed}
            />
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left — Upload Zones */}
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <UploadZone
                variant="circuit"
                files={circuitFiles}
                onFilesChange={setCircuitFiles}
                multiple={false}
              />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <UploadZone
                variant="manual"
                files={manualFiles}
                onFilesChange={setManualFiles}
                multiple={true}
              />
            </div>

            {/* Analyze button */}
            <button
              disabled={!canAnalyze}
              onClick={runDiagnostic}
              className={`
                w-full py-3.5 rounded-xl font-semibold text-sm
                flex items-center justify-center gap-2
                transition-all duration-300 shadow-sm
                no-print
                ${
                  canAnalyze
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-200 active:scale-[0.98]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progressMsg || 'Analyzing Circuit…'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {hasAnalyzed ? 'Re-Analyze Circuit' : 'Analyze Circuit'}
                </>
              )}
            </button>
          </div>

          {/* Right — Analysis results */}
          <div className="space-y-5">
            {/* SVG Breadboard */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <SvgOverlay netlist={netlist} loading={loading && !hasAnalyzed} />
            </div>

            {/* Analysis Summary Card (quick-look from Gemini) */}
            {analysis && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm animate-fade-in-up">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    Quick Summary
                  </h3>
                  {analysis.confidence != null && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      analysis.confidence >= 0.8 ? 'bg-emerald-50 text-emerald-700'
                      : analysis.confidence >= 0.5 ? 'bg-amber-50 text-amber-700'
                      : 'bg-rose-50 text-rose-700'
                    }`}>
                      {Math.round(analysis.confidence * 100)}% confidence
                    </span>
                  )}
                </div>

                {analysis.circuit_type && (
                  <p className="text-sm text-indigo-600 font-medium mb-2">
                    {analysis.circuit_type}
                  </p>
                )}
                {analysis.summary && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {analysis.summary}
                  </p>
                )}

                {/* Error/hazard counts */}
                <div className="flex gap-3 mt-3">
                  {analysis.errors?.length > 0 && (
                    <span className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded-full font-medium">
                      {analysis.errors.length} error{analysis.errors.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {analysis.safety_hazards?.length > 0 && (
                    <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium">
                      {analysis.safety_hazards.length} hazard{analysis.safety_hazards.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {(!analysis.errors?.length && !analysis.safety_hazards?.length) && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-medium">
                      No issues detected
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom — Lab Report */}
        {(reportMd || (loading && !hasAnalyzed)) && (
          <div className="mb-8">
            <LabReport markdown={reportMd} loading={loading && !hasAnalyzed} />
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-6 border-t border-slate-100 no-print">
          <p className="text-xs text-slate-400">
            Built with Gemini 2.5 Flash &amp; AWS · AWS Hackathon 2026 · CircuitLens v1.0
          </p>
        </footer>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Build a Markdown lab report from the Gemini structured analysis JSON
// ─────────────────────────────────────────────────────────────────────────────

function buildReportMarkdown(analysis) {
  const lines = [];

  lines.push('# Circuit Analysis Report');
  lines.push('');

  // Circuit type
  if (analysis.circuit_type) {
    lines.push('## Circuit Identification');
    lines.push('');
    lines.push(analysis.circuit_type);
    lines.push('');
  }

  // Summary
  if (analysis.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(analysis.summary);
    lines.push('');
  }

  // Components table
  if (analysis.components?.length > 0) {
    lines.push('## Detected Components');
    lines.push('');
    lines.push('| ID | Type | Location | Orientation |');
    lines.push('|----|------|----------|-------------|');
    for (const comp of analysis.components) {
      lines.push(
        `| ${comp.id || '—'} | ${comp.type || '—'} | ${comp.location || '—'} | ${comp.orientation || '—'} |`
      );
    }
    lines.push('');
  }

  // Connections table
  if (analysis.connections?.length > 0) {
    lines.push('## Wiring Connections');
    lines.push('');
    lines.push('| From | To | Status | Note |');
    lines.push('|------|----|--------|------|');
    for (const conn of analysis.connections) {
      const statusIcon = conn.status === 'correct' ? '✅'
        : conn.status === 'missing' ? '❌'
        : conn.status === 'wrong' ? '⚠️'
        : '—';
      lines.push(
        `| ${conn.from || '—'} | ${conn.to || '—'} | ${statusIcon} ${conn.status || '—'} | ${conn.note || '—'} |`
      );
    }
    lines.push('');
  }

  // Errors
  if (analysis.errors?.length > 0) {
    lines.push('## Errors Found');
    lines.push('');
    for (const err of analysis.errors) {
      const icon = err.severity === 'critical' ? '🔴'
        : err.severity === 'warning' ? '🟡'
        : 'ℹ️';
      lines.push(`### ${icon} ${err.severity?.toUpperCase() || 'ERROR'}`);
      lines.push('');
      lines.push(`**Problem:** ${err.description}`);
      lines.push('');
      if (err.fix) {
        lines.push(`**Fix:** ${err.fix}`);
        lines.push('');
      }
    }
  }

  // Safety hazards
  if (analysis.safety_hazards?.length > 0) {
    lines.push('## ⚠️ Safety Hazards');
    lines.push('');
    for (const hazard of analysis.safety_hazards) {
      lines.push(`- **${hazard.component || 'Unknown'}**: ${hazard.issue}`);
      if (hazard.action) {
        lines.push(`  - *Action:* ${hazard.action}`);
      }
    }
    lines.push('');
  }

  // Confidence
  if (analysis.confidence != null) {
    lines.push('---');
    lines.push('');
    lines.push(`> Analysis confidence: **${Math.round(analysis.confidence * 100)}%**`);
    lines.push('');
  }

  return lines.join('\n');
}
