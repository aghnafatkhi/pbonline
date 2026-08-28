'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  RefreshCcw, 
  Download, 
  ArrowLeft, 
  Check, 
  FlipHorizontal, 
  AlertCircle, 
  ShieldCheck,
  ChevronRight,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import { brandConfig } from '@/lib/brand';
import { OFFICIAL_FRAMES, OfficialFrameTemplate } from '@/lib/templates';
import { playShutterSound, playBeepSound } from '@/lib/sound';

export type PhotoboothState = 
  | 'permission_prompt'
  | 'permission_denied'
  | 'camera_error'
  | 'initializing'
  | 'ready'
  | 'countdown'
  | 'capturing'
  | 'review_shot'
  | 'processing'
  | 'result';

export interface SoloPhotoboothProps {
  initialLayout?: '2-frames' | '3-frames' | '4-frames';
  initialFrameId?: string;
  customOverlayDataUrl?: string;
  onExit: () => void;
}

export const filterList = [
  { id: 'normal', name: 'Normal', css: 'none' },
  { id: 'bw', name: 'B&W', css: 'grayscale(100%) contrast(110%)' },
  { id: 'noir', name: 'Noir', css: 'grayscale(100%) contrast(150%) brightness(90%)' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(50%) contrast(120%) saturate(120%) hue-rotate(-15deg)' },
  { id: 'film', name: 'Film', css: 'contrast(120%) saturate(110%) sepia(20%) brightness(95%) hue-rotate(5deg)' },
  { id: 'warm', name: 'Warm', css: 'sepia(30%) saturate(140%) hue-rotate(-10deg) contrast(110%)' },
  { id: 'cool', name: 'Cool', css: 'saturate(110%) hue-rotate(15deg) contrast(105%) brightness(105%)' },
  { id: 'fade', name: 'Fade', css: 'contrast(85%) brightness(110%) saturate(80%) sepia(10%)' },
];

export default function SoloPhotobooth({
  initialLayout = '3-frames',
  initialFrameId = 'classic-white',
  customOverlayDataUrl,
  onExit
}: SoloPhotoboothProps) {
  // Session Configuration
  const [layout, setLayout] = useState<'2-frames' | '3-frames' | '4-frames'>(initialLayout);
  const [selectedFrame, setSelectedFrame] = useState<OfficialFrameTemplate>(() => {
    return OFFICIAL_FRAMES.find(f => f.id === initialFrameId) || OFFICIAL_FRAMES[0];
  });
  const [selectedFilter, setSelectedFilter] = useState<string>('normal');

  // Core Flow State
  const [status, setStatus] = useState<PhotoboothState>('permission_prompt');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Camera & Device State
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const isMirrored = facingMode === 'user';
  
  // Photos State
  const totalPoses = layout === '4-frames' ? 4 : layout === '3-frames' ? 3 : 2;
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [tempShot, setTempShot] = useState<string | null>(null);
  const [retakeTargetIndex, setRetakeTargetIndex] = useState<number | null>(null);

  // Countdown & Feedback State
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [stopCameraStream]);

  // Request Camera Permission & Start Stream
  const initCamera = useCallback(async (requestedFacingMode: 'user' | 'environment' = facingMode) => {
    setStatus('initializing');
    setErrorMessage('');
    stopCameraStream();

    try {
      // Check for mediaDevices support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('camera_error');
        setErrorMessage('Browser Anda tidak mendukung akses kamera langsung. Gunakan Chrome, Safari, atau Firefox versi terbaru.');
        return;
      }

      // Check available cameras
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      } catch {
        // Enumerate failed, keep false
      }

      // Constraints: prefer 1080p / 720p 4:3
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: requestedFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to actually load and have dimensions
        const onLoaded = () => {
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            videoRef.current.play().then(() => {
              setStatus('ready');
            }).catch(() => {
              setStatus('ready');
            });
          }
        };

        if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
          onLoaded();
        } else {
          videoRef.current.onloadedmetadata = onLoaded;
        }
      }
    } catch (err: unknown) {
      stopCameraStream();
      const error = err as { name?: string; message?: string };
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setStatus('permission_denied');
        setErrorMessage('Izin kamera ditolak. Silakan izinkan akses kamera di browser Anda.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setStatus('camera_error');
        setErrorMessage('Kamera tidak ditemukan pada perangkat ini.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setStatus('camera_error');
        setErrorMessage('Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi tersebut dan coba lagi.');
      } else {
        setStatus('camera_error');
        setErrorMessage(error.message || 'Gagal memulai kamera.');
      }
    }
  }, [facingMode, stopCameraStream]);

  // Flip Camera (Front / Back)
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    initCamera(nextMode);
  };

  // Trigger Capture Immediately from Video to Image URL
  const takeSnapshot = useCallback(() => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) return null;

    const video = videoRef.current;
    const offscreenCanvas = document.createElement('canvas');
    
    // Exact 4:3 ratio matching standard photobooth slot
    const targetAspect = 4 / 3;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const videoAspect = videoWidth / videoHeight;

    let sx = 0;
    let sy = 0;
    let sWidth = videoWidth;
    let sHeight = videoHeight;

    if (videoAspect > targetAspect) {
      // Video is wider than 4:3 -> crop left and right
      sHeight = videoHeight;
      sWidth = sHeight * targetAspect;
      sx = (videoWidth - sWidth) / 2;
    } else {
      // Video is taller than 4:3 -> crop top and bottom
      sWidth = videoWidth;
      sHeight = sWidth / targetAspect;
      sy = (videoHeight - sHeight) / 2;
    }

    // Standard high-res slot dimensions
    offscreenCanvas.width = 1200;
    offscreenCanvas.height = 900;

    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return null;

    // Apply mirroring if front camera
    if (isMirrored) {
      ctx.translate(offscreenCanvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
    return offscreenCanvas.toDataURL('image/jpeg', 0.95);
  }, [isMirrored]);

  // Start 3-2-1 Countdown
  const startCountdown = useCallback(() => {
    if (status !== 'ready') return;

    setStatus('countdown');
    let currentCount = 3;
    setCountdownNumber(3);
    playBeepSound(false);

    countdownIntervalRef.current = setInterval(() => {
      currentCount -= 1;
      if (currentCount > 0) {
        setCountdownNumber(currentCount);
        playBeepSound(false);
      } else if (currentCount === 0) {
        // Trigger Shutter Snap & Flash
        playBeepSound(true);
        playShutterSound();
        setShowFlash(true);
        setCountdownNumber(null);
        
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }

        setTimeout(() => {
          setShowFlash(false);
          const photoData = takeSnapshot();
          if (photoData) {
            setTempShot(photoData);
            setStatus('review_shot');
          } else {
            setStatus('ready');
          }
        }, 150);
      }
    }, 1000);
  }, [status, takeSnapshot]);

  // Accept current shot & proceed
  const handleAcceptShot = useCallback(() => {
    if (!tempShot) return;

    let updatedPhotos: string[];
    const targetIdx = retakeTargetIndex !== null ? retakeTargetIndex : currentPoseIndex;

    if (retakeTargetIndex !== null) {
      // Retaking a specific slot
      updatedPhotos = [...capturedPhotos];
      updatedPhotos[targetIdx] = tempShot;
      setRetakeTargetIndex(null);
    } else {
      // Normal sequential slot
      updatedPhotos = [...capturedPhotos];
      updatedPhotos[targetIdx] = tempShot;
    }

    setCapturedPhotos(updatedPhotos);
    setTempShot(null);

    if (retakeTargetIndex !== null || updatedPhotos.length >= totalPoses) {
      // All poses completed -> go to processing & result!
      setStatus('processing');
      stopCameraStream();
      setTimeout(() => {
        setStatus('result');
      }, 400);
    } else {
      // Move to next pose
      setCurrentPoseIndex(updatedPhotos.length);
      setStatus('ready');
    }
  }, [tempShot, retakeTargetIndex, currentPoseIndex, capturedPhotos, totalPoses, stopCameraStream]);

  // Retake current temporary shot
  const handleRetakeCurrentShot = () => {
    setTempShot(null);
    setStatus('ready');
  };

  // Keyboard shortcut (Space or Enter to capture)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (status === 'ready') {
          e.preventDefault();
          startCountdown();
        } else if (status === 'review_shot') {
          e.preventDefault();
          handleAcceptShot();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, startCountdown, handleAcceptShot]);

  // Render High Resolution Composite Photo Strip
  const renderCompositePhotoStrip = useCallback(() => {
    if (!canvasRef.current || capturedPhotos.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 2x Retina Resolution for Ultra-Crisp Output
    canvas.width = 800;
    canvas.height = layout === '4-frames' ? 2400 : layout === '3-frames' ? 1850 : 1300;

    // Load captured images
    const loaders = capturedPhotos.map((url) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
        img.src = url;
      });
    });
    
    let customOverlayPromise = Promise.resolve<HTMLImageElement | null>(null);
    if (customOverlayDataUrl) {
      customOverlayPromise = new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = customOverlayDataUrl;
      });
    }

    Promise.all([...loaders, customOverlayPromise]).then((results) => {
      const imgs = results.slice(0, capturedPhotos.length) as HTMLImageElement[];
      const customOverlayImg = results[results.length - 1] as HTMLImageElement | null;

      // 1. Draw Background Frame
      ctx.fillStyle = selectedFrame.baseColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Geometry Spacing Math
      const paddingX = 48;
      const paddingTop = 48;
      const paddingBottom = 160;
      const gap = 32;
      const totalGaps = gap * (totalPoses - 1);
      
      const photoWidth = canvas.width - paddingX * 2;
      const availableHeight = canvas.height - paddingTop - paddingBottom - totalGaps;
      const photoHeight = availableHeight / totalPoses;

      // 3. Draw Photos with Filter
      const activeFilterObj = filterList.find(f => f.id === selectedFilter);
      ctx.filter = activeFilterObj ? activeFilterObj.css : 'none';

      for (let i = 0; i < totalPoses; i++) {
        const img = imgs[i];
        if (img) {
          const y = paddingTop + i * (photoHeight + gap);
          
          // Draw subtle photo container border
          ctx.save();
          // Clip rounded rectangle for photo slot
          const radius = 16;
          ctx.beginPath();
          ctx.moveTo(paddingX + radius, y);
          ctx.lineTo(paddingX + photoWidth - radius, y);
          ctx.quadraticCurveTo(paddingX + photoWidth, y, paddingX + photoWidth, y + radius);
          ctx.lineTo(paddingX + photoWidth, y + photoHeight - radius);
          ctx.quadraticCurveTo(paddingX + photoWidth, y + photoHeight, paddingX + photoWidth - radius, y + photoHeight);
          ctx.lineTo(paddingX + radius, y + photoHeight);
          ctx.quadraticCurveTo(paddingX, y + photoHeight, paddingX, y + photoHeight - radius);
          ctx.lineTo(paddingX, y + radius);
          ctx.quadraticCurveTo(paddingX, y, paddingX + radius, y);
          ctx.closePath();
          ctx.clip();

          // Draw cropped photo centered
          ctx.drawImage(img, paddingX, y, photoWidth, photoHeight);
          ctx.restore();
        }
      }

      // 4. Draw Custom Overlay OR Default Watermark
      ctx.filter = 'none';
      if (customOverlayImg) {
        // Draw the custom PNG overlay
        ctx.drawImage(customOverlayImg, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = selectedFrame.textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Brand Watermark
        ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif';
        ctx.fillText(brandConfig.watermarkText, canvas.width / 2, canvas.height - 95);

        // Date & Details
        const dateStr = new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }).toUpperCase();

        ctx.fillStyle = selectedFrame.subColor;
        ctx.font = '700 16px monospace';
        ctx.fillText(`${dateStr} • PHOTO STRIP`, canvas.width / 2, canvas.height - 55);
      }
    });
  }, [capturedPhotos, layout, selectedFrame, selectedFilter, totalPoses, customOverlayDataUrl]);

  // Re-render canvas whenever result dependencies change
  useEffect(() => {
    if (status === 'result') {
      const timer = setTimeout(() => {
        renderCompositePhotoStrip();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [status, renderCompositePhotoStrip]);

  // Download High-Resolution Photo Strip
  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `photobooth-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png', 1.0);
    link.click();
  };

  // Retake a specific slot from result view
  const handleRetakeSpecificSlot = (index: number) => {
    setRetakeTargetIndex(index);
    setCurrentPoseIndex(index);
    initCamera();
  };

  // Clean restart session
  const handleRestartSession = () => {
    setCapturedPhotos([]);
    setCurrentPoseIndex(0);
    setTempShot(null);
    setRetakeTargetIndex(null);
    initCamera();
  };

  // Safe Exit with Confirmation
  const handleSafeExit = () => {
    if (capturedPhotos.length > 0 && status !== 'result') {
      setShowExitConfirm(true);
    } else {
      stopCameraStream();
      onExit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 text-white flex flex-col justify-between overflow-y-auto selection:bg-white selection:text-black">
      
      {/* 1. Header Navigation */}
      <header className="w-full max-w-xl mx-auto px-4 py-3 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <button
          onClick={handleSafeExit}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors text-xs font-semibold"
          aria-label="Kembali"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Keluar</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold font-mono tracking-wider uppercase text-zinc-200">
            {status === 'result' ? 'Hasil Photo Strip' : `Foto ${Math.min(currentPoseIndex + 1, totalPoses)} dari ${totalPoses}`}
          </span>
        </div>

        {/* Camera Flip Switch (if available & in active camera mode) */}
        {(status === 'ready' || status === 'countdown') && hasMultipleCameras ? (
          <button
            onClick={toggleFacingMode}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
            title="Ganti Kamera"
            aria-label="Ganti Kamera"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-8" />
        )}
      </header>

      {/* 2. Main Work Area */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4 sm:py-6 flex flex-col items-center justify-center">

        {/* STATE A: PERMISSION PROMPT */}
        {status === 'permission_prompt' && (
          <div className="w-full max-w-sm bg-zinc-900 rounded-2xl p-6 sm:p-8 border border-zinc-800 text-center flex flex-col items-center animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-white mb-4 shadow-inner">
              <Camera className="w-7 h-7" />
            </div>
            
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mb-2">
              Siapkan Kamera
            </h2>
            
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-6">
              Browser akan meminta izin kamera untuk mulai sesi foto. Foto Anda diproses secara aman langsung di perangkat.
            </p>

            <button
              onClick={() => initCamera()}
              className="w-full py-3.5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer min-h-[48px]"
            >
              <Camera className="w-4 h-4" />
              <span>Gunakan Kamera</span>
            </button>

            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-4">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
              <span>Privasi aman • Tanpa simpan ke server publik</span>
            </div>
          </div>
        )}

        {/* STATE B: PERMISSION DENIED */}
        {status === 'permission_denied' && (
          <div className="w-full max-w-sm bg-zinc-900 rounded-2xl p-6 sm:p-8 border border-zinc-800 text-center flex flex-col items-center animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-red-950/50 border border-red-900/50 flex items-center justify-center text-red-400 mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mb-2">
              Kamera Belum Diizinkan
            </h2>
            
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Akses kamera diblokir oleh browser. Klik ikon gembok atau pengaturan izin di address bar browsermu untuk mengizinkan kamera, lalu tekan tombol coba lagi.
            </p>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={() => initCamera()}
                className="w-full py-3 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 min-h-[44px]"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>

              <button
                onClick={onExit}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold min-h-[44px]"
              >
                Kembali ke Beranda
              </button>
            </div>
          </div>
        )}

        {/* STATE C: CAMERA ERROR */}
        {status === 'camera_error' && (
          <div className="w-full max-w-sm bg-zinc-900 rounded-2xl p-6 sm:p-8 border border-zinc-800 text-center flex flex-col items-center animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-amber-950/50 border border-amber-900/50 flex items-center justify-center text-amber-400 mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mb-2">
              Kamera Bermasalah
            </h2>
            
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              {errorMessage || 'Tidak dapat menghubungkan ke kamera. Pastikan kamera tidak dipakai aplikasi lain.'}
            </p>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={() => initCamera()}
                className="w-full py-3 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 min-h-[44px]"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>

              <button
                onClick={onExit}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold min-h-[44px]"
              >
                Kembali
              </button>
            </div>
          </div>
        )}

        {/* STATE D: INITIALIZING CAMERA */}
        {status === 'initializing' && (
          <div className="w-full max-w-sm aspect-[4/3] bg-zinc-900 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-center p-6">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
            <span className="text-xs font-semibold text-zinc-400">Menyiapkan kamera...</span>
          </div>
        )}

        {/* STATE E: ACTIVE VIEWFINDER (READY / COUNTDOWN / CAPTURING) */}
        {(status === 'ready' || status === 'countdown' || status === 'capturing') && (
          <div className="w-full max-w-md flex flex-col items-center space-y-4">
            
            {/* Compact Progress Thumbnail Strip */}
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPoses }).map((_, idx) => {
                const isDone = capturedPhotos[idx];
                const isCurrent = idx === currentPoseIndex;
                return (
                  <div
                    key={idx}
                    className={`w-10 h-8 rounded-lg border flex items-center justify-center overflow-hidden transition-all ${
                      isCurrent
                        ? 'border-white ring-2 ring-white/40 scale-105 bg-zinc-800'
                        : isDone
                          ? 'border-zinc-700 bg-zinc-800'
                          : 'border-zinc-800 bg-zinc-900/60'
                    }`}
                  >
                    {isDone ? (
                      <img src={capturedPhotos[idx]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-zinc-500">0{idx + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* The Live Video Viewfinder (Exact 4:3 Aspect Ratio matching strip slot) */}
            <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-zinc-800 shadow-xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-transform ${isMirrored ? 'scale-x-[-1]' : ''}`}
                style={{
                  filter: filterList.find(f => f.id === selectedFilter)?.css || 'none'
                }}
              />

              {/* Countdown Numbers Overlay */}
              {status === 'countdown' && countdownNumber !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs animate-scaleUp">
                  <span className="text-8xl sm:text-9xl font-black font-mono text-white tracking-tighter drop-shadow-lg">
                    {countdownNumber}
                  </span>
                </div>
              )}

              {/* Shutter Flash Effect */}
              {showFlash && (
                <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-30" />
              )}

              {/* Subtle Frame Guidelines */}
              <div className="absolute inset-3 border border-white/10 rounded-xl pointer-events-none" />
            </div>

            {/* Shutter Capture Button */}
            <div className="flex flex-col items-center pt-2">
              <button
                onClick={startCountdown}
                disabled={status !== 'ready'}
                className={`w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-white p-1.5 flex items-center justify-center transition-all ${
                  status === 'ready'
                    ? 'hover:scale-105 active:scale-95 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed'
                }`}
                aria-label="Ambil Foto"
              >
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center shadow-md">
                  <Camera className="w-6 h-6 text-zinc-950" />
                </div>
              </button>

              <span className="text-[11px] text-zinc-500 mt-2 font-medium">
                Ketuk tombol atau tekan Spasi
              </span>
            </div>

          </div>
        )}

        {/* STATE F: REVIEW SHOT (QUICK PER-SHOT RETAKE / ACCEPT) */}
        {status === 'review_shot' && tempShot && (
          <div className="w-full max-w-md flex flex-col items-center space-y-4 animate-fadeIn">
            
            <div className="text-center">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Hasil Pose {currentPoseIndex + 1}
              </span>
              <p className="text-sm font-semibold text-white">
                Apakah foto ini sudah pas?
              </p>
            </div>

            {/* The Captured Snapshot Preview */}
            <div className="w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-zinc-700 shadow-xl">
              <img 
                src={tempShot} 
                alt={`Pose ${currentPoseIndex + 1}`} 
                className="w-full h-full object-cover" 
              />
            </div>

            {/* Quick Action Choices */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm pt-2">
              <button
                onClick={handleRetakeCurrentShot}
                className="py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[48px]"
              >
                <RefreshCcw className="w-4 h-4 text-zinc-400" />
                <span>Ulang Pose Ini</span>
              </button>

              <button
                onClick={handleAcceptShot}
                className="py-3.5 bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer min-h-[48px]"
              >
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Pakai Foto</span>
              </button>
            </div>

          </div>
        )}

        {/* STATE G: PROCESSING RESULT */}
        {status === 'processing' && (
          <div className="w-full max-w-sm aspect-[4/3] bg-zinc-900 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center text-center p-6 animate-fadeIn">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
            <span className="text-xs font-bold text-white">Menyusun Photo Strip...</span>
            <span className="text-[11px] text-zinc-500 mt-1">Menyiapkan resolusi jernih</span>
          </div>
        )}

        {/* STATE H: FINAL RESULT VIEW */}
        {status === 'result' && (
          <div className="w-full max-w-sm flex flex-col items-center space-y-4 animate-fadeIn pb-8">
            
            {/* The Rendered Canvas */}
            <div className="w-full rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl bg-zinc-900 p-2">
              <canvas ref={canvasRef} className="w-full h-auto object-contain rounded-xl" />
            </div>

            {/* Frame Style Selector */}
            <div className="w-full bg-zinc-900 p-3 rounded-xl border border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Pilih Warna Frame:
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {OFFICIAL_FRAMES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFrame(f)}
                    className={`w-7 h-7 rounded-full shrink-0 border transition-all ${
                      selectedFrame.id === f.id
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110 border-transparent'
                        : 'border-zinc-600 hover:scale-105'
                    }`}
                    style={{ backgroundColor: f.baseColor }}
                    title={f.name}
                  />
                ))}
              </div>
            </div>

            {/* Filter Selector */}
            <div className="w-full bg-zinc-900 p-3 rounded-xl border border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Efek Filter:
              </span>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {filterList.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                      selectedFilter === f.id
                        ? 'bg-white text-zinc-950 font-bold'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 w-full">
              <button
                onClick={handleDownload}
                className="flex-1 py-3.5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer min-h-[48px]"
              >
                <Download className="w-4 h-4" />
                <span>Simpan Photo Strip</span>
              </button>

              <button
                onClick={handleRestartSession}
                className="py-3.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[48px]"
              >
                <RefreshCcw className="w-4 h-4 text-zinc-400" />
                <span>Foto Lagi</span>
              </button>
            </div>

            {/* Retake Individual Slot Controls */}
            <div className="w-full pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
              <span>Ulang salah satu pose?</span>
              <div className="flex gap-1">
                {Array.from({ length: totalPoses }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRetakeSpecificSlot(idx)}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded text-[10px] font-bold"
                  >
                    Pose {idx + 1}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* 3. Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-base font-bold text-white mb-2">
              Keluar dari photobooth?
            </h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Foto yang sedang diambil akan hilang jika Anda keluar sekarang.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  stopCameraStream();
                  onExit();
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
