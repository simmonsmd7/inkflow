/**
 * SignaturePad component for capturing signatures via touch/mouse.
 * Supports both desktop (mouse) and mobile (touch) input.
 */

import { useRef, useEffect, useState, useCallback } from 'react';

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  className?: string;
  disabled?: boolean;
}

export function SignaturePad({
  onSignatureChange,
  width = 500,
  height = 200,
  penColor = '#000000',
  backgroundColor = '#ffffff',
  className = '',
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Fill with background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Set up drawing style
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height, penColor, backgroundColor]);

  // Get coordinates from event (handles both mouse and touch)
  const getCoordinates = useCallback(
    (event: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ('touches' in event) {
        if (event.touches.length === 0) return null;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  // Start drawing
  const startDrawing = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (disabled) return;
      event.preventDefault();

      const coords = getCoordinates(event);
      if (!coords) return;

      setIsDrawing(true);
      lastPositionRef.current = coords;
    },
    [disabled, getCoordinates]
  );

  // Draw line
  const draw = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (!isDrawing || disabled) return;
      event.preventDefault();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const coords = getCoordinates(event);
      if (!coords || !lastPositionRef.current) return;

      ctx.beginPath();
      ctx.moveTo(lastPositionRef.current.x, lastPositionRef.current.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      lastPositionRef.current = coords;
      setIsEmpty(false);
    },
    [isDrawing, disabled, getCoordinates]
  );

  // Stop drawing
  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);
    lastPositionRef.current = null;

    // Export signature data
    const canvas = canvasRef.current;
    if (canvas && !isEmpty) {
      onSignatureChange(canvas.toDataURL('image/png'));
    }
  }, [isDrawing, isEmpty, onSignatureChange]);

  // Attach event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
      canvas.removeEventListener('touchcancel', stopDrawing);
    };
  }, [startDrawing, draw, stopDrawing]);

  // Clear the signature pad
  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    setIsEmpty(true);
    onSignatureChange(null);
  }, [width, height, backgroundColor, onSignatureChange]);

  return (
    <div className={`inline-block ${className}`}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className={`border-2 rounded-lg touch-none ${
            disabled
              ? 'border-ink-600 bg-ink-800 cursor-not-allowed'
              : 'border-ink-500 bg-white cursor-crosshair'
          }`}
          style={{ width, height }}
        />
        {isEmpty && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-ink-400 text-sm">Sign here using your mouse or finger</span>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-ink-400">
          {isEmpty ? 'No signature' : 'Signature captured'}
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || isEmpty}
          className="px-3 py-1 text-xs font-medium text-ink-300 bg-ink-700 rounded hover:bg-ink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default SignaturePad;
