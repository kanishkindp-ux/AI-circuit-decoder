import React from 'react';
import { Zap, Camera, Lightbulb, CheckCircle, ArrowRight } from 'lucide-react';

export default function LandingPage({ onStart }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 relative overflow-hidden flex flex-col font-sans">
      {/* Background ambient blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">CircuitLens</h1>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8 animate-fade-in-up">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          Next-Generation Hardware Diagnostics
        </div>
        
        <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          Debug Circuits with <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400">
            Artificial Intelligence
          </span>
        </h2>
        
        <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl leading-relaxed animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          Upload a photo of your breadboard and instantly detect wiring errors, missing components, and polarity issues. Visualize your hardware in a fully interactive digital twin.
        </p>
        
        <button 
          onClick={onStart}
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-bold text-white bg-white/10 rounded-2xl overflow-hidden backdrop-blur-md border border-white/20 transition-all hover:bg-white/20 hover:scale-105 active:scale-95 animate-fade-in-up"
          style={{ animationDelay: '300ms' }}
        >
          {/* Subtle button glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-white/10 to-violet-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 translate-x-[-100%] group-hover:translate-x-[100%]" />
          
          Get Started
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </main>

      {/* Features Grid */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 pb-20 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Instant Scanning</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Snap a picture of your physical breadboard. Our vision models map every wire and component in seconds.
            </p>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Automated Diagnostics</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Find missing ground connections, reversed polarity LEDs, and dangerous short circuits before you power on.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center mb-4">
              <Lightbulb className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Interactive Digital Twin</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Visualize your layout in an interactive digital canvas. Drag and drop components to fix alignments instantly.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
