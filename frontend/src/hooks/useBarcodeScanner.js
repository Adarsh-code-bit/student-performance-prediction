import { useEffect, useRef, useCallback } from 'react';

/**
 * useBarcodeScanner
 * Custom hook to detect USB / Bluetooth HID barcode scanners and keyboard wedges.
 * 
 * Supports:
 * - Scanners that send Enter at the end.
 * - Scanners that DO NOT send Enter (using rapid keystroke detection + debounce).
 * - Minimum barcode length filter (default: 3).
 * - Cooldown deduplication to prevent accidental rapid re-submissions.
 * - Selective input capture or global window capture.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minBarcodeLength = 3,
  maxKeystrokeInterval = 65, // ms between keystrokes typical of hardware scanners
  debounceTimeout = 110,     // ms to wait if scanner does not send Enter
  cooldownMs = 800,          // ms before the same or next scan is processed
  targetInputRef = null      // optional: limit scanner listener to specific input or listen globally
}) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const lastScannedBarcodeRef = useRef('');
  const lastScanTimeRef = useRef(0);
  const isRapidSequenceRef = useRef(false);

  const processScan = useCallback((raw) => {
    const cleaned = (raw || '').trim();
    if (!cleaned || cleaned.length < minBarcodeLength) return;

    const now = Date.now();
    // Prevent duplicate scan submissions within cooldown window
    if (cleaned === lastScannedBarcodeRef.current && (now - lastScanTimeRef.current < cooldownMs)) {
      return;
    }

    lastScannedBarcodeRef.current = cleaned;
    lastScanTimeRef.current = now;
    bufferRef.current = '';
    isRapidSequenceRef.current = false;

    if (onScan) {
      onScan(cleaned);
    }
  }, [onScan, minBarcodeLength, cooldownMs]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // If targetInputRef is provided, only listen on that input (or allow global if not in an input/textarea)
      const target = e.target;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (targetInputRef && targetInputRef.current) {
        if (target !== targetInputRef.current && isInput) {
          return;
        }
      } else if (isInput) {
        // If listening globally and user is typing in another regular input, do not intercept normal typing
        // unless it's designated with data-barcode-scanner
        if (!target.getAttribute('data-barcode-scanner')) {
          return;
        }
      }

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Check if this keystroke is part of a rapid scanner sequence
      if (interval < maxKeystrokeInterval) {
        isRapidSequenceRef.current = true;
      } else if (interval > 250) {
        // Human typing pause or new scan sequence
        bufferRef.current = '';
        isRapidSequenceRef.current = false;
      }

      // Scanner sends Enter
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minBarcodeLength) {
          e.preventDefault();
          e.stopPropagation();
          const scanValue = bufferRef.current;
          bufferRef.current = '';
          processScan(scanValue);
        }
        return;
      }

      // Printable single character
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key;

        // Fallback for scanners that DO NOT send Enter:
        // If we have detected rapid keystrokes and buffer is of adequate length, schedule debounce processing
        if (isRapidSequenceRef.current && bufferRef.current.length >= minBarcodeLength) {
          debounceTimerRef.current = setTimeout(() => {
            const scanValue = bufferRef.current;
            bufferRef.current = '';
            processScan(scanValue);
          }, debounceTimeout);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, minBarcodeLength, maxKeystrokeInterval, debounceTimeout, processScan, targetInputRef]);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    isRapidSequenceRef.current = false;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  return { resetBuffer, processScan };
}
