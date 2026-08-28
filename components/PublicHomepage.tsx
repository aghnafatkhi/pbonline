'use client';

import React, { useState } from 'react';
import { 
  Camera, 
  ArrowRight, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  Users, 
  Download, 
  Smartphone, 
  Share2, 
  ChevronRight,
  Palette,
  Upload
} from 'lucide-react';
import { brandConfig } from '@/lib/brand';
import { OFFICIAL_FRAMES, OfficialFrameTemplate } from '@/lib/templates';

interface PublicHomepageProps {
  onStartBooth: (selectedLayout?: '2-frames' | '3-frames' | '4-frames', selectedFrameId?: string, customOverlayDataUrl?: string) => void;
  onJoinWithCode?: (code: string) => void;
}

export default function PublicHomepage({ onStartBooth, onJoinWithCode }: PublicHomepageProps) {
  const [previewLayout, setPreviewLayout] = useState<'2-frames' | '3-frames' | '4-frames'>('3-frames');
  const [selectedPreviewFrame, setSelectedPreviewFrame] = useState<OfficialFrameTemplate>(OFFICIAL_FRAMES[0]);
  const [quickRoomCode, setQuickRoomCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickRoomCode.trim().length >= 4 && onJoinWithCode) {
      onJoinWithCode(quickRoomCode.trim().toUpperCase());
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Poses count
  const poseCount = previewLayout === '2-frames' ? 2 : previewLayout === '3-frames' ? 3 : 4;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 flex flex-col selection:bg-zinc-900 selection:text-white">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white shadow-xs">
              <Camera className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm sm:text-base tracking-tight text-zinc-900">
              {brandConfig.brandName}
            </span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-zinc-600">
            <button 
              onClick={() => scrollToSection('cara-pakai')} 
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Cara Pakai
            </button>
            <button 
              onClick={() => scrollToSection('pilihan-frame')} 
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Pilihan Frame
            </button>
            <button 
              onClick={() => scrollToSection('keunggulan')} 
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Keunggulan
            </button>
          </nav>

          {/* Nav CTA */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStartBooth(previewLayout, selectedPreviewFrame.id)}
              className="px-3.5 sm:px-4 py-2 bg-black hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Mulai Photobooth</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-8 pb-12 sm:pt-14 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Hero Left Column: Copy & Actions */}
            <div className="lg:col-span-7 flex flex-col items-start text-left">
              
              {/* Product Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200/80 text-[11px] font-medium text-zinc-700 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Photobooth Online Gratis • Tanpa Install</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-900 tracking-tight leading-[1.15] mb-4">
                Photobooth langsung dari browsermu.
              </h1>

              {/* Short Description */}
              <p className="text-sm sm:text-base text-zinc-600 leading-relaxed mb-6 max-w-xl">
                Pilih frame favorit, ambil pose terbaik sendiri atau bareng teman secara real-time, lalu langsung simpan photo strip dalam sekejap.
              </p>

              {/* Primary & Secondary Actions */}
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
                <button
                  onClick={() => onStartBooth(previewLayout, selectedPreviewFrame.id)}
                  className="px-6 py-3.5 bg-black hover:bg-zinc-800 active:scale-[0.99] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer min-h-[48px]"
                >
                  <Camera className="w-4 h-4" />
                  <span>Mulai Photobooth</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => scrollToSection('pilihan-frame')}
                  className="px-5 py-3.5 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[48px]"
                >
                  <Palette className="w-4 h-4 text-zinc-500" />
                  <span>Lihat Pilihan Frame</span>
                </button>
              </div>

              {/* Code Join Trigger & Camera Reassurance */}
              <div className="w-full max-w-md pt-2 border-t border-zinc-100 flex flex-col gap-2">
                {!showCodeInput ? (
                  <button 
                    onClick={() => setShowCodeInput(true)}
                    className="text-xs text-zinc-500 hover:text-zinc-900 font-medium flex items-center gap-1 text-left cursor-pointer w-fit"
                  >
                    <span>Punya kode room dari teman?</span>
                    <span className="underline font-bold text-zinc-700">Gabung di sini</span>
                  </button>
                ) : (
                  <form onSubmit={handleQuickJoin} className="flex gap-2 items-center animate-fadeIn">
                    <input
                      type="text"
                      value={quickRoomCode}
                      onChange={(e) => setQuickRoomCode(e.target.value.toUpperCase())}
                      placeholder="KODE ROOM"
                      maxLength={6}
                      className="px-3 py-2 text-xs font-mono font-bold tracking-widest uppercase bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-black w-36"
                    />
                    <button
                      type="submit"
                      disabled={quickRoomCode.trim().length < 4}
                      className="px-3 py-2 bg-black text-white text-xs font-bold rounded-lg disabled:opacity-40 hover:bg-zinc-800"
                    >
                      Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCodeInput(false)}
                      className="text-xs text-zinc-400 hover:text-zinc-600 px-1"
                    >
                      Batal
                    </button>
                  </form>
                )}

                {/* Natural Camera Permission Expectation Note */}
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>Akses kamera hanya diminta saat sesi foto dimulai.</span>
                </div>
              </div>

            </div>

            {/* Hero Right Column: Authentic Photo Strip Live Preview */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="w-full max-w-xs bg-white rounded-2xl p-4 border border-zinc-200/90 shadow-sm flex flex-col items-center">
                
                {/* Strip Interactive Header Controls */}
                <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    Contoh Format
                  </span>
                  
                  {/* Layout Selector */}
                  <div className="flex bg-zinc-100 p-0.5 rounded-lg text-[10px] font-bold">
                    {(['2-frames', '3-frames', '4-frames'] as const).map((layout) => (
                      <button
                        key={layout}
                        onClick={() => setPreviewLayout(layout)}
                        className={`px-2 py-1 rounded-md transition-all ${
                          previewLayout === layout
                            ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                            : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                      >
                        {layout.replace('-frames', 'P')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* The Simulated Real Photo Strip */}
                <div 
                  className="w-full rounded-xl p-3 sm:p-4 flex flex-col items-center transition-colors duration-200 shadow-2xs border border-zinc-200/50"
                  style={{ backgroundColor: selectedPreviewFrame.baseColor }}
                >
                  {/* Photo Boxes */}
                  <div className="w-full space-y-2 mb-3">
                    {Array.from({ length: poseCount }).map((_, idx) => (
                      <div 
                        key={idx}
                        className="w-full aspect-[4/3] rounded-md bg-zinc-200/80 border border-black/5 flex flex-col items-center justify-center relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-300/60 to-zinc-100/60 flex items-center justify-center">
                          <Camera className="w-5 h-5 text-zinc-400 group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="absolute bottom-1 right-1.5 text-[9px] font-mono text-zinc-400 font-bold bg-white/70 px-1 rounded">
                          0{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Strip Footer Details */}
                  <div className="w-full text-center pt-1 flex flex-col items-center">
                    <div 
                      className="text-[11px] font-black tracking-widest uppercase font-mono"
                      style={{ color: selectedPreviewFrame.textColor }}
                    >
                      {brandConfig.watermarkText}
                    </div>
                    <div 
                      className="text-[9px] font-mono font-medium opacity-70 mt-0.5"
                      style={{ color: selectedPreviewFrame.subColor }}
                    >
                      {new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' }).toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Color Selector Pills for Preview */}
                <div className="w-full mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 font-semibold">Pilih Warna:</span>
                  <div className="flex gap-1.5">
                    {OFFICIAL_FRAMES.slice(0, 5).map((frame) => (
                      <button
                        key={frame.id}
                        onClick={() => setSelectedPreviewFrame(frame)}
                        className={`w-5 h-5 rounded-full border transition-transform ${
                          selectedPreviewFrame.id === frame.id
                            ? 'scale-110 ring-2 ring-zinc-900 ring-offset-1 border-transparent'
                            : 'border-zinc-300 hover:scale-105'
                        }`}
                        style={{ backgroundColor: frame.baseColor }}
                        title={frame.name}
                      />
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Quick How It Works (3 Steps) */}
      <section id="cara-pakai" className="py-12 sm:py-16 bg-white border-y border-zinc-200/80 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          
          <div className="text-center max-w-lg mx-auto mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight mb-2">
              Cara Cepat Bikin Photo Strip
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500">
              Hanya butuh 3 langkah mudah tanpa perlu registrasi atau download aplikasi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Step 1 */}
            <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200/70 flex flex-col items-start text-left">
              <div className="w-7 h-7 rounded-lg bg-black text-white text-xs font-bold flex items-center justify-center mb-3">
                1
              </div>
              <h3 className="text-sm font-bold text-zinc-900 mb-1">
                Pilih Format & Frame
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Tentukan jumlah pose (2, 3, atau 4 foto) dan pilih palet warna frame yang sesuai dengan gayamu.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200/70 flex flex-col items-start text-left">
              <div className="w-7 h-7 rounded-lg bg-black text-white text-xs font-bold flex items-center justify-center mb-3">
                2
              </div>
              <h3 className="text-sm font-bold text-zinc-900 mb-1">
                Ambil Pose Terbaik
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Pose dengan timer otomatis. Kamu bisa foto solo atau undang teman untuk foto bersama secara real-time.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200/70 flex flex-col items-start text-left">
              <div className="w-7 h-7 rounded-lg bg-black text-white text-xs font-bold flex items-center justify-center mb-3">
                3
              </div>
              <h3 className="text-sm font-bold text-zinc-900 mb-1">
                Download Photo Strip
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Photo strip langsung tersusun rapi dan siap didownload dalam kualitas jernih ke HP atau komputermu.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 4. Frame Preview Catalog Section */}
      <section id="pilihan-frame" className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight mb-1">
                Pilihan Frame Siap Pakai
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500">
                Pilih warna favoritmu dan langsung mulai sesi foto dengan frame tersebut.
              </p>
            </div>
            
            <button
              onClick={() => onStartBooth(previewLayout, selectedPreviewFrame.id)}
              className="text-xs font-bold text-zinc-900 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>Mulai dengan semua frame</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Horizontal scroll on mobile / responsive grid on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Custom Frame Entry Card */}
            <label className="relative bg-white rounded-xl border border-dashed border-zinc-300 p-3 sm:p-4 flex flex-col justify-center items-center hover:border-black hover:bg-zinc-50 transition-all cursor-pointer group text-center min-h-[220px]">
              <input 
                type="file" 
                accept="image/png, image/webp" 
                className="hidden" 
                onChange={(e) => {
                  setUploadError(null);
                  const file = e.target.files?.[0];
                  if (!file) return;

                  // Validasi tipe file
                  if (!['image/png', 'image/webp'].includes(file.type)) {
                    setUploadError('Gunakan format file PNG atau WebP.');
                    return;
                  }

                  // Validasi ukuran (contoh: max 5MB)
                  if (file.size > 5 * 1024 * 1024) {
                    setUploadError('Ukuran file terlalu besar. Maksimal 5MB.');
                    return;
                  }

                  const reader = new FileReader();
                  reader.onload = (event) => {
                    if (event.target?.result) {
                      onStartBooth('3-frames', 'custom', event.target.result as string);
                    }
                  };
                  reader.onerror = () => {
                    setUploadError('Gagal membaca file. Coba lagi.');
                  };
                  reader.readAsDataURL(file);
                }} 
              />
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5 text-zinc-600" />
              </div>
              <h4 className="text-xs font-bold text-zinc-900 mb-1">Gunakan Frame Kamu</h4>
              <p className="text-[10px] text-zinc-500 px-2 mb-2">Upload desain overlay (PNG transparan) buatanmu sendiri.</p>
              
              {uploadError && (
                <div className="absolute bottom-2 inset-x-2 p-1.5 bg-red-50 rounded text-[9px] text-red-600 font-semibold border border-red-100">
                  {uploadError}
                </div>
              )}
            </label>

            {OFFICIAL_FRAMES.map((frame) => (
              <div
                key={frame.id}
                className="bg-white rounded-xl border border-zinc-200 p-3 sm:p-4 flex flex-col justify-between hover:border-zinc-300 transition-all hover:shadow-xs group"
              >
                <div>
                  {/* Frame Mini Mockup */}
                  <div 
                    className="w-full rounded-lg p-2.5 mb-3 border border-zinc-200/60 transition-transform group-hover:scale-[1.02]"
                    style={{ backgroundColor: frame.baseColor }}
                  >
                    <div className="space-y-1.5 mb-2">
                      <div className="w-full aspect-[4/3] rounded-xs bg-black/10 flex items-center justify-center">
                        <Camera className="w-3.5 h-3.5 text-zinc-400/80" />
                      </div>
                      <div className="w-full aspect-[4/3] rounded-xs bg-black/10 flex items-center justify-center">
                        <Camera className="w-3.5 h-3.5 text-zinc-400/80" />
                      </div>
                    </div>
                    <div 
                      className="text-center text-[8px] font-mono font-bold tracking-wider"
                      style={{ color: frame.textColor }}
                    >
                      {brandConfig.watermarkText}
                    </div>
                  </div>

                  {/* Frame Info */}
                  <div className="mb-3">
                    <h4 className="text-xs font-bold text-zinc-900">{frame.name}</h4>
                    <span className="text-[10px] text-zinc-400 capitalize">{frame.category}</span>
                  </div>
                </div>

                {/* Quick Launch with this Frame */}
                <button
                  onClick={() => onStartBooth('3-frames', frame.id)}
                  className="w-full py-2 bg-zinc-100 hover:bg-black hover:text-white text-zinc-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Pakai Frame Ini</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 5. Real Product Benefits & Audiences */}
      <section id="keunggulan" className="py-12 sm:py-16 bg-white border-t border-zinc-200/80 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          
          {/* Audience Tags */}
          <div className="mb-10 text-center">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-3">
              Cocok Untuk Siapa Saja
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                'Teman & Sahabat',
                'Pasangan',
                'Teman Sekelas',
                'Komunitas & Klub',
                'Acara & Momen Santai',
                'Foto Sendiri (Solo)'
              ].map((audience, i) => (
                <span 
                  key={i}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200/80 text-xs font-medium text-zinc-700"
                >
                  {audience}
                </span>
              ))}
            </div>
          </div>

          {/* 4 Concrete Real Product Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="p-4 sm:p-5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-zinc-900 mb-1">
                  Langsung di Browser
                </h4>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Bisa dibuka di Chrome, Safari, HP Android, iPhone, tablet, atau laptop tanpa perlu download aplikasi apapun.
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-zinc-900 mb-1">
                  100% Gratis & Privasi Aman
                </h4>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Semua proses rendering strip foto dilakukan di browsermu. Tidak ada foto yang disebar atau disimpan publik.
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-zinc-900 mb-1">
                  Bisa Foto Bareng (Real-time)
                </h4>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Cukup buat room dan bagikan kode ke teman untuk berpose bareng dari perangkat masing-masing.
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex gap-3.5 items-start">
              <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-zinc-900 mb-1">
                  Hasil Strip Resolusi Tinggi
                </h4>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Download hasil dalam format gambar jernih yang langsung siap diunggah ke media sosial atau dicetak.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. Final Call to Action */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-zinc-900 text-white rounded-2xl p-6 sm:p-10 text-center flex flex-col items-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight mb-2">
              Siap bikin photo strip pertamamu?
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
              Mulai sesi foto gratis sekarang juga langsung dari browser. Tanpa perlu mendaftar akun.
            </p>
            <button
              onClick={() => onStartBooth(previewLayout, selectedPreviewFrame.id)}
              className="px-6 py-3.5 bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-950 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer min-h-[48px]"
            >
              <Camera className="w-4 h-4" />
              <span>Mulai Photobooth Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="mt-auto bg-white border-t border-zinc-200 py-8 px-4 sm:px-6 text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-black text-white flex items-center justify-center text-[10px] font-bold">
              <Camera className="w-3 h-3" />
            </div>
            <span className="font-bold text-zinc-900">{brandConfig.brandName}</span>
            <span className="text-zinc-300">•</span>
            <span>{brandConfig.tagline}</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button onClick={() => scrollToSection('cara-pakai')} className="hover:text-zinc-900">
              Cara Pakai
            </button>
            <button onClick={() => scrollToSection('pilihan-frame')} className="hover:text-zinc-900">
              Pilihan Frame
            </button>
            <button onClick={() => onStartBooth()} className="font-semibold text-zinc-900 hover:underline">
              Mulai Photobooth
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-4 pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-400">
          <p>© {new Date().getFullYear()} {brandConfig.brandName}. Semua hak dilindungi.</p>
          <p>{brandConfig.privacyNotice}</p>
        </div>
      </footer>
    </div>
  );
}
