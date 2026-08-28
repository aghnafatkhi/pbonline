'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  setDoc,
  serverTimestamp,
  deleteField
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { brandConfig } from '../lib/brand';
import { getTimestamp } from '../lib/utils';
import { 
  OFFICIAL_FRAMES, 
  getMultiplayerLayoutGeometry,
  FrameLayoutType 
} from '../lib/templates';
import { playShutterSound, playBeepSound } from '../lib/sound';
import { 
  Camera, 
  Check, 
  Copy, 
  Download, 
  RefreshCcw, 
  Users, 
  Share2, 
  ArrowLeft, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles,
  ChevronRight,
  UserPlus,
  Wifi,
  WifiOff
} from 'lucide-react';

export interface FriendItem {
  uid: string;
  name: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'in_booth';
  lastSeen?: number;
  currentRoomCode?: string | null;
}

export interface ParticipantData {
  uid: string;
  name: string;
  connected: boolean;
  ready: boolean;
  cameraReady?: boolean;
  filter?: string;
  lastSeen?: number;
}

export interface MultiplayerRoomData {
  status: 'lobby' | 'countdown' | 'capturing' | 'completed';
  layout: FrameLayoutType;
  selectedFrameId: string;
  overlayBackground: string;
  customOverlayUrl?: string | null;
  hostUid: string;
  participants: {
    [uid: string]: ParticipantData;
  };
  participantOrder: string[]; // [slot0Uid, slot1Uid]
  currentRound: number;
  totalPoses: number;
  targetCaptureTime: number | null;
  captures: {
    [uid: string]: {
      [roundIndex: string]: string; // dataUrl
    };
  };
  createdAt?: { toDate: () => Date } | number;
  updatedAt?: number;
}

const FILTER_OPTIONS = [
  { id: 'normal', name: 'Normal', style: 'none' },
  { id: 'bw', name: 'B&W', style: 'grayscale(100%) contrast(110%)' },
  { id: 'noir', name: 'Noir', style: 'grayscale(100%) contrast(150%) brightness(90%)' },
  { id: 'vintage', name: 'Vintage', style: 'sepia(50%) contrast(120%) saturate(120%) hue-rotate(-15deg)' },
  { id: 'film', name: 'Film', style: 'contrast(120%) saturate(110%) sepia(20%) brightness(95%) hue-rotate(5deg)' },
  { id: 'retro', name: 'Retro', style: 'sepia(40%) saturate(150%) hue-rotate(-20deg) contrast(120%) brightness(90%)' },
  { id: 'warm', name: 'Warm', style: 'sepia(30%) saturate(140%) hue-rotate(-10deg) contrast(110%)' },
  { id: 'cool', name: 'Cool', style: 'saturate(110%) hue-rotate(15deg) contrast(105%) brightness(105%)' },
  { id: 'fade', name: 'Fade', style: 'contrast(85%) brightness(110%) saturate(80%) sepia(10%)' },
];

const getFilterCSS = (fid: string) => FILTER_OPTIONS.find(f => f.id === fid)?.style || 'none';

interface MultiplayerPhotoboothProps {
  roomCode: string;
  userUid: string;
  userName: string;
  initialRole: 'host' | 'guest';
  friends: FriendItem[];
  onAddFriend: (friend: FriendItem) => void;
  onLeave: () => void;
}

