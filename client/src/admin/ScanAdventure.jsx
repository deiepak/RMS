import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats, Html5QrcodeScanType } from 'html5-qrcode';
import { CheckCircle, XCircle, Camera, UploadCloud } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import jsQR from 'jsqr';

export default function ScanAdventure() {
  const [scanResult, setScanResult] = useState(null);
  const [pendingTicket, setPendingTicket] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    // Initialize scanner with ONLY Camera type
    const config = { 
      fps: 10, 
      supportedFormats: [Html5QrcodeSupportedFormats.QR_CODE],
      rememberLastUsedCamera: true,
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
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

  const onScanSuccess = async (decodedText, overrideProcessing = false) => {
    if ((isProcessing && !overrideProcessing) || !isScanning) return;
    
    if (scannerRef.current) {
      scannerRef.current.pause(true);
    }
    
    setIsProcessing(true);
    
    try {
      const res = await api.get(`/adventures/ticket/${decodedText}`);
      
      const audio = new Audio('/success-sound.mp3');
      audio.play().catch(e => console.log('Audio play failed', e));

      setPendingTicket({
        code: decodedText,
        title: res.data.adventure_name || 'Valid Ticket'
      });
      setIsScanning(false);
      
    } catch (error) {
      const audio = new Audio('/error-sound.mp3');
      audio.play().catch(e => console.log('Audio play failed', e));

      setScanResult({
        success: false,
        message: error.response?.data?.error || 'Invalid ticket code.'
      });
      setIsScanning(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmTicket = async () => {
    if (!pendingTicket) return;
    setIsProcessing(true);
    try {
      await api.post('/adventures/scan', { ticket_code: pendingTicket.code });
      
      const audio = new Audio('/success-sound.mp3');
      audio.play().catch(e => console.log('Audio play failed', e));

      setScanResult({
        success: true,
        title: pendingTicket.title,
        message: 'Ticket validated successfully! Safe for entry.'
      });
    } catch (error) {
      const audio = new Audio('/error-sound.mp3');
      audio.play().catch(e => console.log('Audio play failed', e));

      setScanResult({
        success: false,
        message: error.response?.data?.error || 'Failed to use ticket.'
      });
    } finally {
      setIsProcessing(false);
      setPendingTicket(null);
    }
  };

  const onScanFailure = (error) => {
    // Ignore frequent scan failures
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (scannerRef.current) {
      scannerRef.current.pause(true);
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // Scale down huge images to 800px max for instant processing
        const MAX_DIM = 800;
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        
        // Fill background with white in case of transparent images
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Use jsQR to decode the image
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });

        if (code) {
          onScanSuccess(code.data, true);
        } else {
          // Play error sound and show UI
          const audio = new Audio('/error-sound.mp3');
          audio.play().catch(err => console.log('Audio play failed', err));

          setScanResult({
            success: false,
            message: 'No QR code found in the image. Please ensure the QR code is clearly visible and not blurry.'
          });
          setIsProcessing(false);
          setIsScanning(false);
        }
      };
      img.onerror = () => {
        showToast('Invalid image file', 'error');
        setIsProcessing(false);
        if (scannerRef.current) scannerRef.current.resume();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = null;
  };

  const resetScanner = () => {
    setScanResult(null);
    setPendingTicket(null);
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
              display: isScanning && !isProcessing ? 'block' : 'none',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden'
            }}
          ></div>

          {/* Custom File Upload Button */}
          {isScanning && !isProcessing && (
            <div className="mt-md text-center">
              <div className="text-secondary mb-sm text-sm">OR</div>
              <label className="btn btn-secondary w-full flex-center gap-sm cursor-pointer" style={{ maxWidth: 300, margin: '0 auto' }}>
                <UploadCloud size={20} /> Upload from Gallery
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>
          )}

          {/* Pending Confirmation View */}
          {!isScanning && pendingTicket && !scanResult && (
            <div className="flex flex-col align-center p-lg animate-scale-in text-center">
              <CheckCircle size={80} className="text-info mb-md" />
              <h2 className="text-info mb-sm">Ticket Found!</h2>
              <p className="text-lg font-bold">{pendingTicket.title}</p>
              <p className="text-secondary mt-sm">This ticket is valid and ready to be used.</p>

              <div className="flex gap-md w-full mt-xl" style={{ maxWidth: 400, margin: '32px auto 0' }}>
                <button 
                  className="btn btn-secondary btn-lg flex-1" 
                  onClick={resetScanner}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-success btn-lg flex-1" 
                  onClick={confirmTicket}
                  disabled={isProcessing}
                >
                  Accept Ticket
                </button>
              </div>
            </div>
          )}

          {/* Result View */}
          {!isScanning && scanResult && !pendingTicket && (
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
                style={{ maxWidth: 300, margin: '32px auto 0' }}
              >
                Scan Next Ticket
              </button>
            </div>
          )}
          
          {isProcessing && (
            <div className="flex-center p-xl flex-col gap-md">
              <div className="text-xl text-primary animate-pulse">Analyzing QR Code...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
