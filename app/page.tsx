'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp, 
  collection, 
  query, 
  where 
} from 'firebase/firestore';
import { generateRoomCode, getTimestamp } from '@/lib/utils';
import Webcam from 'react-webcam';

import { 
  Camera, 
  RefreshCcw, 
  Check, 
  UserPlus, 
  Users, 
  Download, 
  MessageSquare, 
  Send, 
  X, 
  Copy, 
  Sparkles, 
  Trash2, 
  Edit3, 
  ArrowRight,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { brandConfig } from '@/lib/brand';
import { OFFICIAL_FRAMES, FrameLayoutType } from '@/lib/templates';
import PublicHomepage from '@/components/PublicHomepage';
import SoloPhotobooth from '@/components/SoloPhotobooth';
import { MultiplayerPhotobooth } from '@/components/MultiplayerPhotobooth';
import { playBeepSound, playShutterSound } from '@/lib/sound';

function getLocalUid() {
  if (typeof window === 'undefined') return 'temp-uid';
  let uid = localStorage.getItem('pb_uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('pb_uid', uid);
  }
  return uid;
}

function getLocalName() {
  if (typeof window === 'undefined') return '@tamu';
  let name = localStorage.getItem('pb_name');
  if (!name || name === '@aghna' || name === 'aghna') {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    name = `@tamu_${randomSuffix}`;
    localStorage.setItem('pb_name', name);
  } else if (!name.startsWith('@')) {
    name = '@' + name.replace(/^@+/, '').trim();
    localStorage.setItem('pb_name', name);
  }
  return name;
}

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // AudioContext blocked
  }
}

interface FriendItem {
  uid: string;
  name: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'in_booth';
  lastSeen?: number;
  currentRoomCode?: string | null;
}

interface IncomingInvite {
  id: string;
  fromUid: string;
  fromName: string;
  roomCode: string;
  layout: string;
  status: string;
  createdAt?: unknown;
}

export default function App() {
  const [user, setUser] = useState<{uid: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setUser({ uid: getLocalUid() });
      setLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600 font-mono text-sm">
        Memuat...
      </div>
    );
  }

  if (!user) return null;

  return <MainApp user={user} />;
}