export function MultiplayerPhotobooth({
  roomCode,
  userUid,
  userName,
  initialRole,
  friends,
  onAddFriend,
  onLeave
}: MultiplayerPhotoboothProps) {
  const [room, setRoom] = useState<MultiplayerRoomData | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isCapturingLocal, setIsCapturingLocal] = useState(false);
  const [partnerAdded, setPartnerAdded] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef<MultiplayerRoomData | null>(null);
  const lastBeepRef = useRef<number | null>(null);
  const hasCapturedThisRoundRef = useRef<number | null>(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const isHost = room?.hostUid === userUid;
  const participantOrder = useMemo(() => room?.participantOrder || [], [room?.participantOrder]);
  const participants = useMemo(() => room?.participants || {}, [room?.participants]);
  const myData = participants[userUid];
  const partnerUid = participantOrder.find(id => id !== userUid);
  const partnerData = partnerUid ? participants[partnerUid] : null;

  // Connection Toast Listener
  const prevConnectedRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (partnerData) {
      if (prevConnectedRef.current !== undefined && prevConnectedRef.current !== partnerData.connected) {
        const msg = partnerData.connected 
          ? `${partnerData.name || 'Temanmu'} sudah masuk.` 
          : `${partnerData.name || 'Temanmu'} terputus.`;
          
        const timerMsg = setTimeout(() => {
          setToastMessage(msg);
        }, 0);

        const timerClear = setTimeout(() => {
          setToastMessage(null);
        }, 3000);

        return () => {
          clearTimeout(timerMsg);
          clearTimeout(timerClear);
        };
      }
      prevConnectedRef.current = partnerData.connected;
    }
  }, [partnerData?.connected, partnerData?.name, partnerData]);

  // Real-time Room Sync & Presence Heartbeat
  useEffect(() => {
    const roomDocRef = doc(db, 'rooms', roomCode);

    // Initial Join / Reconnect sync
    updateDoc(roomDocRef, {
      [`participants.${userUid}.connected`]: true,
      [`participants.${userUid}.name`]: userName,
      [`participants.${userUid}.lastSeen`]: getTimestamp(),
      updatedAt: getTimestamp()
    }).catch(console.error);

    // Heartbeat every 10s
    const heartbeat = setInterval(() => {
      updateDoc(roomDocRef, {
        [`participants.${userUid}.connected`]: true,
        [`participants.${userUid}.lastSeen`]: getTimestamp(),
        updatedAt: getTimestamp()
      }).catch(() => {});
    }, 10000);

    // Listener
    const unsub = onSnapshot(roomDocRef, (snap) => {
      if (!snap.exists()) {
        alert('Sesi room telah berakhir atau dihapus.');
        onLeave();
        return;
      }
      const data = snap.data() as MultiplayerRoomData;
      setRoom(data);
    }, (error) => {
      console.error('Room listener error:', error);
    });

    // Graceful disconnect on window unmount/unload
    const handleBeforeUnload = () => {
      updateDoc(roomDocRef, {
        [`participants.${userUid}.connected`]: false,
        [`participants.${userUid}.ready`]: false,
        [`participants.${userUid}.lastSeen`]: getTimestamp()
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsub();
    };
  }, [roomCode, userUid, userName, onLeave]);

  // Host Auto-Transfer if current host disconnected
  useEffect(() => {
    if (!room) return;
    const currentHost = room.participants[room.hostUid];
    const isHostDisconnected = !currentHost || !currentHost.connected;

    if (isHostDisconnected && participantOrder.length > 1) {
      // Find first connected participant
      const nextHostUid = participantOrder.find(id => room.participants[id]?.connected);
      if (nextHostUid && nextHostUid === userUid) {
        // Promote self to host
        updateDoc(doc(db, 'rooms', roomCode), {
          hostUid: userUid,
          updatedAt: getTimestamp()
        }).catch(console.error);
      }
    }
  }, [room, participantOrder, userUid, roomCode]);

  // Trigger Local Capture from Webcam
  const triggerLocalCapture = useCallback((roundIndex: number) => {
    setIsCapturingLocal(true);
    playShutterSound();
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 250);

    if (webcamRef.current) {
      const screenshot = webcamRef.current.getScreenshot();
      if (screenshot) {
        // Upload capture to Firestore room
        updateDoc(doc(db, 'rooms', roomCode), {
          [`captures.${userUid}.${roundIndex}`]: screenshot,
          updatedAt: getTimestamp()
        }).catch(console.error);
      }
    }
    setIsCapturingLocal(false);
  }, [roomCode, userUid]);

  // Synchronized Target Timestamp Countdown Engine
  useEffect(() => {
    if (!room || room.status !== 'countdown' || !room.targetCaptureTime) {
      return;
    }

    const currentRound = room.currentRound;
    let animationFrameId: number;

    const tick = () => {
      const target = room.targetCaptureTime!;
      const now = getTimestamp();
      const diffMs = target - now;

      if (diffMs <= 50) {
        // Capture moment!
        setCountdownRemaining(0);
        
        if (hasCapturedThisRoundRef.current !== currentRound) {
          hasCapturedThisRoundRef.current = currentRound;
          triggerLocalCapture(currentRound);
        }
      } else {
        const seconds = Math.ceil(diffMs / 1000);
        setCountdownRemaining(seconds);

        if (seconds > 0 && seconds <= 3 && lastBeepRef.current !== seconds) {
          lastBeepRef.current = seconds;
          playBeepSound(seconds === 1);
        }

        animationFrameId = requestAnimationFrame(tick);
      }
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrameId);
      setCountdownRemaining(null);
      lastBeepRef.current = null;
    };
  }, [room, triggerLocalCapture]);

  // Authoritative Round Progression (Host checks when all participants captured)
  useEffect(() => {
    if (!isHost || !room || (room.status !== 'countdown' && room.status !== 'capturing')) return;

    const currentRound = room.currentRound;
    const requiredPoses = room.totalPoses || 3;
    const connectedParticipants = participantOrder.filter(id => room.participants[id]?.connected);

    if (connectedParticipants.length === 0) return;

    // Check if all connected participants have uploaded photo for this round
    const allCaptured = connectedParticipants.every(id => {
      return !!room.captures?.[id]?.[currentRound];
    });

    if (allCaptured) {
      const nextRound = currentRound + 1;
      if (nextRound < requiredPoses) {
        // Schedule next round countdown after 3.2 seconds
        const timer = setTimeout(() => {
          updateDoc(doc(db, 'rooms', roomCode), {
            status: 'countdown',
            currentRound: nextRound,
            targetCaptureTime: getTimestamp() + 4000,
            updatedAt: getTimestamp()
          }).catch(console.error);
        }, 1200);
        return () => clearTimeout(timer);
      } else {
        // All poses completed!
        const timer = setTimeout(() => {
          updateDoc(doc(db, 'rooms', roomCode), {
            status: 'completed',
            targetCaptureTime: null,
            updatedAt: getTimestamp()
          }).catch(console.error);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [room, isHost, participantOrder, roomCode]);

  // Composite Photos onto Canvas when status is 'completed'
  const compositeFinalCanvas = useCallback(() => {
    if (!room || !canvasRef.current || room.status !== 'completed') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const layout = room.layout || '3-frames';
    const geometry = getMultiplayerLayoutGeometry(layout);
    const totalPoses = layout === '4-frames' ? 4 : layout === '3-frames' ? 3 : 2;

    canvas.width = geometry.width;
    canvas.height = geometry.height;

    // Find host & guest slot UIDs
    const slot0Uid = participantOrder[0] || userUid;
    const slot1Uid = participantOrder[1] || slot0Uid;

    const slot0Captures = room.captures?.[slot0Uid] || {};
    const slot1Captures = room.captures?.[slot1Uid] || slot0Captures;

    const slot0Filter = room.participants?.[slot0Uid]?.filter || 'normal';
    const slot1Filter = room.participants?.[slot1Uid]?.filter || 'normal';

    const baseColor = room.overlayBackground || '#FFFFFF';

    // Helper to load image
    const loadImage = (src: string) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
      });
    };

    // Load all pose images
    const loadSlotImages = async (captures: { [key: string]: string }) => {
      const promises: Promise<HTMLImageElement | null>[] = [];
      for (let i = 0; i < totalPoses; i++) {
        if (captures[i]) {
          promises.push(loadImage(captures[i]).catch(() => null));
        } else {
          promises.push(Promise.resolve(null));
        }
      }
      return Promise.all(promises);
    };

    Promise.all([
      loadSlotImages(slot0Captures),
      loadSlotImages(slot1Captures)
    ]).then(([slot0Images, slot1Images]) => {
      // 1. Draw Background
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
        const imgRatio = img.width / img.height;
        const targetRatio = w / h;
        let sx, sy, sw, sh;
        if (imgRatio > targetRatio) {
          sh = img.height;
          sw = sh * targetRatio;
          sx = (img.width - sw) / 2;
          sy = 0;
        } else {
          sw = img.width;
          sh = sw / targetRatio;
          sx = 0;
          sy = (img.height - sh) / 2;
        }
        ctx.save();
        ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        ctx.restore();
      };

      // 2. Draw Photo Slots
      for (let i = 0; i < totalPoses; i++) {
        const hostSlot = geometry.hostSlots[i];
        const guestSlot = geometry.guestSlots[i];

        // Slot 0 (Left)
        if (slot0Images[i] && hostSlot) {
          ctx.save();
          ctx.filter = getFilterCSS(slot0Filter);
          drawCover(slot0Images[i]!, hostSlot.x, hostSlot.y, hostSlot.width, hostSlot.height);
          ctx.restore();
        }

        // Slot 1 (Right)
        if (slot1Images[i] && guestSlot) {
          ctx.save();
          ctx.filter = getFilterCSS(slot1Filter);
          drawCover(slot1Images[i]!, guestSlot.x, guestSlot.y, guestSlot.width, guestSlot.height);
          ctx.restore();
        }
      }

      // 3. Draw Watermark & Meta Info
      ctx.filter = 'none';
      const isDarkBg = baseColor.toLowerCase() === '#000000' || baseColor.toLowerCase() === '#18181b';
      const primaryTextColor = isDarkBg ? '#FFFFFF' : '#18181B';
      const subTextColor = isDarkBg ? '#A1A1AA' : '#71717A';

      ctx.fillStyle = primaryTextColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const dateStr = new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '.');

      const name0 = room.participants?.[slot0Uid]?.name || 'Teman 1';
      const name1 = room.participants?.[slot1Uid]?.name || 'Teman 2';
      const participantLabel = slot0Uid !== slot1Uid ? `${name0}  &  ${name1}` : name0;

      // Brand text
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif';
      ctx.fillText(brandConfig.watermarkText, canvas.width / 2, canvas.height - 72);

      // Names & Room Info
      ctx.fillStyle = subTextColor;
      ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif';
      ctx.fillText(participantLabel, canvas.width / 2, canvas.height - 44);

      ctx.font = '500 12px monospace';
      ctx.fillText(`${dateStr} • ROOM ${roomCode}`, canvas.width / 2, canvas.height - 24);
    });
  }, [room, participantOrder, userUid, roomCode]);

  useEffect(() => {
    if (room?.status === 'completed') {
      const timer = setTimeout(() => {
        compositeFinalCanvas();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [room?.status, compositeFinalCanvas]);

  // Actions
  const handleToggleReady = () => {
    if (!room || !cameraReady) return;
    const currentReady = myData?.ready || false;
    updateDoc(doc(db, 'rooms', roomCode), {
      [`participants.${userUid}.ready`]: !currentReady,
      [`participants.${userUid}.cameraReady`]: true,
      updatedAt: getTimestamp()
    }).catch(console.error);
  };

  const handleStartSession = () => {
    if (!isHost || !room) return;
    const connectedParticipants = participantOrder.filter(id => room.participants[id]?.connected);
    const allReady = connectedParticipants.every(id => room.participants[id]?.ready);

    if (!allReady) {
      alert('Tunggu semua peserta siap sebelum memulai sesi.');
      return;
    }

    const totalPoses = room.layout === '4-frames' ? 4 : room.layout === '3-frames' ? 3 : 2;

    updateDoc(doc(db, 'rooms', roomCode), {
      status: 'countdown',
      currentRound: 0,
      totalPoses: totalPoses,
      targetCaptureTime: getTimestamp() + 4200,
      captures: {},
      updatedAt: getTimestamp()
    }).catch(console.error);
  };

  const handleChangeLayout = (layout: FrameLayoutType) => {
    if (!isHost) return;
    // Invalidate ready state when layout changes
    updateDoc(doc(db, 'rooms', roomCode), {
      layout,
      'participants': Object.fromEntries(
        Object.entries(room?.participants || {}).map(([k, v]) => [k, { ...v, ready: false }])
      ),
      updatedAt: getTimestamp()
    }).catch(console.error);
  };

  const handleChangeFrame = (frameId: string, baseColor: string) => {
    if (!isHost) return;
    updateDoc(doc(db, 'rooms', roomCode), {
      selectedFrameId: frameId,
      overlayBackground: baseColor,
      updatedAt: getTimestamp()
    }).catch(console.error);
  };

  const handleChangeFilter = (filterId: string) => {
    setSelectedFilter(filterId);
    updateDoc(doc(db, 'rooms', roomCode), {
      [`participants.${userUid}.filter`]: filterId,
      updatedAt: getTimestamp()
    }).catch(console.error);
  };

  const handleRetakeSinglePose = (roundIndex: number) => {
    if (!room) return;
    // Reset capture for this round
    const updatedCaptures = { ...room.captures };
    Object.keys(updatedCaptures).forEach(pUid => {
      if (updatedCaptures[pUid]) {
        delete updatedCaptures[pUid][roundIndex];
      }
    });

    updateDoc(doc(db, 'rooms', roomCode), {
      status: 'countdown',
      currentRound: roundIndex,
      targetCaptureTime: getTimestamp() + 4200,
      captures: updatedCaptures,
      updatedAt: getTimestamp()
    }).catch(console.error);
  };

  const handleRestartRoom = () => {
    if (!room) return;
    updateDoc(doc(db, 'rooms', roomCode), {
      status: 'lobby',
      currentRound: 0,
      targetCaptureTime: null,
      captures: {},
      'participants': Object.fromEntries(
        Object.entries(room.participants || {}).map(([k, v]) => [k, { ...v, ready: false }])
      ),
      updatedAt: getTimestamp()
    }).catch(console.error);
  };

  const copyRoomLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareRoomLink = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/?room=${roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Foto Bareng di ${brandConfig.brandName}`,
          text: `Yuk masuk room photobooth bareng aku: ${roomCode}`,
          url: url,
        });
      } catch {
        copyRoomLink();
      }
    } else {
      copyRoomLink();
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const downloadFinalResult = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `photobooth-room-${roomCode}-${getTimestamp()}.png`;
    a.click();
  };

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-600 font-sans text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
          <span className="font-medium">Masuk ke ruang foto...</span>
        </div>
      </div>
    );
  }

  const isCompleted = room.status === 'completed';
  const isCountdown = room.status === 'countdown' || room.status === 'capturing';
  const totalPoses = room.layout === '4-frames' ? 4 : room.layout === '3-frames' ? 3 : 2;
  const connectedCount = participantOrder.filter(id => room.participants[id]?.connected).length;
  const allConnectedReady = connectedCount >= 2 && participantOrder.every(id => !room.participants[id]?.connected || room.participants[id]?.ready);

  // Helper for generating initial initials
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col justify-between font-sans">
      
      {/* 1. TOAST NOTIFICATION CONTAINER */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-full text-xs font-semibold shadow-lg z-50 flex items-center gap-2 animate-fadeIn border border-zinc-800">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. TOP APP HEADER (Only visible when NOT in active countdown/capturing) */}
      {!isCountdown && (
        <header className="bg-white/80 backdrop-blur-md border-b border-zinc-100 px-4 py-3.5 sticky top-0 z-30 transition-all">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={onLeave}
                className="p-1 -ml-1 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
                title="Keluar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded font-mono border border-zinc-200">
                  ROOM {roomCode}
                </span>
                <button
                  onClick={copyRoomCode}
                  className="text-zinc-400 hover:text-zinc-900 p-1"
                  title="Salin Kode"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {partnerData && partnerData.uid && partnerData.connected && !friends.some(f => f.uid === partnerData.uid) && (
                <button
                  onClick={() => {
                    onAddFriend({ uid: partnerData.uid, name: partnerData.name });
                    setPartnerAdded(true);
                    setTimeout(() => setPartnerAdded(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1 text-zinc-700 transition-colors"
                >
                  {partnerAdded ? <Check className="w-3 h-3 text-emerald-600" /> : <UserPlus className="w-3 h-3" />}
                  <span>{partnerAdded ? 'Berteman' : 'Tambah Teman'}</span>
                </button>
              )}
              <button
                onClick={onLeave}
                className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold rounded-lg text-zinc-700 transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>
        </header>
      )}

      {/* 3. MAIN CONTAINER */}
      <main className={`flex-1 max-w-md w-full mx-auto px-4 py-6 flex flex-col justify-center items-center ${isCountdown ? 'py-2' : ''}`}>
        
        {/* VIEW A: LOBBY STATE */}
        {room.status === 'lobby' && (
          <div className="w-full space-y-5 animate-fadeIn">
            
            {/* Header Area */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-zinc-950">
                Foto Bareng Teman
              </h2>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                {connectedCount >= 2 
                  ? 'Kalian berdua sudah masuk! Atur posisi lalu klik Siap.'
                  : 'Bagikan link di bawah untuk mengajak temanmu berpose bareng.'}
              </p>
            </div>

            {/* Invite Panel (Hidden when room is full (2/2) to keep lobby neat & focused) */}
            {connectedCount < 2 ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3 shadow-xs">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Ajak Teman Gabung
                  </span>
                  <span className="block text-xs font-mono text-zinc-500 truncate mt-1">
                    {typeof window !== 'undefined' ? `${window.location.origin}/?room=${roomCode}` : roomCode}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={copyRoomLink}
                    className="py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 text-zinc-800 transition-colors"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Link Disalin' : 'Salin Link'}</span>
                  </button>
                  <button
                    onClick={shareRoomLink}
                    className="py-2 bg-black hover:bg-zinc-900 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 text-white transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Bagikan</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Camera Viewfinder Check */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Pratinjau Kameramu
                </span>
                <span className={`text-[10px] font-semibold flex items-center gap-1 ${cameraReady ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {cameraReady ? <Check className="w-3 h-3" /> : <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                  <span>{cameraReady ? 'Kamera aktif' : 'Menyiapkan kamera...'}</span>
                </span>
              </div>

              <div className="relative aspect-[4/3] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center bg-zinc-900 text-white">
                    <AlertCircle className="w-5 h-5 text-red-400 mb-2" />
                    <span className="text-xs font-bold">Kamera belum diaktifkan</span>
                    <span className="text-[10px] text-zinc-400 mt-1 max-w-xs">{cameraError}</span>
                  </div>
                ) : (
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored={true}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }}
                    onUserMedia={() => setCameraReady(true)}
                    onUserMediaError={(err) => setCameraError(typeof err === 'string' ? err : err.message || 'Error kamera')}
                    className="w-full h-full object-cover"
                    style={{ filter: getFilterCSS(selectedFilter) }}
                  />
                )}
                {/* Visual Position Helper Overlays */}
                {cameraReady && (
                  <div className="absolute bottom-3 left-3 bg-black/55 backdrop-blur-xs text-white text-[10px] px-2 py-1 rounded-md font-semibold">
                    Kamu di {isHost ? 'Kiri' : 'Kanan'}
                  </div>
                )}
              </div>
            </div>

            {/* Participant Status Cards (Clean, Compact, Friendly style) */}
            <div className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                Teman di Booth ({connectedCount}/2)
              </span>

              <div className="space-y-2">
                {/* Self */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 bg-white shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-800 text-xs font-bold flex items-center justify-center border border-zinc-200">
                      {getInitials(userName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-zinc-900">{userName}</span>
                        <span className="text-[9px] text-zinc-400 font-medium px-1 py-0.5 rounded border border-zinc-200 bg-zinc-50">Kamu</span>
                        {isHost && <span className="text-[9px] text-zinc-500 font-medium px-1 py-0.5 rounded border border-zinc-200 bg-zinc-50">Host</span>}
                      </div>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">
                        {myData?.ready ? 'Sudah siap' : 'Menyiapkan diri...'}
                      </span>
                    </div>
                  </div>

                  <div className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${myData?.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                    {myData?.ready && <Check className="w-3 h-3" />}
                    <span>{myData?.ready ? 'Siap' : 'Belum'}</span>
                  </div>
                </div>

                {/* Partner */}
                {partnerData && partnerData.uid ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 bg-white shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-800 text-xs font-bold flex items-center justify-center border border-zinc-200">
                        {getInitials(partnerData.name || 'Teman')}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-900">{partnerData.name || 'Teman'}</span>
                          {room.hostUid === partnerData.uid && (
                            <span className="text-[9px] text-zinc-500 font-medium px-1 py-0.5 rounded border border-zinc-200 bg-zinc-50">Host</span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-0.5 block">
                          {!partnerData.connected 
                            ? 'Koneksi terputus...' 
                            : partnerData.ready 
                              ? 'Sudah siap' 
                              : 'Menunggu siap...'}
                        </span>
                      </div>
                    </div>

                    <div className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${
                      !partnerData.connected
                        ? 'bg-amber-50 text-amber-700 animate-pulse'
                        : partnerData.ready
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {!partnerData.connected ? 'Terputus' : partnerData.ready ? 'Siap' : 'Belum'}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-zinc-200 text-center space-y-1 bg-white">
                    <Users className="w-4 h-4 text-zinc-400 mx-auto" />
                    <span className="block text-xs font-semibold text-zinc-600">Menunggu teman bergabung...</span>
                    <span className="block text-[10px] text-zinc-400">Bagikan link atau kode room di atas</span>
                  </div>
                )}
              </div>
            </div>

            {/* Layout Configuration (Only visible to host, styled premium but minimal) */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {isHost ? 'Atur Sesi Foto' : 'Sesi Foto Terpilih'}
                </span>
                <span className="text-xs font-semibold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">
                  {room.layout === '4-frames' ? '4 Pose' : room.layout === '3-frames' ? '3 Pose' : '2 Pose'}
                </span>
              </div>

              {isHost ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '2-frames', label: '2 Pose' },
                      { id: '3-frames', label: '3 Pose' },
                      { id: '4-frames', label: '4 Pose' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleChangeLayout(item.id as FrameLayoutType)}
                        className={`py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                          room.layout === item.id
                            ? 'border-zinc-950 bg-zinc-950 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Frame Base Color selection */}
                  <div className="space-y-1.5 pt-1">
                    <span className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Warna Strip Foto</span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {OFFICIAL_FRAMES.map(f => (
                        <button
                          key={f.id}
                          onClick={() => handleChangeFrame(f.id, f.baseColor)}
                          className={`w-6 h-6 rounded-full border shrink-0 transition-all ${
                            room.selectedFrameId === f.id ? 'ring-2 ring-zinc-950 ring-offset-2 scale-105' : 'border-zinc-300'
                          }`}
                          style={{ backgroundColor: f.baseColor }}
                          title={f.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-zinc-500">
                  Format dan tema diatur secara eksklusif oleh Host ({room.participants[room.hostUid]?.name || 'Teman'}).
                </div>
              )}
            </div>

            {/* Ready Actions */}
            <div className="space-y-2 pt-1">
              {/* Ready Button */}
              {cameraReady ? (
                <button
                  onClick={handleToggleReady}
                  className={`w-full min-h-[46px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    myData?.ready
                      ? 'bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200'
                      : 'bg-zinc-950 hover:bg-black text-white'
                  }`}
                >
                  {myData?.ready ? <Check className="w-4 h-4 text-emerald-600" /> : null}
                  <span>{myData?.ready ? 'Sudah Siap (Batal Siap)' : 'Siap Foto'}</span>
                </button>
              ) : (
                <button
                  disabled
                  className="w-full min-h-[46px] bg-zinc-100 border border-zinc-200 text-zinc-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <span>Menyiapkan kamera...</span>
                </button>
              )}

              {/* Start Button (Only visible for host) */}
              {isHost ? (
                <div className="space-y-1.5 text-center">
                  <button
                    onClick={handleStartSession}
                    disabled={!allConnectedReady}
                    className={`w-full min-h-[46px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      allConnectedReady
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-zinc-100 border border-zinc-200 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Mulai Foto</span>
                  </button>
                  {!allConnectedReady && (
                    <span className="text-[10px] text-zinc-400 block">
                      Menunggu teman di booth siap berpose.
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-center py-1 text-xs font-medium text-zinc-500">
                  {myData?.ready ? 'Menunggu host memulai sesi...' : 'Beri tahu host jika kamu sudah siap.'}
                </div>
              )}
            </div>

          </div>
        )}

        {/* VIEW B: ACTIVE COUNTDOWN / CAPTURE VIEW (Focus Mode, extreme minimalistic) */}
        {isCountdown && (
          <div className="w-full space-y-4 animate-fadeIn">
            
            {/* Minimal Pose Header & Visual Indicator */}
            <div className="w-full flex items-center justify-between text-zinc-800 px-1">
              <span className="text-xs font-semibold">
                Pose {(room.currentRound || 0) + 1} dari {totalPoses}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: totalPoses }).map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx === room.currentRound 
                        ? 'bg-zinc-950 scale-110' 
                        : idx < room.currentRound 
                          ? 'bg-emerald-500' 
                          : 'bg-zinc-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Compact Slot Assignment Indicator */}
            <div className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              {isHost ? 'Kamu di Kiri • Teman di Kanan' : 'Kamu di Kanan • Teman di Kiri'}
            </div>

            {/* Main Viewfinder Stage */}
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-zinc-200 shadow-sm transition-all">
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={true}
                forceScreenshotSourceSize={true}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }}
                className="w-full h-full object-cover"
                style={{ filter: getFilterCSS(selectedFilter) }}
              />

              {/* Synchronized Pulse Countdown Numbers Overlay */}
              {countdownRemaining !== null && countdownRemaining > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 transition-all">
                  <div className="bg-black/60 backdrop-blur-md w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center border border-white/20 animate-scaleUp">
                    <span className="text-5xl sm:text-6xl font-black font-mono text-white tracking-tighter">
                      {countdownRemaining}
                    </span>
                  </div>
                </div>
              )}

              {/* Shutter Shutter Flash Animation */}
              {showFlash && (
                <div className="absolute inset-0 bg-white animate-flash pointer-events-none z-30" />
              )}

              {/* Uploading indicator */}
              {isCapturingLocal && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-20 text-white gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span className="text-xs font-semibold">Mengirim foto...</span>
                </div>
              )}

              {/* Capture Feedback overlay */}
              {room.captures?.[userUid]?.[room.currentRound] && (
                <div className="absolute top-3 left-3 right-3 flex items-center justify-center z-20">
                  <div className="bg-zinc-950/85 backdrop-blur-xs border border-zinc-800 text-zinc-100 px-3 py-1.5 rounded-full text-[10px] font-semibold flex items-center gap-1.5 shadow-sm">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Foto disimpan! {partnerData?.connected && !room.captures?.[partnerUid || '']?.[room.currentRound] ? `Menunggu ${partnerData.name || 'teman'}...` : 'Lanjut ke pose berikutnya'}</span>
                  </div>
                </div>
              )}

              {/* Partner disconnect helper overlay */}
              {partnerData && !partnerData.connected && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4 text-center text-white z-20 gap-1.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span className="text-xs font-bold">{partnerData.name || 'Temanmu'} terputus</span>
                  <span className="text-[10px] text-zinc-300">Menunggu tersambung kembali...</span>
                </div>
              )}
            </div>

            {/* Filter Swiper */}
            <div className="w-full flex overflow-x-auto bg-white p-1 rounded-xl border border-zinc-100 gap-1 scrollbar-none shadow-xs">
              {FILTER_OPTIONS.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleChangeFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                    selectedFilter === f.id ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>

          </div>
        )}

        {/* VIEW C: COMPLETED RESULT CANVAS VIEW */}
        {room.status === 'completed' && (
          <div className="w-full space-y-4 animate-fadeIn">
            
            {/* Top Minimal Message Header */}
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-zinc-950 tracking-tight">Pose Cantik Selesai!</h2>
              <p className="text-xs text-zinc-500">Hasil gabungan kamu dan temanmu di booth</p>
            </div>

            {/* Generated Canvas display box */}
            <div className="w-full max-w-sm aspect-[5/7] bg-white rounded-2xl p-2.5 border border-zinc-200 shadow-sm mx-auto">
              <canvas ref={canvasRef} className="w-full h-full object-contain rounded-xl" />
            </div>

            {/* Retake per-pose controls (Warm, friendly title) */}
            <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-2 text-center shadow-xs">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Kurang pas? Ulang bareng pose pilihanmu
              </span>
              <div className="flex gap-2">
                {Array.from({ length: totalPoses }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRetakeSinglePose(idx)}
                    className="flex-1 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 text-zinc-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Pose {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Download and Secondary actions */}
            <div className="space-y-2">
              <button
                onClick={downloadFinalResult}
                className="w-full min-h-[46px] bg-zinc-950 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Photo Strip</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleRestartRoom}
                  className="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  <span>Foto Lagi</span>
                </button>
                <button
                  onClick={onLeave}
                  className="py-2.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-xl text-xs font-semibold flex items-center justify-center transition-colors"
                >
                  Selesai
                </button>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* 4. FOOTER (Only visible when NOT in active countdown/capturing) */}
      {!isCountdown && (
        <footer className="bg-white border-t border-zinc-100 py-3 text-center text-[10px] text-zinc-400">
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>{brandConfig.privacyNotice}</span>
          </div>
        </footer>
      )}

    </div>
  );
}
