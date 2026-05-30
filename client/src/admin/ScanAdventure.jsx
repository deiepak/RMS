import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { CheckCircle, XCircle, Camera } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function ScanAdventure() {
  const [scanResult, setScanResult] = useState(null); // null | { success: true, message: '', title: '' } | { success: false, message: '' }
  const [isScanning, setIsScanning] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    // Initialize scanner
    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      supportedFormats: [Html5QrcodeSupportedFormats.QR_CODE],
      rememberLastUsedCamera: true
    };
    
    const html5QrcodeScanner = new Html5QrcodeScanner("reader", config, false);
    scannerRef.current = html5QrcodeScanner;

    html5QrcodeScanner.render(onScanSuccess, onScanFailure);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, []);

  const onScanSuccess = async (decodedText, decodedResult) => {
    if (isProcessing || !isScanning) return;
    
    // Pause scanning temporarily while processing
    if (scannerRef.current) {
      scannerRef.current.pause(true);
    }
    
    setIsProcessing(true);
    
    try {
      const res = await api.post('/adventures/scan', { ticket_code: decodedText });
      
      // Play success sound
      const audio = new Audio('/success-sound.mp3'); // Assuming standard success beep exists or browser generic
      audio.play().catch(e => console.log('Audio play failed', e));

      setScanResult({
        success: true,
        title: res.data.adventure_name || 'Valid Ticket',
        message: 'Ticket validated successfully! Safe for entry.'
      });
      
    } catch (error) {
      // Play error sound
      const audio = new Audio('/error-sound.mp3');
      audio.play().catch(e => console.log('Audio play failed', e));

      setScanResult({
        success: false,
        message: error.response?.data?.error || 'Invalid ticket code.'
      });
    } finally {
      setIsProcessing(false);
      setIsScanning(false);
    }
  };

  const onScanFailure = (error) => {
    // Ignore frequent scan failures (e.g. background noise)
  };

  const resetScanner = () => {
    setScanResult(null);
    setIsScanning(true);
    if (scannerRef.current) {
      scannerRef.current.resume();
    }
  };

  return (
    <div className="flex-center p-lg" style={{ minHeight: 'calc(100vh - 60px)', flexDirection: 'column' }}>
      <div className="card w-full" style={{ maxWidth: 600 }}>
        <div className="card-header text-center border-bottom">
          <h2 className="flex-center gap-sm">
            <Camera size={24} /> Scan Adventure Ticket
          </h2>
          <p className="text-secondary mt-xs">Point your device camera at the QR code</p>
        </div>
        
        <div className="card-body">
          {/* Scanner Container */}
          <div 
            id="reader" 
            style={{ 
              width: '100%', 
              display: isScanning ? 'block' : 'none',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden'
            }}
          ></div>

          {/* Result View */}
          {!isScanning && scanResult && (
            <div className="flex flex-col align-center p-lg animate-scale-in text-center">
              {scanResult.success ? (
                <>
                  <CheckCircle size={80} className="text-success mb-md" />
                  <h2 className="text-success mb-sm">{scanResult.title}</h2>
                  <p className="text-lg">{scanResult.message}</p>
                </>
              ) : (
                <>
                  <XCircle size={80} className="text-danger mb-md" />
                  <h2 className="text-danger mb-sm">Access Denied</h2>
                  <p className="text-lg text-secondary">{scanResult.message}</p>
                </>
              )}

              <button 
                className="btn btn-primary btn-lg mt-xl w-full" 
                onClick={resetScanner}
                style={{ maxWidth: 300 }}
              >
                Scan Next Ticket
              </button>
            </div>
          )}
          
          {isProcessing && (
            <div className="flex-center p-xl">
              <div className="text-xl text-primary animate-pulse">Verifying ticket...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