function MainApp({ user }: { user: {uid: string} }) {
  const [viewMode, setViewMode] = useState<'home' | 'lobby' | 'solo'>(() => {
    if (typeof window === 'undefined') return 'home';
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room') || params.get('join') || params.get('add')) {
        return 'lobby';
      }
    } catch {
      // Ignored
    }
    return 'home';
  });
  const [selectedFrameId, setSelectedFrameId] = useState<string>('classic-white');
  const [roomCode, setRoomCode] = useState('');
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [joinInput, setJoinInput] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('room') || params.get('join');
      return r ? r.trim().toUpperCase() : '';
    } catch {
      return '';
    }
  });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<'2-frames' | '3-frames' | '4-frames'>('3-frames');
  const [customOverlayUrl, setCustomOverlayUrl] = useState<string | null>(null);

  // User Profile & Friend System States
  const [userName, setUserName] = useState<string>(() => getLocalName());
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState<string>(() => getLocalName());
  const [friends, setFriends] = useState<FriendItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(`pb_friends_${user.uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [friendsData, setFriendsData] = useState<Record<string, FriendItem>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [pasteLinkInput, setPasteLinkInput] = useState('');
  const [linkAddError, setLinkAddError] = useState('');
  const [linkAddSuccess, setLinkAddSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'booth' | 'friends'>('booth');
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const [pendingFriendModal, setPendingFriendModal] = useState<{ uid: string; name: string } | null>(null);
  const [sendingInviteTo, setSendingInviteTo] = useState<string | null>(null);
  const [nowTime, setNowTime] = useState<number>(0);

  // Time updater for presence
  useEffect(() => {
    const timer = setTimeout(() => {
      setNowTime(Date.now());
    }, 0);
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 8000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Sync user presence to Firestore
  useEffect(() => {
    const name = getLocalName();
    const userDocRef = doc(db, 'users', user.uid);
    setDoc(userDocRef, {
      uid: user.uid,
      name: name,
      lastSeen: Date.now(),
      status: 'online',
      currentRoomCode: null
    }, { merge: true });

    const heartbeat = setInterval(() => {
      updateDoc(userDocRef, {
        lastSeen: Date.now(),
        status: 'online'
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(heartbeat);
  }, [user.uid]);

  // Check URL query params for ?add=@nickname&u=uid
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const addParam = params.get('add');
      const uidParam = params.get('u');

      if (addParam && uidParam && uidParam !== user.uid) {
        let cleanName = decodeURIComponent(addParam).trim();
        if (!cleanName.startsWith('@')) cleanName = '@' + cleanName;
        
        setTimeout(() => {
          setPendingFriendModal({
            uid: uidParam,
            name: cleanName
          });
        }, 100);
      }
    } catch {
      // Ignored
    }
  }, [user.uid]);

  // Listen to User Profile changes
  useEffect(() => {
    const userDocRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.friends && Array.isArray(data.friends)) {
          setFriends(data.friends);
          localStorage.setItem(`pb_friends_${user.uid}`, JSON.stringify(data.friends));
        }
      }
    });
    return unsub;
  }, [user.uid]);

  // Real-time listener for friends' live status
  useEffect(() => {
    if (friends.length === 0) return;
    const unsubs: (() => void)[] = [];

    friends.forEach((friend) => {
      const fRef = doc(db, 'users', friend.uid);
      const unsub = onSnapshot(fRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as FriendItem;
          setFriendsData((prev) => ({
            ...prev,
            [friend.uid]: {
              ...friend,
              name: data.name || friend.name,
              status: data.status || 'offline',
              lastSeen: data.lastSeen,
              currentRoomCode: data.currentRoomCode || null
            }
          }));
        }
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [friends]);

  // Real-time listener for incoming invites
  useEffect(() => {
    if (roomCode) return;

    const q = query(
      collection(db, 'invites'), 
      where('toUid', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(q, (snap) => {
      const pending: IncomingInvite[] = [];
      snap.forEach((d) => {
        pending.push({ id: d.id, ...d.data() } as IncomingInvite);
      });

      if (pending.length > 0) {
        const latest = pending[pending.length - 1];
        setIncomingInvite(latest);
        playNotificationSound();
      } else {
        setIncomingInvite(null);
      }
    });

    return unsub;
  }, [user.uid, roomCode]);

  const saveUserName = async () => {
    if (!tempName.trim()) return;
    let newName = tempName.trim();
    if (!newName.startsWith('@')) {
      newName = '@' + newName.replace(/^@+/, '');
    }
    setUserName(newName);
    localStorage.setItem('pb_name', newName);
    setIsEditingName(false);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: newName
      });
    } catch (e) {
      console.error(e);
    }
  };

  const getMyFriendLink = () => {
    if (typeof window === 'undefined') return '';
    const cleanNick = userName.startsWith('@') ? userName.substring(1) : userName;
    return `${window.location.origin}/?add=${encodeURIComponent(cleanNick)}&u=${user.uid}`;
  };

  const copyMyFriendLink = () => {
    const link = getMyFriendLink();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const confirmAddFriendFromModal = async () => {
    if (!pendingFriendModal) return;
    const target = pendingFriendModal;

    if (target.uid === user.uid) {
      alert('Ini link profil kamu sendiri.');
      setPendingFriendModal(null);
      return;
    }

    if (friends.some(f => f.uid === target.uid)) {
      alert(`${target.name} sudah ada di daftar teman.`);
      setPendingFriendModal(null);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      return;
    }

    const newFriendList: FriendItem[] = [
      ...friends,
      {
        uid: target.uid,
        name: target.name
      }
    ];

    setFriends(newFriendList);
    localStorage.setItem(`pb_friends_${user.uid}`, JSON.stringify(newFriendList));
    await updateDoc(doc(db, 'users', user.uid), {
      friends: newFriendList
    }).catch(() => {});

    setPendingFriendModal(null);
    setActiveTab('friends');
    setLinkAddSuccess(`Berhasil menambahkan ${target.name}!`);

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handlePasteFriendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkAddError('');
    setLinkAddSuccess('');

    const input = pasteLinkInput.trim();
    if (!input) return;

    try {
      let url: URL;
      try {
        url = new URL(input);
      } catch {
        setLinkAddError('Format link tidak valid.');
        return;
      }

      const addParam = url.searchParams.get('add');
      const uidParam = url.searchParams.get('u');

      if (!uidParam) {
        setLinkAddError('Link tidak valid.');
        return;
      }

      if (uidParam === user.uid) {
        setLinkAddError('Ini link profil kamu sendiri.');
        return;
      }

      if (friends.some(f => f.uid === uidParam)) {
        setLinkAddError('Sudah ada di daftar teman.');
        return;
      }

      const targetSnap = await getDoc(doc(db, 'users', uidParam));
      let targetName = addParam ? (addParam.startsWith('@') ? addParam : `@${addParam}`) : '@Teman';
      
      if (targetSnap.exists()) {
        const tData = targetSnap.data();
        if (tData.name) targetName = tData.name;
      }

      const newFriendList: FriendItem[] = [
        ...friends,
        {
          uid: uidParam,
          name: targetName
        }
      ];

      setFriends(newFriendList);
      localStorage.setItem(`pb_friends_${user.uid}`, JSON.stringify(newFriendList));
      await updateDoc(doc(db, 'users', user.uid), {
        friends: newFriendList
      });

      setLinkAddSuccess(`Berhasil menambahkan ${targetName}!`);
      setPasteLinkInput('');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Coba lagi';
      setLinkAddError('Gagal: ' + errorMsg);
    }
  };

  const removeFriend = async (friendUid: string) => {
    const updated = friends.filter(f => f.uid !== friendUid);
    setFriends(updated);
    localStorage.setItem(`pb_friends_${user.uid}`, JSON.stringify(updated));
    await updateDoc(doc(db, 'users', user.uid), {
      friends: updated
    }).catch(() => {});
  };

  const createRoom = async () => {
    setCreating(true);
    setError('');
    let code = '';
    let success = false;
    const initialFrame = OFFICIAL_FRAMES.find(f => f.id === selectedFrameId) || OFFICIAL_FRAMES[0];
    const initialBg = initialFrame ? initialFrame.baseColor : '#ffffff';
    const totalPoses = selectedLayout === '4-frames' ? 4 : selectedLayout === '3-frames' ? 3 : 2;
    
    for (let i = 0; i < 5; i++) {
      code = generateRoomCode(6);
      const ref = doc(db, 'rooms', code);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          createdAt: serverTimestamp(),
          status: 'lobby',
          layout: selectedLayout,
          selectedFrameId: selectedFrameId,
          overlayBackground: initialBg,
          hostUid: user.uid,
          participantOrder: [user.uid],
          participants: {
            [user.uid]: {
              uid: user.uid,
              name: userName,
              connected: true,
              ready: false,
              cameraReady: false,
              filter: 'normal',
              lastSeen: getTimestamp()
            }
          },
          currentRound: 0,
          totalPoses: totalPoses,
          targetCaptureTime: null,
          captures: {},
          updatedAt: getTimestamp()
        });

        updateDoc(doc(db, 'users', user.uid), {
          status: 'in_booth',
          currentRoomCode: code
        }).catch(() => {});

        success = true;
        break;
      }
    }
    
    setCreating(false);
    if (success) {
      setRole('host');
      setRoomCode(code);
    } else {
      setError('Gagal membuat room. Silakan coba lagi.');
    }
  };

  const inviteFriendToPhotobooth = async (friend: FriendItem) => {
    setSendingInviteTo(friend.uid);
    try {
      let code = '';
      const totalPoses = selectedLayout === '4-frames' ? 4 : selectedLayout === '3-frames' ? 3 : 2;
      for (let i = 0; i < 5; i++) {
        code = generateRoomCode(6);
        const ref = doc(db, 'rooms', code);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            createdAt: serverTimestamp(),
            status: 'lobby',
            layout: selectedLayout,
            selectedFrameId: selectedFrameId,
            overlayBackground: '#ffffff',
            hostUid: user.uid,
            participantOrder: [user.uid, friend.uid],
            participants: {
              [user.uid]: {
                uid: user.uid,
                name: userName,
                connected: true,
                ready: false,
                cameraReady: false,
                filter: 'normal',
                lastSeen: getTimestamp()
              },
              [friend.uid]: {
                uid: friend.uid,
                name: friend.name,
                connected: false,
                ready: false,
                filter: 'normal',
                lastSeen: getTimestamp()
              }
            },
            currentRound: 0,
            totalPoses: totalPoses,
            targetCaptureTime: null,
            captures: {},
            updatedAt: getTimestamp()
          });

          const inviteDocRef = doc(collection(db, 'invites'));
          await setDoc(inviteDocRef, {
            fromUid: user.uid,
            fromName: userName,
            toUid: friend.uid,
            roomCode: code,
            layout: selectedLayout,
            status: 'pending',
            createdAt: serverTimestamp()
          });

          updateDoc(doc(db, 'users', user.uid), {
            status: 'in_booth',
            currentRoomCode: code
          }).catch(() => {});

          setRole('host');
          setRoomCode(code);
          break;
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error';
      alert('Gagal mengirim ajakan: ' + errorMsg);
    } finally {
      setSendingInviteTo(null);
    }
  };

  const joinFriendRoom = async (friendRoomCode: string) => {
    if (!friendRoomCode) return;
    await joinRoomWithCode(friendRoomCode);
  };

  const acceptInvite = async () => {
    if (!incomingInvite) return;
    try {
      const inviteRef = doc(db, 'invites', incomingInvite.id);
      await updateDoc(inviteRef, { status: 'accepted' });
      const targetRoomCode = incomingInvite.roomCode;
      setIncomingInvite(null);
      await joinRoomWithCode(targetRoomCode);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error';
      alert('Gagal menerima undangan: ' + errorMsg);
    }
  };

  const declineInvite = async () => {
    if (!incomingInvite) return;
    try {
      await updateDoc(doc(db, 'invites', incomingInvite.id), { status: 'declined' });
      setIncomingInvite(null);
    } catch {
      setIncomingInvite(null);
    }
  };

  const joinRoomWithCode = async (targetCode: string) => {
    setError('');
    const code = targetCode.trim().toUpperCase();
    if (code.length < 4) return;
    
    const ref = doc(db, 'rooms', code);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      setError('Kode room tidak ditemukan.');
      alert('Kode room tidak ditemukan.');
      return;
    }
    
    const data = snap.data();
    const existingOrder: string[] = data.participantOrder || [];
    const isAlreadyIn = existingOrder.includes(user.uid);

    if (!isAlreadyIn && existingOrder.length >= 2) {
      setError('Room sudah penuh (maksimal 2 peserta).');
      alert('Room sudah penuh.');
      return;
    }

    const updatedOrder = isAlreadyIn ? existingOrder : [...existingOrder, user.uid];

    await updateDoc(ref, {
      [`participants.${user.uid}`]: {
        uid: user.uid,
        name: userName,
        connected: true,
        ready: false,
        filter: 'normal',
        lastSeen: getTimestamp()
      },
      participantOrder: updatedOrder,
      updatedAt: getTimestamp()
    });

    updateDoc(doc(db, 'users', user.uid), {
      status: 'in_booth',
      currentRoomCode: code
    }).catch(() => {});
    
    setRole(data.hostUid === user.uid ? 'host' : 'guest');
    setRoomCode(code);
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinInput.trim().length >= 4) {
      await joinRoomWithCode(joinInput);
    }
  };

  if (roomCode && role) {
    return (
      <MultiplayerPhotobooth 
        roomCode={roomCode} 
        initialRole={role} 
        userName={userName}
        userUid={user.uid}
        friends={friends}
        onAddFriend={(f) => {
          if (!friends.some(item => item.uid === f.uid)) {
            const updated = [...friends, f];
            setFriends(updated);
            localStorage.setItem(`pb_friends_${user.uid}`, JSON.stringify(updated));
            updateDoc(doc(db, 'users', user.uid), { friends: updated }).catch(() => {});
          }
        }}
        onLeave={() => { 
          setRoomCode(''); 
          setRole(null); 
          updateDoc(doc(db, 'users', user.uid), {
            status: 'online',
            currentRoomCode: null
          }).catch(() => {});
        }} 
      />
    );
  }

  if (viewMode === 'home') {
    return (
      <>
        {/* Modal Tambah Teman */}
        {pendingFriendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full border border-zinc-300 text-center">
              <h3 className="text-base font-bold text-zinc-900 mb-1">Tambah Teman</h3>
              <p className="text-xs text-zinc-600 mb-5">
                Tambahkan <span className="font-bold text-zinc-900">{pendingFriendModal.name}</span> ke daftar teman?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPendingFriendModal(null);
                    if (typeof window !== 'undefined') {
                      window.history.replaceState({}, document.title, window.location.pathname);
                    }
                  }}
                  className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-lg hover:bg-zinc-200"
                >
                  Batal
                </button>
                <button
                  onClick={confirmAddFriendFromModal}
                  className="flex-1 py-2.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-zinc-800"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Undangan Masuk Photobooth */}
        {incomingInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full border border-zinc-300 text-center">
              <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Camera className="w-5 h-5 text-zinc-900" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-1">Ajakan Foto</h3>
              <p className="text-xs text-zinc-600 mb-2">
                <span className="font-bold text-zinc-900">{incomingInvite.fromName}</span> mengajak kamu foto bareng.
              </p>
              <div className="text-xs font-mono text-zinc-500 mb-5 bg-zinc-100 py-1.5 rounded-md">
                Room {incomingInvite.roomCode}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={declineInvite}
                  className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-lg hover:bg-zinc-200"
                >
                  Tolak
                </button>
                <button
                  onClick={acceptInvite}
                  className="flex-1 py-2.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-zinc-800"
                >
                  Terima
                </button>
              </div>
            </div>
          </div>
        )}

        <PublicHomepage 
          onStartBooth={(layout, frameId, customUrl) => {
            if (layout) setSelectedLayout(layout);
            if (frameId) setSelectedFrameId(frameId);
            if (customUrl) setCustomOverlayUrl(customUrl);
            else setCustomOverlayUrl(null);
            setViewMode('solo');
          }}
          onJoinWithCode={(code) => {
            setJoinInput(code);
            setViewMode('lobby');
          }}
        />
      </>
    );
  }

  if (viewMode === 'solo') {
    return (
      <SoloPhotobooth
        initialLayout={selectedLayout}
        initialFrameId={selectedFrameId}
        customOverlayDataUrl={customOverlayUrl || undefined}
        onExit={() => {
          setViewMode('home');
          setCustomOverlayUrl(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4">
      
      {/* Modal Tambah Teman */}
      {pendingFriendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full border border-zinc-300 text-center">
            <h3 className="text-base font-bold text-zinc-900 mb-1">Tambah Teman</h3>
            <p className="text-xs text-zinc-600 mb-5">
              Tambahkan <span className="font-bold text-zinc-900">{pendingFriendModal.name}</span> ke daftar teman?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPendingFriendModal(null);
                  if (typeof window !== 'undefined') {
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }
                }}
                className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-lg hover:bg-zinc-200"
              >
                Batal
              </button>
              <button
                onClick={confirmAddFriendFromModal}
                className="flex-1 py-2.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-zinc-800"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undangan Masuk Photobooth */}
      {incomingInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full border border-zinc-300 text-center">
            <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Camera className="w-5 h-5 text-zinc-900" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-1">Ajakan Foto</h3>
            <p className="text-xs text-zinc-600 mb-2">
              <span className="font-bold text-zinc-900">{incomingInvite.fromName}</span> mengajak kamu foto bareng.
            </p>
            <div className="text-xs font-mono text-zinc-500 mb-5 bg-zinc-100 py-1.5 rounded-md">
              Room {incomingInvite.roomCode}
            </div>
            <div className="flex gap-2">
              <button
                onClick={declineInvite}
                className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-lg hover:bg-zinc-200"
              >
                Tolak
              </button>
              <button
                onClick={acceptInvite}
                className="flex-1 py-2.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-zinc-800"
              >
                Terima
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-xs">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setViewMode('home')}
              className="p-1 -ml-1 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
              title="Kembali ke Beranda"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-zinc-900 tracking-tight">{brandConfig.brandName}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="px-2 py-0.5 text-xs font-semibold rounded border border-zinc-300 focus:outline-none w-28"
                      maxLength={20}
                      autoFocus
                    />
                    <button onClick={saveUserName} className="p-1 bg-black text-white rounded hover:bg-zinc-800">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="p-1 bg-zinc-100 text-zinc-600 rounded">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-zinc-500">{userName}</span>
                    <button 
                      onClick={() => {
                        setTempName(userName);
                        setIsEditingName(true);
                      }} 
                      className="text-zinc-400 hover:text-zinc-900 p-0.5"
                      title="Ganti nama"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setViewMode('home')}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 px-2 py-1 rounded-md hover:bg-zinc-100 transition-colors"
          >
            Beranda
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-100 p-1 rounded-xl my-5">
          <button
            onClick={() => setActiveTab('booth')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 ${
              activeTab === 'booth'
                ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Sesi Foto</span>
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 ${
              activeTab === 'friends'
                ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Teman ({friends.length})</span>
          </button>
        </div>

        {/* TAB 1: Sesi Foto */}
        {activeTab === 'booth' && (
          <div className="space-y-4">
            
            {/* Layout Frame Picker */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-2 tracking-wider">
                Format Frame
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '2-frames', label: '2 Pose' },
                  { id: '3-frames', label: '3 Pose' },
                  { id: '4-frames', label: '4 Pose' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedLayout(item.id as '2-frames' | '3-frames' | '4-frames')}
                    className={`py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                      selectedLayout === item.id
                        ? 'border-black bg-black text-white shadow-xs'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Solo Photobooth Primary Action */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">Mode Solo (Langsung Foto)</h4>
                  <p className="text-[11px] text-zinc-500">Ambil photo strip sendiri tanpa perlu kode room.</p>
                </div>
              </div>
              <button
                onClick={() => setViewMode('solo')}
                className="w-full py-2.5 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Camera className="w-4 h-4" />
                <span>Mulai Foto Solo</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-zinc-200"></div>
              <span className="flex-shrink-0 mx-3 text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
                atau foto berdua (room)
              </span>
              <div className="flex-grow border-t border-zinc-200"></div>
            </div>

            {/* Buat Room Button */}
            <button
              onClick={createRoom}
              disabled={creating}
              className="w-full py-2.5 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Users className="w-4 h-4 text-zinc-600" />
              <span>{creating ? 'Membuat Room...' : 'Buat Room Berdua'}</span>
            </button>

            {/* Input Gabung Kode */}
            <form onSubmit={joinRoom} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="KODE ROOM"
                  maxLength={6}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-black text-center text-sm font-mono tracking-widest uppercase bg-zinc-50"
                />
                <button
                  type="submit"
                  disabled={joinInput.length < 4}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-bold disabled:opacity-40"
                >
                  Gabung
                </button>
              </div>
              {error && <p className="text-red-600 text-xs font-medium text-center">{error}</p>}
            </form>

            {/* Quick Friend Invites if any */}
            {friends.length > 0 && (
              <div className="pt-3 border-t border-zinc-100">
                <span className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Ajak Cepat
                </span>
                <div className="space-y-1.5">
                  {friends.slice(0, 3).map((f) => {
                    const dynamicData = friendsData[f.uid] || f;
                    const isOnline = Boolean(dynamicData.lastSeen && nowTime && (nowTime - dynamicData.lastSeen < 45000));
                    const isInBooth = Boolean(dynamicData.status === 'in_booth' && dynamicData.currentRoomCode);

                    return (
                      <div key={f.uid} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-100">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            isInBooth ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-zinc-300'
                          }`} />
                          <span className="text-xs font-bold text-zinc-800">{dynamicData.name || f.name}</span>
                          <span className="text-[10px] text-zinc-400">
                            {isInBooth ? 'Di booth' : isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>

                        {isInBooth ? (
                          <button
                            onClick={() => joinFriendRoom(dynamicData.currentRoomCode!)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                          >
                            Masuk
                          </button>
                        ) : (
                          <button
                            onClick={() => inviteFriendToPhotobooth(f)}
                            disabled={sendingInviteTo === f.uid}
                            className="px-2.5 py-1 bg-black hover:bg-zinc-800 text-white rounded text-[10px] font-bold disabled:opacity-50"
                          >
                            {sendingInviteTo === f.uid ? '...' : 'Ajak'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Daftar Teman */}
        {activeTab === 'friends' && (
          <div className="space-y-4">
            {/* Salin Link Profil */}
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-xs font-bold text-zinc-800 mb-1">Link Profil</span>
              <p className="text-[11px] text-zinc-500 mb-2.5">
                Kirim link ke teman agar mereka bisa langsung terhubung.
              </p>
              <button
                type="button"
                onClick={copyMyFriendLink}
                className="w-full py-2 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Tersalin' : 'Salin Link Profil'}</span>
              </button>
            </div>

            {/* Tempel Link Teman */}
            <form onSubmit={handlePasteFriendLink} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={pasteLinkInput}
                  onChange={(e) => setPasteLinkInput(e.target.value)}
                  placeholder="Tempel link teman di sini..."
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-zinc-50 border border-zinc-200 focus:outline-none focus:border-black"
                />
                <button
                  type="submit"
                  disabled={!pasteLinkInput.trim()}
                  className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold disabled:opacity-40"
                >
                  Tambah
                </button>
              </div>
              {linkAddError && <p className="text-red-600 text-xs font-medium">{linkAddError}</p>}
              {linkAddSuccess && <p className="text-emerald-600 text-xs font-medium">{linkAddSuccess}</p>}
            </form>

            {/* List Teman */}
            <div className="space-y-2 pt-2">
              <span className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Daftar Teman ({friends.length})
              </span>

              {friends.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                  Belum ada teman terhubung.
                </div>
              ) : (
                friends.map((friend) => {
                  const dynamic = friendsData[friend.uid] || friend;
                  const isOnline = Boolean(dynamic.lastSeen && nowTime && (nowTime - dynamic.lastSeen < 45000));
                  const isInBooth = Boolean(dynamic.status === 'in_booth' && dynamic.currentRoomCode);

                  return (
                    <div 
                      key={friend.uid} 
                      className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl border border-zinc-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          isInBooth ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-zinc-300'
                        }`} />
                        <div>
                          <div className="text-xs font-bold text-zinc-900">{dynamic.name || friend.name}</div>
                          <div className="text-[10px] text-zinc-400">
                            {isInBooth ? 'Di photobooth' : isOnline ? 'Online' : 'Offline'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {isInBooth ? (
                          <button
                            onClick={() => joinFriendRoom(dynamic.currentRoomCode!)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                          >
                            Masuk
                          </button>
                        ) : (
                          <button
                            onClick={() => inviteFriendToPhotobooth(friend)}
                            disabled={sendingInviteTo === friend.uid}
                            className="px-2.5 py-1 bg-black hover:bg-zinc-800 text-white rounded text-[11px] font-bold disabled:opacity-50"
                          >
                            {sendingInviteTo === friend.uid ? '...' : 'Ajak'}
                          </button>
                        )}

                        <button
                          onClick={() => removeFriend(friend.uid)}
                          className="p-1 text-zinc-400 hover:text-red-600 rounded"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Privacy Assurance Footer */}
        <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>{brandConfig.privacyNotice}</span>
        </div>
      </div>
    </div>
  );
}

