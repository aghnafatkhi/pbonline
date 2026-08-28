// Unified Frame & Template Architecture
// Supports both Official Platform Frames and Custom Overlays

export type FrameLayoutType = '2-frames' | '3-frames' | '4-frames';

export interface PhotoSlot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CustomFrameData {
  id: string;
  name: string;
  width: number;
  height: number;
  overlayUrl: string; // The transparent PNG
  photoSlots: PhotoSlot[];
}

export interface OfficialFrameTemplate {
  id: string;
  name: string;
  category: 'minimal' | 'classic' | 'pastel' | 'film' | 'event';
  baseColor: string;
  textColor: string;
  subColor: string;
  borderStyle?: 'solid' | 'clean';
  badge?: string;
  icon?: string;
}

export const OFFICIAL_FRAMES: OfficialFrameTemplate[] = [
  {
    id: 'classic-white',
    name: 'Putih Klasik',
    category: 'minimal',
    baseColor: '#FFFFFF',
    textColor: '#18181B',
    subColor: '#71717A',
  },
  {
    id: 'deep-black',
    name: 'Hitam Elegan',
    category: 'minimal',
    baseColor: '#000000',
    textColor: '#FFFFFF',
    subColor: '#A1A1AA',
  },
  {
    id: 'soft-zinc',
    name: 'Abu Minimal',
    category: 'minimal',
    baseColor: '#F4F4F5',
    textColor: '#18181B',
    subColor: '#71717A',
  },
  {
    id: 'pastel-pink',
    name: 'Pastel Blush',
    category: 'pastel',
    baseColor: '#FBCFE8',
    textColor: '#831843',
    subColor: '#9D174D',
  },
  {
    id: 'sky-blue',
    name: 'Biru Langit',
    category: 'pastel',
    baseColor: '#BFDBFE',
    textColor: '#1E3A8A',
    subColor: '#1D4ED8',
  },
  {
    id: 'butter-cream',
    name: 'Krim Lembut',
    category: 'classic',
    baseColor: '#FEF3C7',
    textColor: '#78350F',
    subColor: '#92400E',
  },
  {
    id: 'sage-green',
    name: 'Hijau Sage',
    category: 'pastel',
    baseColor: '#DCFCE7',
    textColor: '#14532D',
    subColor: '#166534',
  },
];

export function getStandardLayoutGeometry(layout: FrameLayoutType) {
  const canvasWidth = 800;
  const canvasHeight = layout === '4-frames' ? 2400 : layout === '3-frames' ? 1850 : 1300;
  const totalPoses = layout === '4-frames' ? 4 : layout === '3-frames' ? 3 : 2;

  const paddingX = 48;
  const paddingTop = 48;
  const paddingBottom = 160;
  const gap = 32;
  const totalGaps = gap * (totalPoses - 1);
  
  const photoWidth = canvasWidth - paddingX * 2;
  const availableHeight = canvasHeight - paddingTop - paddingBottom - totalGaps;
  const photoHeight = availableHeight / totalPoses;

  const slots: PhotoSlot[] = [];
  for (let i = 0; i < totalPoses; i++) {
    slots.push({
      id: `slot-${i}`,
      x: paddingX,
      y: paddingTop + i * (photoHeight + gap),
      width: photoWidth,
      height: photoHeight,
    });
  }

  return {
    width: canvasWidth,
    height: canvasHeight,
    slots,
  };
}

export function getMultiplayerLayoutGeometry(layout: FrameLayoutType) {
  const canvasWidth = 1000;
  const canvasHeight = layout === '4-frames' ? 2400 : layout === '3-frames' ? 1850 : 1300;
  const totalPoses = layout === '4-frames' ? 4 : layout === '3-frames' ? 3 : 2;

  const paddingX = 40;
  const paddingTop = 48;
  const paddingBottom = 160;
  const gapY = 28;
  const gapX = 24;

  const totalGapsY = gapY * (totalPoses - 1);
  const availableHeight = canvasHeight - paddingTop - paddingBottom - totalGapsY;
  const photoHeight = availableHeight / totalPoses;
  const photoWidth = (canvasWidth - paddingX * 2 - gapX) / 2;

  const hostSlots: PhotoSlot[] = [];
  const guestSlots: PhotoSlot[] = [];

  for (let i = 0; i < totalPoses; i++) {
    const y = paddingTop + i * (photoHeight + gapY);
    
    // Host Slot (Left)
    hostSlots.push({
      id: `host-slot-${i}`,
      x: paddingX,
      y: y,
      width: photoWidth,
      height: photoHeight,
    });

    // Guest Slot (Right)
    guestSlots.push({
      id: `guest-slot-${i}`,
      x: paddingX + photoWidth + gapX,
      y: y,
      width: photoWidth,
      height: photoHeight,
    });
  }

  return {
    width: canvasWidth,
    height: canvasHeight,
    hostSlots,
    guestSlots,
    photoWidth,
    photoHeight,
  };
}
