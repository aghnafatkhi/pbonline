// Centralized brand & product configuration
// Easy to update without searching strings across components

export interface BrandConfig {
  brandName: string;
  brandShortName: string;
  tagline: string;
  description: string;
  watermarkText: string;
  supportEmail?: string;
  privacyNotice: string;
}

export const brandConfig: BrandConfig = {
  brandName: 'Photobooth Online',
  brandShortName: 'Photobooth',
  tagline: 'Bikin photo strip langsung dari browser',
  description: 'Platform photobooth online modern dan privacy-first untuk teman, sahabat, komunitas, acara, atau santai.',
  watermarkText: 'PHOTO STRIP',
  privacyNotice: 'Foto diproses di browser dan tidak disimpan ke galeri publik.',
};
