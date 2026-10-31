import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as ZXing from 'html5-qrcode/third_party/zxing-js.umd.js';
import { Camera, X, AlertCircle, RefreshCw, CheckCircle, Keyboard, Zap, Play } from 'lucide-react';

/**
 * Standard EAN-13 module encoding definitions.
 * Used for drawing high-contrast, mathematically exact barcodes onto a live video stream.
 */
const L_PATTERNS = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];
const G_PATTERNS = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];
const R_PATTERNS = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'
];
const PARITY_MAP = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

function generateEan13ModuleBits(digits) {
  if (!digits || digits.length !== 13) return null;
  const first = parseInt(digits[0], 10);
  const parity = PARITY_MAP[first];
  let bits = '101'; // start guard

  // 6 left digits
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(digits[i + 1], 10);
    const useG = parity[i] === 'G';
    bits += useG ? G_PATTERNS[digit] : L_PATTERNS[digit];
  }

  bits += '01010'; // center guard

  // 6 right digits
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(digits[i + 7], 10);
    bits += R_PATTERNS[digit];
  }

  bits += '101'; // end guard
  return bits;
}

/**
 * Draws an EAN-13 barcode onto a canvas with quiet zones and human-readable text.
 */
function renderBarcodeToCanvas(canvas, barcodeDigits) {
  const bits = generateEan13ModuleBits(barcodeDigits);
  if (!bits) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Clear white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const scale = 5;
  const quietZone = 14;
  const totalBarcodeWidth = (bits.length + quietZone * 2) * scale;
  const startX = Math.max(0, Math.floor((width - totalBarcodeWidth) / 2));
  const startY = Math.floor(height * 0.15);
  const barHeight = Math.floor(height * 0.65);

  ctx.fillStyle = '#000000';
  for (let m = 0; m < bits.length; m++) {
    if (bits[m] === '1') {
      const isGuard = m < 3 || (m >= 45 && m < 50) || m >= 92;
      const extraGuardHeight = isGuard ? 14 : 0;
      ctx.fillRect(
        startX + (quietZone + m) * scale,
        startY,
        scale,
        barHeight + extraGuardHeight
      );
    }
  }

  // Draw human-readable numbers
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(barcodeDigits, width / 2, startY + barHeight + 36);
}

/**
 * Synthesizes an audible confirmation beep on successful barcode detection.
 */
function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // AudioContext autoplay restriction fallback
  }
}

/**
 * CameraBarcodeScannerModal
 * 
 * High-performance, unscaled camera barcode scanner with a dual-engine architecture:
 * 1. Primary Engine: Native Browser BarcodeDetector (hardware accelerated) if available.
 * 2. Secondary Engine: ZXing MultiFormatReader operating on full-resolution unscaled frames with TRY_HARDER: true.
 * 
 * Accurately detects 1D barcodes (EAN-13, EAN-8, UPC-A, UPC-E, Code 128) and 2D QR codes.
 */
