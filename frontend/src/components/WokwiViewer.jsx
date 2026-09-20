import React, { useState, useRef } from 'react';
import { CircuitBoard } from 'lucide-react';
import BreadboardSvg from './BreadboardSvg.jsx';

function DraggablePart({ part, offsetX, offsetY }) {
  const [position, setPosition] = useState({ 
    x: part.left + offsetX, 
    y: part.top + offsetY 
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    e.target.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.target.releasePointerCapture(e.pointerId);
  };

  const ElementName = part.type;
  const isBreadboard = part.type.includes('breadboard');

  return (
    <div 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ 
        position: 'absolute', 
        top: position.y, 
        left: position.x,
        zIndex: isDragging ? 50 : (isBreadboard ? 1 : 10),
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none'
      }}
    >
      {isBreadboard ? (
        <BreadboardSvg 
          id={part.id}
          style={{
            transform: part.rotate ? `rotate(${part.rotate}deg)` : 'none',
            transformOrigin: 'top left',
            pointerEvents: 'none'
          }}
        />
      ) : (
        <ElementName
          id={part.id}
          style={{
            transform: part.rotate ? `rotate(${part.rotate}deg)` : 'none',
            transformOrigin: 'top left',
            pointerEvents: 'none'
          }}
          {...(part.attrs || {})}
        />
      )}
    </div>
  );
}

export default function WokwiViewer({ project, loading }) {
  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in-up">
        <div className="flex items-center gap-2">
          <CircuitBoard className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-300 tracking-wide uppercase">
            Wokwi Visualization
          </span>
        </div>
        <div className="skeleton w-full rounded-xl opacity-20" style={{ height: '400px' }} />
      </div>
    );
  }

  if (!project || !project.parts || project.parts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <CircuitBoard className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-300 tracking-wide uppercase">
            Wokwi Visualization
          </span>
        </div>
        <div className="bg-black/20 border border-white/10 rounded-xl p-8 shadow-sm text-center text-slate-500 text-sm">
          <CircuitBoard className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Upload a circuit image to see the Wokwi visualization
        </div>
      </div>
    );
  }

  // Wokwi coordinates can be negative. We apply an offset to ensure they are visible.
  const offsetX = 100;
  const offsetY = 50;

  return (
    <div className="space-y-3 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-1">
        <CircuitBoard className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-slate-300 tracking-wide uppercase">
          Wokwi Visualization (Drag components to align)
        </span>
      </div>

      <div 
        className="bg-black/40 border border-white/10 rounded-xl shadow-inner overflow-auto relative" 
        style={{ height: '500px', width: '100%' }}
      >
        <div 
          className="relative" 
          style={{ width: '800px', height: '600px', padding: '20px' }}
        >
          {project.parts.map((part) => (
            <DraggablePart 
              key={part.id} 
              part={part} 
              offsetX={offsetX} 
              offsetY={offsetY} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}
