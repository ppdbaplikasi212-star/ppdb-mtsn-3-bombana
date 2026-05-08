import { useState, useEffect } from 'react';
import React from 'react';
import { auth, db, signInWithGoogle, signOut } from './lib/firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, collection, query, getDocs, serverTimestamp, onSnapshot, where } from 'firebase/firestore';
import { safeGetDoc, safeSetDoc } from './lib/firestore-utils';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, ClipboardList, Calendar, Users, Download, ChevronRight, GraduationCap, CheckCircle2, Phone, Ticket } from 'lucide-react';
import Barcode from 'react-barcode';
import RegistrationForm from './components/RegistrationForm';
import AdminDashboard from './components/AdminDashboard';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<'home' | 'register' | 'admin'>('home');
  const [loading, setLoading] = useState(true);
  
  // App Settings
  const [settings, setSettings] = useState<{
    headerBg?: string;
    logoUrl?: string;
    facilities?: string[];
    extracurriculars?: string[];
  }>({});

  useEffect(() => {
    // Fetch settings
    const settingsSub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    }, (err) => {
      console.error('Error fetching settings:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const isSuperAdmin = user.email?.toLowerCase() === 'ppdbaplikasi212@gmail.com';
        
        // Check if user is in allowed admins list
        const adminRef = doc(db, 'admins', user.uid);
        const adminDoc = await safeGetDoc(adminRef);
        
        // Fallback: check by email if UID doc doesn't exist yet
        let isStaff = false;
        if (adminDoc && adminDoc.exists()) {
          isStaff = true;
        } else if (user.email) {
          // Instead of query (which requires list permission), we try to get the doc with email as ID
          const emailDocRef = doc(db, 'admins', user.email.toLowerCase());
          const emailDoc = await safeGetDoc(emailDocRef);
          
          if (emailDoc && emailDoc.exists()) {
            isStaff = true;
            // Auto-migrate to UID-based doc for better performance
            await safeSetDoc(adminRef, {
              email: user.email.toLowerCase(),
              role: (emailDoc.data() as any).role || 'staff',
              createdAt: serverTimestamp()
            });
            // We can optionally delete the old email-based doc, 
            // but keeping it is safer for rule-access-via-email-ID
          }
        }

        setIsAdmin(isSuperAdmin || isStaff);

        if (isSuperAdmin) {
          try {
            // Ensure super admin doc exists
            if (!adminDoc || !adminDoc.exists()) {
              await safeSetDoc(adminRef, {
                email: user.email.toLowerCase(),
                role: 'owner',
                createdAt: serverTimestamp()
              });
            }
            
            // Seed settings ONLY here for the owner if they don't exist
            const settingsRef = doc(db, 'settings', 'general');
            const settingsDoc = await safeGetDoc(settingsRef);
            if (settingsDoc && !settingsDoc.exists()) {
              await safeSetDoc(settingsRef, {
                facilities: ['Kelas Digital', 'Lab Komputer', 'Tahfidz Qur\'an', 'Shalat Berjamaah'],
                extracurriculars: ['Pramuka', 'PMR', 'Seni Baca Qur\'an', 'Futsal'],
                updatedAt: serverTimestamp()
              });
            }
          } catch (err) {
            console.error('Error seeding admin/settings:', err);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      settingsSub();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-900 text-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <GraduationCap size={48} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="h-20 bg-emerald-800 text-white flex items-center justify-between px-6 md:px-10 shadow-lg shrink-0 z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('home')}>
          {settings.logoUrl ? (
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full overflow-hidden flex items-center justify-center p-1.5 border border-emerald-700/50">
              <img src={settings.logoUrl} alt="Logo Sekolah" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-emerald-600 rotate-45"></div>
            </div>
          )}
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight leading-none uppercase">MTsN 3 Bombana</h1>
            <p className="text-[10px] md:text-xs text-emerald-100 font-medium tracking-wider">Sistem PPDB Digital</p>
          </div>
        </div>
        
        <div className="flex gap-4 md:gap-8 items-center text-sm font-medium">
          <button onClick={() => setView('home')} className={cn("hidden md:block transition-colors hover:text-emerald-300", view === 'home' && "text-emerald-300 underline underline-offset-8")}>Beranda</button>
          
          {user ? (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button 
                  onClick={() => setView('admin')}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs md:text-sm font-bold", view === 'admin' ? 'bg-amber-400 text-emerald-900' : 'bg-emerald-700 hover:bg-emerald-600')}
                >
                  DASHBOARD
                </button>
              )}
              <button 
                onClick={signOut}
                className="bg-emerald-800 text-white p-2 rounded-lg hover:bg-emerald-700 transition-all border border-emerald-700"
                title="Keluar"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={signInWithGoogle}
                className="bg-amber-400 text-emerald-950 px-4 md:px-5 py-2 rounded-lg font-black flex items-center gap-2 hover:bg-amber-300 transition-all text-xs shadow-lg shadow-amber-600/20"
              >
                <LogIn size={16} /> LOGIN PANITIA
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content Layout */}
      <main className="flex-grow flex flex-col md:flex-row p-4 md:p-8 gap-8 bg-gradient-to-br from-emerald-50 via-white to-slate-100 overflow-auto">
        
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col gap-6"
            >
              {/* Branding Header */}
              <div 
                className="bg-emerald-900 rounded-3xl p-6 md:p-10 border border-emerald-900/5 flex flex-col justify-end relative h-[300px] md:h-96 overflow-hidden transition-all duration-1000"
                style={settings.headerBg ? { 
                  backgroundImage: `linear-gradient(to top, rgba(6, 78, 59, 0.9), rgba(6, 78, 59, 0.2)), url(${settings.headerBg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                } : {}}
              >
                {!settings.headerBg && (
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600 rounded-full -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400 rounded-full -ml-10 -mb-10"></div>
                  </div>
                )}
                <div className="relative z-10">
                  <span className="bg-amber-400 text-emerald-900 px-3 py-1 rounded-full text-[10px] font-bold w-fit mb-4 block uppercase tracking-wider">TA {settings.academicYear || "2026/2027"}</span>
                  <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4 drop-shadow-md">
                    Membangun Masa Depan <br className="hidden md:block" />Berbasis Adab & Ilmu.
                  </h2>
                  <p className="text-emerald-50 max-w-lg text-sm md:text-base mb-6 drop-shadow-sm font-medium">
                    Wujudkan impian pendidikan Anda di Madrasah pilihan. Proses pendaftaran kini lebih modern, transparan, dan terintegrasi secara digital.
                  </p>
                  <button 
                    onClick={() => setView('register')}
                    className="bg-amber-400 text-emerald-900 px-8 py-3 rounded-xl font-bold hover:bg-amber-300 transition-all shadow-lg shadow-amber-600/20 flex items-center gap-2 w-fit"
                  >
                    DAFTAR SEKARANG <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col group hover:border-emerald-500 transition-colors">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ekstrakurikuler Unggulan</h3>
                  <div className="flex flex-wrap gap-2">
                    {(settings.extracurriculars || ['Pramuka', 'PMR', 'Seni Baca Qur\'an']).map((item, i) => (
                      <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" /> {item}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col group hover:border-amber-500 transition-colors">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Layanan Pengaduan</h3>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex flex-col items-center justify-center text-emerald-700 shrink-0">
                      <Phone size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{settings.complaintPhone || '0852 4155 2115'}</p>
                      <p className="text-xs text-slate-500">{settings.complaintName || 'Panitia Pendaftaran (Pkt. Irham)'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 col-span-1 md:col-span-2">
                  <h3 className="text-sm font-bold text-emerald-800 mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-emerald-600 rounded-full" /> Fasilitas Madrasah Kami
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold text-slate-600">
                    {(settings.facilities || ['Kelas Digital', 'Lab Komputer', 'Tahfidz Qur\'an', 'Perpustakaan']).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <CheckCircle2 size={16} className="text-emerald-500" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 w-full max-w-4xl mx-auto"
            >
              <RegistrationForm 
                logoUrl={settings.logoUrl} 
                academicYear={settings.academicYear}
                onComplete={() => setView('home')} 
              />
            </motion.div>
          )}

          {view === 'admin' && isAdmin && (
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <AdminDashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-12 bg-white border-t border-slate-200 flex items-center justify-between px-6 md:px-10 text-[9px] md:text-[10px] text-slate-400 font-bold shrink-0 uppercase tracking-widest overflow-hidden">
        <div className="flex gap-4 md:gap-8 items-center">
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Terakreditasi A</span>
          <span className="hidden sm:inline">Madrasah Mandiri Berprestasi</span>
        </div>
        <div className="text-right">
          Copyright &copy; 2026 MTsN 3 Bombana • Sultra
        </div>
      </footer>
    </div>
  );
}