const CameraBarcodeScannerModal = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Product Barcode'
}) => {
  const [errorMessage, setErrorMessage] = useState(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(null);
  const [detectionSource, setDetectionSource] = useState(null);
  const [diagnostics, setDiagnostics] = useState({
    cameraStatus: 'Initializing...',
    videoDimensions: 'Unknown',
    activeEngine: 'ZXing High-Res (TRY_HARDER=true)',
    detectionLoopStatus: 'Initializing...',
    framesProcessed: 0,
    lastDecodingError: 'None (searching)',
    lastDecodedBarcode: 'None'
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const isProcessingRef = useRef(false);
  const framesCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const offscreenCanvasRef = useRef(null);
  const virtualCanvasIntervalRef = useRef(null);
  const zxingReaderRef = useRef(null);
  const nativeDetectorRef = useRef(null);

  // Stop camera and cleanup all active tracks and animation frames
  const stopScanner = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (virtualCanvasIntervalRef.current) {
      clearInterval(virtualCanvasIntervalRef.current);
      virtualCanvasIntervalRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`[CameraScanner] Stopped track: ${track.label}`);
        });
      } catch (err) {
        console.warn('[CameraScanner] Stream track stop warning:', err);
      } finally {
        streamRef.current = null;
      }
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  }, []);

  // Handle successful detection from either engine
  const handleScanSuccess = useCallback((rawCode, engineName) => {
    if (isProcessingRef.current) return;
    
    const cleaned = String(rawCode || '').trim();
    if (!cleaned) return;

    isProcessingRef.current = true;
    setScanSuccess(cleaned);
    setDetectionSource(engineName);
    setDiagnostics(prev => ({
      ...prev,
      lastDecodedBarcode: cleaned,
      lastDecodingError: 'None (Decoded successfully)',
      detectionLoopStatus: 'Barcode Detected'
    }));
    console.log(`[CameraScanner] SUCCESS: Decoded "${cleaned}" via ${engineName}`);

    playSuccessBeep();

    // Stop scanner and notify parent
    stopScanner();
    if (onScan) {
      onScan(cleaned);
    }
    // Brief visual confirmation before closing
    setTimeout(() => {
      onClose();
    }, 420);
  }, [onScan, onClose, stopScanner]);

  // Starts the continuous unscaled optical frame detection loop
  const startDetectionLoop = useCallback((videoElement) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offCanvas = offscreenCanvasRef.current;

    const processFrame = async (now) => {
      if (isProcessingRef.current) return;

      // Throttle to ~20 fps (~50ms) for high detection responsiveness
      if (now - lastFrameTimeRef.current >= 50) {
        lastFrameTimeRef.current = now;
        framesCountRef.current++;

        if (videoElement && videoElement.readyState >= 2 && !videoElement.paused && !videoElement.ended) {
          const vWidth = videoElement.videoWidth || 640;
          const vHeight = videoElement.videoHeight || 480;

          if (offCanvas.width !== vWidth || offCanvas.height !== vHeight) {
            offCanvas.width = vWidth;
            offCanvas.height = vHeight;
          }

          const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(videoElement, 0, 0, vWidth, vHeight);

          // Update HUD
          setDiagnostics(prev => ({
            ...prev,
            cameraStatus: streamRef.current?.isVirtual ? 'Active / Optical Test Stream' : 'Active / Streaming',
            videoDimensions: `${vWidth}x${vHeight}`,
            framesProcessed: framesCountRef.current,
            detectionLoopStatus: 'Active / Processing'
          }));

          let detectedCode = null;
          let detectedEngine = null;

          // Engine 1: Native BarcodeDetector (GPU)
          if (nativeDetectorRef.current) {
            try {
              const nativeResults = await nativeDetectorRef.current.detect(offCanvas);
              if (nativeResults && nativeResults.length > 0) {
                const first = nativeResults[0].rawValue;
                if (first && first.trim()) {
                  detectedCode = first.trim();
                  detectedEngine = 'Native BarcodeDetector (GPU)';
                }
              }
            } catch (natErr) {
              // Pass
            }
          }

          // Engine 2: ZXing High-Resolution Engine with TRY_HARDER = true
          if (!detectedCode && zxingReaderRef.current) {
            try {
              const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(offCanvas);
              const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource));
              const zxingResult = zxingReaderRef.current.decode(binaryBitmap);
              if (zxingResult && zxingResult.getText()) {
                detectedCode = zxingResult.getText().trim();
                detectedEngine = 'ZXing High-Res Engine (TRY_HARDER)';
              }
            } catch (zxingErr) {
              // Not found in this frame - normal while searching
              if (framesCountRef.current % 12 === 0) {
                setDiagnostics(prev => ({
                  ...prev,
                  lastDecodingError: zxingErr?.message || 'Searching for barcode pattern...'
                }));
              }
            }
          }

          if (detectedCode && !isProcessingRef.current) {
            handleScanSuccess(detectedCode, detectedEngine);
            return;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    };

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [handleScanSuccess]);

  // Inject a live optical barcode video stream into the scanner
  const injectVirtualBarcodeStream = useCallback((barcodeToStream = '8901234567890') => {
    try {
      console.log(`[CameraScanner] Injecting optical camera stream for ${barcodeToStream}...`);
      if (virtualCanvasIntervalRef.current) {
        clearInterval(virtualCanvasIntervalRef.current);
      }

      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 450;
      renderBarcodeToCanvas(canvas, barcodeToStream);

      // Animation interval to keep stream active with frame changes
      let angle = 0;
      virtualCanvasIntervalRef.current = setInterval(() => {
        angle = (angle + 1) % 360;
        const ctx = canvas.getContext('2d');
        // Redraw barcode
        renderBarcodeToCanvas(canvas, barcodeToStream);
        // Draw moving scanline
        const scanY = 100 + Math.sin(angle * 0.05) * 120;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.fillRect(40, scanY, 720, 3);
      }, 40);

      const stream = canvas.captureStream ? canvas.captureStream(25) : null;
      if (!stream) {
        throw new Error('canvas.captureStream not supported in this browser');
      }
      stream.isVirtual = true;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      streamRef.current = stream;

      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.play().then(() => {
          startDetectionLoop(videoElement);
        }).catch(e => console.warn('Play virtual stream notice:', e));
      }

      setErrorMessage(null);
      setIsScanning(true);
      setDiagnostics(prev => ({
        ...prev,
        cameraStatus: 'Active / Optical Test Stream',
        activeEngine: 'ZXing High-Res (TRY_HARDER=true)',
        detectionLoopStatus: 'Active / Processing'
      }));
    } catch (err) {
      console.error('[CameraScanner] Failed to inject virtual barcode stream:', err);
    }
  }, [startDetectionLoop]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    isProcessingRef.current = false;
    setErrorMessage(null);
    setScanSuccess(null);
    setDetectionSource(null);
    framesCountRef.current = 0;

    const startScanner = async () => {
      // Allow modal DOM to render video element
      await new Promise(r => setTimeout(r, 60));
      if (!isMounted) return;

      try {
        setDiagnostics(prev => ({
          ...prev,
          cameraStatus: 'Detecting camera & engines...',
          detectionLoopStatus: 'Preparing...'
        }));

        // 1. Initialize ZXing MultiFormatReader with TRY_HARDER = true
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_A,
          ZXing.BarcodeFormat.UPC_E,
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.QR_CODE
        ]);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

        const zxingReader = new ZXing.MultiFormatReader(false, hints);
        zxingReaderRef.current = zxingReader;
        let activeEngineLabel = 'ZXing High-Res (TRY_HARDER=true)';

        // 2. Check for native BarcodeDetector API
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const supported = await window.BarcodeDetector.getSupportedFormats();
            const targets = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
            const available = targets.filter(t => supported.includes(t));
            if (available.length > 0) {
              nativeDetectorRef.current = new window.BarcodeDetector({ formats: available });
              activeEngineLabel = `Native GPU (${available.join(', ')}) + ZXing`;
              console.log('[CameraScanner] Native BarcodeDetector available for:', available);
            }
          } catch (detErr) {
            console.warn('[CameraScanner] Native BarcodeDetector format check notice:', detErr);
          }
        }

        setDiagnostics(prev => ({
          ...prev,
          activeEngine: activeEngineLabel
        }));

        // 3. Resilient Camera Stream Acquisition with a strict timeout race (no hanging promises)
        const fetchStreamWithTimeout = async (constraints, timeoutMs = 2500) => {
          return Promise.race([
            navigator.mediaDevices.getUserMedia(constraints),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Camera acquisition timed out')), timeoutMs))
          ]);
        };

        let stream = null;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            // Attempt 1: Ideal environment camera with HD resolution
            stream = await fetchStreamWithTimeout({
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 }
              },
              audio: false
            }, 2500);
          } catch (envErr) {
            console.warn('[CameraScanner] Ideal environment stream unavailable, attempting default camera:', envErr);
            try {
              // Attempt 2: Any HD camera (front webcam or desktop camera)
              stream = await fetchStreamWithTimeout({
                video: {
                  width: { ideal: 1280, min: 640 },
                  height: { ideal: 720, min: 480 }
                },
                audio: false
              }, 2000);
            } catch (hdErr) {
              console.warn('[CameraScanner] HD camera stream unavailable, attempting unconstrained video:', hdErr);
              // Attempt 3: Any video device
              stream = await fetchStreamWithTimeout({ video: true, audio: false }, 1500);
            }
          }
        } else {
          throw new Error('navigator.mediaDevices.getUserMedia not supported in this environment');
        }

        if (!isMounted) {
          if (stream) stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        // 4. Bind stream to HTML5 video element
        const videoElement = videoRef.current;
        if (!videoElement) {
          throw new Error('Video container element missing');
        }

        videoElement.srcObject = stream;
        await videoElement.play();

        setIsScanning(true);
        setDiagnostics(prev => ({
          ...prev,
          cameraStatus: 'Active / Streaming',
          detectionLoopStatus: 'Active / Processing',
          activeEngine: activeEngineLabel
        }));

        // 5. Start frame detection loop
        startDetectionLoop(videoElement);

      } catch (err) {
        if (!isMounted) return;
        console.error('[CameraScanner] Start error:', err);
        setIsScanning(false);
        setDiagnostics(prev => ({
          ...prev,
          cameraStatus: 'Error / Unavailable',
          detectionLoopStatus: 'Stopped',
          lastDecodingError: String(err.message || err)
        }));

        const errorStr = String(err).toLowerCase();
        if (errorStr.includes('notallowederror') || errorStr.includes('permission denied')) {
          setErrorMessage('Camera access was denied. Please allow camera permissions in your browser or enter the barcode manually below.');
        } else if (errorStr.includes('notfounderror') || errorStr.includes('requested device not found')) {
          setErrorMessage('No physical camera device detected on this workstation. You can enter the barcode manually or run the optical test feed below.');
        } else if (errorStr.includes('notreadableerror') || errorStr.includes('already in use')) {
          setErrorMessage('Camera is currently in use by another program. Close the other app and retry.');
        } else {
          setErrorMessage('Camera is not currently accessible on this device. You can enter the barcode manually or run the optical stream test below.');
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen, handleScanSuccess, stopScanner, startDetectionLoop]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const cleaned = manualBarcode.trim();
    if (!cleaned) return;
    if (onScan) {
      onScan(cleaned);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 leading-tight m-0">{title}</h3>
              <p className="text-[11px] text-slate-500 m-0">Auto-detecting product barcodes</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-xl hover:bg-slate-200"
            title="Close scanner"
          >
            <X size={20} />
          </button>
        </div>

        {/* Camera Viewport & Active Scan Frame */}
        <div className="p-4 sm:p-5">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 min-h-[260px] max-h-[360px] flex items-center justify-center border border-slate-800 shadow-inner">
            {/* Native HTML5 Video Element */}
            <video 
              ref={videoRef}
              id="barcode-video-element"
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover min-h-[260px]"
            />

            {/* Target Reticle Viewfinder Overlay */}
            {isScanning && !scanSuccess && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-10">
                {/* Widescreen Barcode Target Box */}
                <div className="relative w-full max-w-[280px] h-[130px] rounded-xl border-2 border-emerald-400/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Corner Target Accents */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-emerald-400 rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-emerald-400 rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-emerald-400 rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-emerald-400 rounded-br" />

                  {/* Animated Laser Scanning Line */}
                  <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-emerald-500/0 via-emerald-400 to-emerald-500/0 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" 
                       style={{ 
                         animation: 'scanLaser 2s ease-in-out infinite alternate',
                         top: '50%'
                       }} 
                  />
                </div>

                <span className="text-[11px] font-semibold text-emerald-200 mt-3 drop-shadow bg-black/60 px-2.5 py-0.5 rounded-full">
                  Align barcode inside frame
                </span>
              </div>
            )}

            {/* Recognition Success Overlay */}
            {scanSuccess && (
              <div className="absolute inset-0 bg-emerald-600/95 text-white flex flex-col items-center justify-center p-5 z-20 animate-fadeIn">
                <CheckCircle size={48} className="mb-2 text-white animate-bounce" />
                <span className="font-extrabold text-lg">Barcode Recognized!</span>
                <span className="font-mono text-base font-black bg-white/20 px-3 py-1 rounded-lg mt-1 tracking-wider">
                  {scanSuccess}
                </span>
                {detectionSource && (
                  <span className="text-[10px] text-emerald-100 mt-1 opacity-90">
                    Engine: {detectionSource}
                  </span>
                )}
              </div>
            )}

            {/* Connecting State */}
            {!isScanning && !errorMessage && !scanSuccess && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4">
                <RefreshCw size={30} className="animate-spin mb-2 text-emerald-400" />
                <span className="text-xs font-medium">Starting camera video stream...</span>
              </div>
            )}

            {/* Error Overlay */}
            {errorMessage && (
              <div className="absolute inset-0 bg-slate-900/95 text-slate-200 flex flex-col items-center justify-center p-5 text-center z-20">
                <AlertCircle size={40} className="text-amber-400 mb-2" />
                <span className="font-bold text-sm text-amber-300">Camera Unavailable</span>
                <p className="text-xs text-slate-300 mt-1 max-w-xs">{errorMessage}</p>
              </div>
            )}
          </div>

          {/* Real-time Scanner Diagnostic Status Panel */}
          <div className="mt-3 p-3 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono border border-slate-800 shadow-sm" id="scanner-diagnostics-panel">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800 text-[11px] font-sans font-bold text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className={`w-2 h-2 rounded-full ${diagnostics.cameraStatus.includes('Active') ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                Scanner Diagnostics HUD
              </span>
              <span className="text-slate-400 font-mono text-[10px]">{diagnostics.activeEngine}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div>
                <span className="text-slate-400">Camera status: </span>
                <span className={`font-semibold ${diagnostics.cameraStatus.includes('Active') ? 'text-emerald-400' : 'text-amber-400'}`} id="diag-camera-status">
                  {diagnostics.cameraStatus}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Video dimensions: </span>
                <span className="text-slate-200 font-semibold" id="diag-video-dimensions">
                  {diagnostics.videoDimensions}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Active engine: </span>
                <span className="text-emerald-300 font-semibold truncate block" id="diag-active-engine">
                  {diagnostics.activeEngine}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Detection loop: </span>
                <span className={`font-semibold ${diagnostics.detectionLoopStatus.includes('Active') ? 'text-emerald-400' : 'text-slate-300'}`} id="diag-detection-loop">
                  {diagnostics.detectionLoopStatus}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Frames processed: </span>
                <span className="text-cyan-400 font-bold" id="diag-frames-processed">
                  {diagnostics.framesProcessed}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Last decoded: </span>
                <span className="text-emerald-400 font-bold" id="diag-last-decoded">
                  {diagnostics.lastDecodedBarcode}
                </span>
              </div>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] truncate text-slate-400">
              <span className="text-slate-400 font-semibold">Last decoding error: </span>
              <span className="text-slate-300" id="diag-last-error" title={diagnostics.lastDecodingError}>
                {diagnostics.lastDecodingError}
              </span>
            </div>

            {/* Test Simulation & Virtual Optical Stream Actions */}
            <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[10px] text-slate-400">Stream Optical Test:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  id="btn-feed-test-barcode"
                  onClick={() => injectVirtualBarcodeStream('8901234567890')}
                  className="text-[10px] bg-cyan-900/90 hover:bg-cyan-800 text-cyan-200 px-2 py-0.5 rounded border border-cyan-500/50 flex items-center gap-1 transition-all active:scale-95 font-semibold"
                  title="Stream Cold Drinks EAN-13 live into camera video element"
                >
                  <Play size={11} className="text-cyan-300 fill-cyan-300" />
                  <span>Optical Stream (Cold Drinks)</span>
                </button>
                <button
                  type="button"
                  id="btn-feed-kurkure-barcode"
                  onClick={() => injectVirtualBarcodeStream('8901491100533')}
                  className="text-[10px] bg-indigo-900/90 hover:bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded border border-indigo-500/50 flex items-center gap-1 transition-all active:scale-95 font-semibold"
                  title="Stream Kurkure EAN-13 live into camera video element"
                >
                  <Play size={11} className="text-indigo-300 fill-indigo-300" />
                  <span>Optical Stream (Kurkure)</span>
                </button>
                <button
                  type="button"
                  id="btn-simulate-catalog-ean13"
                  onClick={() => handleScanSuccess('8901234567890', 'In-Catalog Barcode (Cold Drinks EAN-13)')}
                  className="text-[10px] bg-emerald-800/90 hover:bg-emerald-700 text-emerald-200 px-2 py-0.5 rounded border border-emerald-500/50 flex items-center gap-1 transition-all active:scale-95 font-semibold"
                  title="Simulate scanning Cold Drinks (8901234567890)"
                >
                  <Zap size={11} className="text-emerald-300" />
                  <span>Cold Drinks</span>
                </button>
                <button
                  type="button"
                  id="btn-simulate-ean13"
                  onClick={() => handleScanSuccess('8901491100533', 'Verified Test Barcode (Kurkure EAN-13)')}
                  className="text-[10px] bg-amber-900/80 hover:bg-amber-800 text-amber-200 px-2 py-0.5 rounded border border-amber-600/50 flex items-center gap-1 transition-all active:scale-95 font-semibold"
                  title="Simulate scanning Kurkure EAN-13 barcode"
                >
                  <Zap size={11} className="text-amber-300" />
                  <span>Kurkure</span>
                </button>
              </div>
            </div>
          </div>

          {/* Supported Format Badges */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Supports EAN-13, EAN-8, UPC, Code 128</span>
            </div>
            {isScanning && (
              <span className="text-emerald-700 font-mono text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {diagnostics.videoDimensions}
              </span>
            )}
          </div>

          {/* Manual Entry Fallback */}
          <div className="mt-3.5 pt-3.5 border-t border-slate-100">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Keyboard size={14} className="text-slate-500" />
                Or type barcode number manually
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 8901491100533"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualSubmit(e);
                    }
                  }}
                  className="form-input flex-1 font-mono text-sm py-1.5 px-3 border border-slate-300 rounded-xl"
                  autoFocus={Boolean(errorMessage)}
                />
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={!manualBarcode.trim()}
                  className="btn btn-primary text-xs px-3.5 py-1.5 rounded-xl whitespace-nowrap font-bold"
                >
                  Use Barcode
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs">
          <span className="text-[11px] text-slate-600">
            Hold barcode 6–10 inches away from camera
          </span>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn btn-secondary text-xs py-1.5 px-3 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraBarcodeScannerModal;
