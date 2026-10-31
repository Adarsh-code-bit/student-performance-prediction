import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Barcode, Search, Camera, RefreshCw, CheckCircle2, 
  AlertCircle, X, ExternalLink, Package, PlusCircle, AlertTriangle 
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import CameraBarcodeScannerModal from './CameraBarcodeScannerModal';

/**
 * BarcodeScannerInput
 * 
 * Comprehensive, reusable barcode scanning & automatic product detection component.
 * Supports:
 * - USB / Bluetooth hardware barcode scanners (HID keyboard wedge)
 * - Enter-terminated and non-Enter debounced scanner output
 * - Rapid keystroke detection with deduplication cooldown
 * - Camera-based barcode scanner modal fallback
 * - Local MySQL database product lookup
 * - Optional Open Food Facts external catalog lookup with review modal
 * - Clear status indicators, error handling, manual fallback, and auto-focus retention
 */
export default function BarcodeScannerInput({
  onProductDetected,          // (product, meta) => void
  onScanRaw,                  // (rawBarcode) => void
  placeholder = 'Scan barcode or type number...',
  autoFocus = true,
  autoClearOnSuccess = false,
  allowExternalLookup = true,
  showMatchCard = true,
  inputSize = 'md',           // 'sm' | 'md' | 'lg'
  disabled = false,
  className = ''
}) {
  const { addToast } = useToast();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanStatus, setScanStatus] = useState('READY'); // 'READY' | 'LOOKING_UP' | 'FOUND' | 'EXTERNAL_FOUND' | 'NOT_FOUND' | 'ERROR'
  const [statusMessage, setStatusMessage] = useState('Scanner ready for hardware or camera input');
  const [matchedProduct, setMatchedProduct] = useState(null);
  const [externalCandidate, setExternalCandidate] = useState(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [confirmingExternal, setConfirmingExternal] = useState(false);

  const inputRef = useRef(null);

  // Keep input focused automatically after scans or resets
  const focusInput = useCallback(() => {
    if (autoFocus && inputRef.current && document.activeElement !== inputRef.current) {
      // Don't steal focus if user is actively typing in another form field
      const activeTag = document.activeElement?.tagName;
      if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
        inputRef.current.focus();
      }
    }
  }, [autoFocus]);

  useEffect(() => {
    if (autoFocus) {
      focusInput();
    }
  }, [autoFocus, focusInput]);

  // Handle hardware barcode scanner hook
  const handleHardwareScan = useCallback((scannedCode) => {
    if (disabled || scanStatus === 'LOOKING_UP') return;
    setBarcodeInput(scannedCode);
    if (onScanRaw) onScanRaw(scannedCode);
    executeLookup(scannedCode);
  }, [disabled, scanStatus, onScanRaw]);

  // Hook for hardware scanners
  useBarcodeScanner({
    onScan: handleHardwareScan,
    enabled: !disabled && !cameraModalOpen,
    minBarcodeLength: 3,
    targetInputRef: inputRef
  });

  // Execute lookup in backend
  const executeLookup = async (codeToSearch) => {
    const cleaned = (codeToSearch || '').trim();
    if (!cleaned) return;

    if (cleaned.length < 3) {
      setScanStatus('ERROR');
      setStatusMessage('Barcode too short (min 3 characters).');
      return;
    }

    setScanStatus('LOOKING_UP');
    setStatusMessage(`Searching catalog for barcode "${cleaned}"...`);
    setMatchedProduct(null);
    setExternalCandidate(null);

    try {
      const url = `/products/barcode/${encodeURIComponent(cleaned)}?includeExternal=${allowExternalLookup}`;
      const res = await api.get(url);

      if (res.data?.success && res.data.found) {
        const productData = res.data.data;
        const source = res.data.source;

        if (source === 'local') {
          // Found in local MySQL database
          setMatchedProduct(productData);
          setScanStatus('FOUND');
          setStatusMessage(`Product Identified: ${productData.product_name}`);
          addToast(`Matched "${productData.product_name}" from database`, 'success');

          if (onProductDetected) {
            onProductDetected(productData, { source: 'local', barcode: cleaned });
          }

          if (autoClearOnSuccess) {
            setBarcodeInput('');
          }
        } else if (source === 'external') {
          // Found in Open Food Facts external catalog
          setExternalCandidate(productData);
          setScanStatus('EXTERNAL_FOUND');
          setStatusMessage(`External match found on Open Food Facts: ${productData.product_name}`);
          addToast(`External match found for ${cleaned}. Review to add to catalog.`, 'info');
        }
      }
    } catch (err) {
      const resData = err.response?.data;
      if (err.response?.status === 404) {
        setScanStatus('NOT_FOUND');
        const notFoundMsg = resData?.message || 'Product not found. You can add this product manually.';
        setStatusMessage(notFoundMsg);
        addToast(notFoundMsg, 'warning');
      } else if (err.response?.status === 400) {
        setScanStatus('ERROR');
        const errMsg = resData?.message || 'Invalid barcode format.';
        setStatusMessage(errMsg);
        addToast(errMsg, 'error');
      } else {
        setScanStatus('ERROR');
        const errMsg = resData?.message || 'Barcode search service unavailable.';
        setStatusMessage(errMsg);
        addToast(errMsg, 'error');
      }
    } finally {
      // Retain focus for next scan
      setTimeout(() => focusInput(), 100);
    }
  };

  // Manual submission via Enter or Click
  const handleManualSearch = (e) => {
    if (e) e.preventDefault();
    if (!barcodeInput.trim()) return;
    executeLookup(barcodeInput);
  };

  // Camera scan success handler
  const handleCameraScanSuccess = (scannedCode) => {
    setBarcodeInput(scannedCode);
    if (onScanRaw) onScanRaw(scannedCode);
    executeLookup(scannedCode);
  };

  // Reset scan field
  const handleReset = () => {
    setBarcodeInput('');
    setScanStatus('READY');
    setStatusMessage('Scanner ready for hardware or camera input');
    setMatchedProduct(null);
    setExternalCandidate(null);
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  // Confirm External Product and save to MySQL
  const handleConfirmExternalProduct = async () => {
    if (!externalCandidate || confirmingExternal) return;
    setConfirmingExternal(true);

    try {
      const payload = {
        product_name: externalCandidate.product_name,
        brand: externalCandidate.brand,
        barcode: externalCandidate.barcode || barcodeInput,
        category: externalCandidate.category,
        unit: externalCandidate.unit || 'pcs',
        unit_price: externalCandidate.unit_price || 25.00,
        image_url: externalCandidate.image_url,
        reorder_level: 10
      };

      const res = await api.post('/products/confirm-external', payload);
      if (res.data?.success && res.data.data) {
        const savedProduct = res.data.data;
        addToast(`Product "${savedProduct.product_name}" added to catalog!`, 'success');
        setMatchedProduct(savedProduct);
        setExternalCandidate(null);
        setScanStatus('FOUND');
        setStatusMessage(`Product Identified & Saved: ${savedProduct.product_name}`);

        if (onProductDetected) {
          onProductDetected(savedProduct, { source: 'external_confirmed', barcode: payload.barcode });
        }

        if (autoClearOnSuccess) {
          setBarcodeInput('');
        }
      } else {
        addToast(res.data?.message || 'Failed to save external product', 'error');
      }
    } catch (err) {
      console.error('Save external product error:', err);
      addToast(err.response?.data?.message || 'Error saving product to database', 'error');
    } finally {
      setConfirmingExternal(false);
      setTimeout(() => focusInput(), 100);
    }
  };

  return (
    <div className={`barcode-scanner-container ${className}`}>
      {/* 1. Barcode Input and Controls Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 relative flex items-center">
          <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
            <Barcode size={18} className="text-slate-500" />
          </div>

          <input
            ref={inputRef}
            type="text"
            data-barcode-scanner="true"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleManualSearch(e);
              }
            }}
            placeholder={placeholder}
            disabled={disabled || scanStatus === 'LOOKING_UP'}
            className={`w-full pl-9 pr-24 py-2 bg-white border border-slate-300 rounded-xl font-mono text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all ${
              inputSize === 'lg' ? 'py-3 text-base' : inputSize === 'sm' ? 'py-1.5 text-xs' : 'py-2 text-sm'
            }`}
          />

          {/* Quick Clear Button inside input */}
          {barcodeInput && (
            <button
              type="button"
              onClick={handleReset}
              className="absolute right-12 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
              title="Clear input"
            >
              <X size={15} />
            </button>
          )}

          {/* Manual Submit Button */}
          <button
            type="button"
            onClick={handleManualSearch}
            disabled={!barcodeInput.trim() || scanStatus === 'LOOKING_UP' || disabled}
            className="absolute right-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
            title="Manual Search"
          >
            {scanStatus === 'LOOKING_UP' ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Search size={14} />
            )}
            <span className="hidden xs:inline">Find</span>
          </button>
        </div>

        {/* Action Buttons: Camera Scan & Reset */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setCameraModalOpen(true)}
            disabled={disabled}
            className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl transition-all shadow-sm active:scale-95"
            title="Scan using device camera"
          >
            <Camera size={16} className="text-emerald-600" />
            <span>Camera</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="btn btn-secondary text-xs py-2 px-3 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
            title="Reset scanner and clear result"
          >
            Reset
          </button>
        </div>
      </div>

      {/* 2. Real-time Status Indicator Pill */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium ${
            scanStatus === 'READY' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
            scanStatus === 'LOOKING_UP' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
            scanStatus === 'FOUND' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold' :
            scanStatus === 'EXTERNAL_FOUND' ? 'bg-amber-50 text-amber-700 border border-amber-200 font-bold' :
            scanStatus === 'NOT_FOUND' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
            'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              scanStatus === 'READY' ? 'bg-emerald-500 animate-pulse' :
              scanStatus === 'LOOKING_UP' ? 'bg-blue-500 animate-ping' :
              scanStatus === 'FOUND' ? 'bg-emerald-600' :
              scanStatus === 'EXTERNAL_FOUND' ? 'bg-amber-500' :
              scanStatus === 'NOT_FOUND' ? 'bg-amber-600' :
              'bg-red-500'
            }`} />
            {scanStatus === 'READY' ? 'Scanner Ready' :
             scanStatus === 'LOOKING_UP' ? 'Looking up...' :
             scanStatus === 'FOUND' ? 'Product Identified' :
             scanStatus === 'EXTERNAL_FOUND' ? 'External Match' :
             scanStatus === 'NOT_FOUND' ? 'Not Found' : 'Error'}
          </span>

          <span className="text-slate-600 truncate text-[11px] sm:text-xs">
            {statusMessage}
          </span>
        </div>

        <span className="text-[11px] text-slate-600 hidden md:inline">
          USB / BT HID & Camera Compatible
        </span>
      </div>

      {/* 3. Product Match Preview Card (Local Database) */}
      {showMatchCard && matchedProduct && scanStatus === 'FOUND' && (
        <div className="mt-3 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-3.5 animate-fadeIn">
          {/* Image */}
          <div className="w-16 h-16 bg-white rounded-lg border border-emerald-100 flex-shrink-0 flex items-center justify-center p-1 overflow-hidden">
            {matchedProduct.image_url ? (
              <img 
                src={matchedProduct.image_url} 
                alt={matchedProduct.product_name} 
                className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <Package size={24} className="text-emerald-400" />
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                In Catalog
              </span>
              {matchedProduct.brand && (
                <span className="text-xs text-slate-500 font-semibold truncate">
                  {matchedProduct.brand}
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-900 truncate mt-0.5 m-0">
              {matchedProduct.product_name}
            </h4>

            <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
              <span>Barcode: <strong className="font-mono text-slate-800">{matchedProduct.barcode}</strong></span>
              <span>Stock: <strong className="text-emerald-700">{matchedProduct.current_stock ?? 0} {matchedProduct.unit || 'pcs'}</strong></span>
              <span>Price: <strong>₹{matchedProduct.unit_price}</strong></span>
            </div>
          </div>

          <div className="text-emerald-600 flex-shrink-0">
            <CheckCircle2 size={24} />
          </div>
        </div>
      )}

      {/* 4. External Product Review & Confirmation Card (Open Food Facts) */}
      {(showMatchCard || Boolean(onProductDetected)) && externalCandidate && scanStatus === 'EXTERNAL_FOUND' && (
        <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm animate-fadeIn">
          <div className="flex items-start justify-between gap-3 pb-2 border-b border-amber-200/60 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wide">
              <ExternalLink size={14} className="text-amber-700" />
              <span>External Product Match Found (Open Food Facts)</span>
            </div>
            <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded font-semibold">
              Pending Confirmation
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-16 h-16 bg-white rounded-lg border border-amber-200 flex-shrink-0 flex items-center justify-center p-1 overflow-hidden">
              {externalCandidate.image_url ? (
                <img 
                  src={externalCandidate.image_url} 
                  alt={externalCandidate.product_name} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <Package size={24} className="text-amber-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs text-amber-900 font-semibold truncate">
                {externalCandidate.brand || 'External Brand'}
              </div>
              <h4 className="text-sm font-black text-slate-900 truncate m-0">
                {externalCandidate.product_name}
              </h4>
              <div className="text-xs text-slate-600 mt-1 font-mono">
                Barcode: {externalCandidate.barcode || barcodeInput}
              </div>
            </div>
          </div>

          <p className="text-xs text-amber-800 mt-2.5 mb-3">
            This product was detected via Open Food Facts. You can review the details and confirm adding it to QUICKSTOCK before continuing.
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary text-xs py-1.5 px-3 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmExternalProduct}
              disabled={confirmingExternal}
              className="btn btn-primary text-xs py-1.5 px-4 bg-amber-600 hover:bg-amber-700 border-amber-600 text-white rounded-lg flex items-center gap-1.5 font-bold shadow-sm"
            >
              {confirmingExternal ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Adding to Catalog...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={14} />
                  <span>Confirm & Add to Catalog</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 5. Not Found Card */}
      {showMatchCard && scanStatus === 'NOT_FOUND' && (
        <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-900 animate-fadeIn">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold m-0">Product not found. You can add this product manually.</p>
            <p className="text-[11px] text-amber-700 mt-0.5 m-0">
              No matching item found in local warehouse inventory or external catalog for barcode <span className="font-mono font-bold">{barcodeInput}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-amber-700 hover:text-amber-900 underline font-semibold flex-shrink-0"
          >
            Scan Another
          </button>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={cameraModalOpen}
        onClose={() => {
          setCameraModalOpen(false);
          setTimeout(() => focusInput(), 100);
        }}
        onScan={handleCameraScanSuccess}
        title="Scan Product Barcode"
      />
    </div>
  );
}
