import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, orderBy, setDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { safeUpdateDoc, safeDeleteDoc, safeSetDoc, safeGetDoc, OperationType, handleFirestoreError } from '../lib/firestore-utils';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Trash2, CheckCircle, XCircle, Filter, FileSpreadsheet, ChevronDown, Calendar, Image, FileText, ExternalLink, Download, Settings, Plus, X, ShieldCheck, UserPlus, Phone } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Registrant {
  id: string;
  fullName: string;
  nisn: string;
  originSchool: string;
  phone: string;
  email: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  createdAt: any;
  address: string;
  photoUrl?: string;
  familyCardUrl?: string;
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'pendaftar' | 'pengaturan' | 'admin'>('pendaftar');
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Verified' | 'Rejected'>('All');
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<{ url: string, name: string } | null>(null);
  
  // Settings state
  const [headerBg, setHeaderBg] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [facilities, setFacilities] = useState<string[]>([]);
  const [extracurriculars, setExtracurriculars] = useState<string[]>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [complaintPhone, setComplaintPhone] = useState('');
  const [complaintName, setComplaintName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Admin Management state
  const [adminList, setAdminList] = useState<{ id: string; email: string; role: string }[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    setIsSuperAdmin(auth.currentUser?.email === 'ppdbaplikasi212@gmail.com');
    const q = query(collection(db, 'registrants'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Registrant[];
      setRegistrants(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'registrants');
    });

    // Fetch current settings
    const settingsSub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHeaderBg(data.headerBg || '');
        setLogoUrl(data.logoUrl || '');
        setFacilities(data.facilities || []);
        setExtracurriculars(data.extracurriculars || []);
        setAcademicYear(data.academicYear || '2024 / 2025');
        setComplaintPhone(data.complaintPhone || '0852 4155 2115');
        setComplaintName(data.complaintName || 'Panitia Pendaftaran (Pkt. Irham)');
      }
    }, (err) => {
      console.error('Settings fetch error:', err);
    });

    // Fetch Admins if super admin
    let adminSub = () => {};
    if (auth.currentUser?.email === 'ppdbaplikasi212@gmail.com') {
      adminSub = onSnapshot(collection(db, 'admins'), (snapshot) => {
        setAdminList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      });
    }

    return () => {
      unsubscribe();
      settingsSub();
      adminSub();
    };
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    try {
      const docId = newAdminEmail.toLowerCase(); 
      await safeSetDoc(doc(db, 'admins', docId), {
        email: newAdminEmail.toLowerCase(),
        role: 'staff',
        createdAt: new Date()
      });
      setNewAdminEmail('');
      alert('Email berhasil didaftarkan! Panitia sekarang bisa login menggunakan akun Google mereka.');
    } catch (err) {
      console.error(err);
      alert('Gagal menambah admin.');
    }
  };

  const removeAdmin = async (id: string, email: string) => {
    if (confirm(`Hapus akses admin untuk ${email}?`)) {
      try {
        // We delete by ID provided (could be UID or Email)
        await safeDeleteDoc(doc(db, 'admins', id));
        
        // Also try to find the other doc (if it exists) to be thorough
        // If id was email, look for any doc with that email that might be UID-keyed
        const q = query(collection(db, 'admins'), where('email', '==', email));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          if (d.id !== id) {
            await safeDeleteDoc(doc(db, 'admins', d.id));
          }
        }
      } catch (err) {
        console.error(err);
        alert('Gagal menghapus admin.');
      }
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const settingsRef = doc(db, 'settings', 'general');
      await safeSetDoc(settingsRef, {
        headerBg,
        logoUrl,
        facilities,
        extracurriculars,
        academicYear,
        complaintPhone,
        complaintName,
        updatedAt: new Date()
      }, { merge: true });
      alert('Pengaturan berhasil disimpan!');
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleHeaderBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeaderBg(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await safeUpdateDoc(doc(db, 'registrants', id), { status });
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui status. Pastikan Anda memiliki hak akses admin.');
    }
  };

  const downloadFile = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      try {
        await safeDeleteDoc(doc(db, 'registrants', id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const downloadExcel = () => {
    const dataToExport = registrants.map(r => ({
      'Nama Lengkap': r.fullName,
      'NISN': r.nisn,
      'Sekolah Asal': r.originSchool,
      'Telepon/WA': r.phone,
      'Email': r.email,
      'Status': r.status,
      'Alamat': r.address,
      'Tanggal Daftar': r.createdAt?.toDate ? format(r.createdAt.toDate(), 'dd MMMM yyyy HH:mm', { locale: id }) : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pendaftar');
    XLSX.writeFile(workbook, `PPDB_MTsN3Bombana_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const filteredRegistrants = registrants.filter(r => {
    const matchesSearch = r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.nisn.includes(searchTerm) || 
                          r.originSchool.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-10">
      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('pendaftar')}
          className={cn(
            "pb-4 px-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all relative",
            activeTab === 'pendaftar' ? "text-emerald-800" : "text-slate-400 hover:text-slate-600"
          )}
        >
          DATA PENDAFTAR
          {activeTab === 'pendaftar' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-t-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('pengaturan')}
          className={cn(
            "pb-4 px-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all relative",
            activeTab === 'pengaturan' ? "text-emerald-800" : "text-slate-400 hover:text-slate-600"
          )}
        >
          PENGATURAN APLIKASI
          {activeTab === 'pengaturan' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-t-full" />}
        </button>
        {isSuperAdmin && (
          <button 
            onClick={() => setActiveTab('admin')}
            className={cn(
              "pb-4 px-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all relative",
              activeTab === 'admin' ? "text-emerald-800" : "text-slate-400 hover:text-slate-600"
            )}
          >
            KELOLA PANITIA
            {activeTab === 'admin' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-t-full" />}
          </button>
        )}
      </div>

      {activeTab === 'pendaftar' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total</p>
              <h4 className="text-4xl font-black text-emerald-900">{registrants.length}</h4>
            </div>
            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 border-l-4 border-l-amber-400">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Pending</p>
              <h4 className="text-4xl font-black text-amber-600">{registrants.filter(r => r.status === 'Pending').length}</h4>
            </div>
            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 border-l-4 border-l-emerald-500">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Verified</p>
              <h4 className="text-4xl font-black text-emerald-600">{registrants.filter(r => r.status === 'Verified').length}</h4>
            </div>
            <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 border-l-4 border-l-red-400">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Rejected</p>
              <h4 className="text-4xl font-black text-red-600">{registrants.filter(r => r.status === 'Rejected').length}</h4>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4 bg-slate-50/50">
              <div className="flex gap-4 items-center flex-grow max-w-2xl">
                <div className="relative flex-grow">
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari nama, NISN, atau sekolah..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                  />
                  <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                </div>
                <div className="relative min-w-[140px]">
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full appearance-none pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                  >
                    <option value="All">Semua</option>
                    <option value="Pending">Menunggu</option>
                    <option value="Verified">Terverifikasi</option>
                    <option value="Rejected">Ditolak</option>
                  </select>
                  <Filter className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>
              <button 
                onClick={downloadExcel}
                className="flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-950 transition-all text-xs tracking-widest shadow-lg"
              >
                <FileSpreadsheet size={18} className="text-emerald-400" /> EXPORT EXCEL
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-6 py-5">IDENTITAS CALON SISWA</th>
                    <th className="px-6 py-5">SEKOLAH ASAL</th>
                    <th className="px-6 py-5">BERKAS</th>
                    <th className="px-6 py-5 text-center">STATUS VERIFIKASI</th>
                    <th className="px-6 py-5 text-right">OPERASI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold tracking-widest uppercase text-xs">Memproses Data...</td></tr>
                  ) : filteredRegistrants.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 text-sm">
                        <div className="font-bold text-slate-900 mb-0.5">{r.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">NISN: {r.nisn}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">{r.originSchool}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {r.photoUrl ? (
                            <button 
                              onClick={() => setSelectedFile({ url: r.photoUrl!, name: `Foto_${r.fullName}` })}
                              className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 block group/img relative"
                            >
                              <img src={r.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                <Image size={12} className="text-white" />
                              </div>
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                              <Image size={16} />
                            </div>
                          )}
                          {r.familyCardUrl ? (
                            <button 
                              onClick={() => setSelectedFile({ url: r.familyCardUrl!, name: `KK_${r.fullName}` })}
                              className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-all text-slate-400 hover:text-emerald-600 relative group/kk"
                            >
                              <FileText size={18} />
                              <div className="absolute inset-0 bg-emerald-600/10 opacity-0 group-hover/kk:opacity-100 flex items-center justify-center transition-all">
                                <ExternalLink size={10} />
                              </div>
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                              <FileText size={16} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={cn(
                            "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border shadow-sm",
                            r.status === 'Verified' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : 
                            r.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-100" : "bg-amber-50 text-amber-700 border-amber-100"
                          )}>
                            {r.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleUpdateStatus(r.id, 'Verified')} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Verifikasi"><CheckCircle size={18}/></button>
                          <button onClick={() => handleUpdateStatus(r.id, 'Rejected')} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Tolak"><XCircle size={18}/></button>
                          <button onClick={() => handleDelete(r.id)} className="p-2 text-slate-300 hover:bg-red-600 hover:text-white rounded-lg transition-all" title="Hapus"><Trash2 size={18}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && filteredRegistrants.length === 0 && (
              <div className="p-20 text-center text-slate-300 font-bold uppercase tracking-[0.2em] text-xs">
                Data Tidak Ditemukan
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'pengaturan' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <Settings className="text-emerald-600" />
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Kustomisasi Aplikasi</h3>
            </div>
            
            <div className="p-8 space-y-10">
              {/* Logo & Header Background */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Logo Sekolah */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Logo Sekolah</label>
                  <div className="flex items-start gap-6">
                    <div className="w-32 h-32 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
                      {logoUrl ? (
                        <>
                          <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <button onClick={() => setLogoUrl('')} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600">
                              <X size={14} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Image className="text-slate-300" size={24} />
                          <span className="text-[10px] font-bold text-slate-400">LOGO</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-grow space-y-3">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoChange}
                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" 
                      />
                      <p className="text-[10px] text-slate-400 leading-relaxed italic">Gunakan file PNG transparan untuk hasil terbaik (Rasio 1:1).</p>
                    </div>
                  </div>
                </div>

                {/* Header Background */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Latar Belakang Header (Hero Section)</label>
                  <div className="space-y-3">
                    <div className="h-32 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group">
                      {headerBg ? (
                        <>
                          <img src={headerBg} alt="Header Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <button onClick={() => setHeaderBg('')} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600">
                              <X size={14} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <Image className="text-slate-300" size={24} />
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleHeaderBgChange}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Facilities */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Daftar Fasilitas Utama</label>
                  <div className="space-y-2">
                    {facilities.map((item, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          value={item} 
                          onChange={(e) => {
                            const newItems = [...facilities];
                            newItems[idx] = e.target.value;
                            setFacilities(newItems);
                          }}
                          className="flex-grow px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                        />
                        <button onClick={() => setFacilities(facilities.filter((_, i) => i !== idx))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => setFacilities([...facilities, ''])}
                      className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> TAMBAH FASILITAS
                    </button>
                  </div>
                </div>

                {/* Extracurriculars */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Ekstrakurikuler Unggulan</label>
                  <div className="space-y-2">
                    {extracurriculars.map((item, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          value={item} 
                          onChange={(e) => {
                            const newItems = [...extracurriculars];
                            newItems[idx] = e.target.value;
                            setExtracurriculars(newItems);
                          }}
                          className="flex-grow px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                        />
                        <button onClick={() => setExtracurriculars(extracurriculars.filter((_, i) => i !== idx))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => setExtracurriculars([...extracurriculars, ''])}
                      className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-all text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> TAMBAH EKSTRA
                    </button>
                  </div>
                </div>
              </div>

              {/* Layanan Pengaduan */}
              <div className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="text-emerald-600" size={20} />
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Informasi Dasar</h4>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tahun Ajaran</label>
                  <input 
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="Contoh: 2024 / 2025"
                    className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>
              
              <div className="bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <Phone className="text-emerald-600" size={20} />
                  <h4 className="text-sm font-black text-emerald-800 uppercase tracking-widest">Layanan Pengaduan</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nomor Telepon/WA</label>
                    <input 
                      type="text"
                      value={complaintPhone}
                      onChange={(e) => setComplaintPhone(e.target.value)}
                      placeholder="Contoh: 0812-3456-7890"
                      className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama/Instansi Pengaduan</label>
                    <input 
                      type="text"
                      value={complaintName}
                      onChange={(e) => setComplaintName(e.target.value)}
                      placeholder="Contoh: Panitia Pendaftaran (Pkt. Irham)"
                      className="w-full px-6 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className={cn(
                    "bg-emerald-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 flex items-center gap-3",
                    savingSettings && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {savingSettings ? "MENYIMPAN..." : (
                    <>
                      <CheckCircle size={20} /> SIMPAN SEMUA PERUBAHAN
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'admin' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <ShieldCheck className="text-emerald-600" />
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Manajemen Akses Dashboard</h3>
            </div>
            
            <div className="p-8">
              <div className="mb-10 bg-amber-50 p-6 rounded-2xl border border-amber-100 text-sm text-amber-800">
                <p className="font-bold mb-2">Cara Menambah Panitia:</p>
                <p>Cukup masukkan alamat email Google panitia di bawah. Mereka nantinya bisa masuk ke Dashboard ini menggunakan akun Google mereka sendiri tanpa perlu password tambahan dari Anda.</p>
              </div>

              <form onSubmit={handleAddAdmin} className="flex gap-4 mb-10">
                <div className="flex-grow">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Google Panitia</label>
                  <input 
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="nama@gmail.com"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  className="mt-5 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                  <UserPlus size={20} /> DAFTARKAN EMAIL
                </button>
              </form>

              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Daftar Panitia Berizin</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    const uniqueAdmins = Array.from(
                      adminList.reduce((map, obj: AdminUser) => {
                        if (!map.has(obj.email)) {
                          map.set(obj.email, obj);
                        }
                        return map;
                      }, new Map<string, AdminUser>()).values()
                    );
                    
                    return uniqueAdmins.map((admin: AdminUser) => (
                      <div key={admin.id} className="bg-white p-6 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm group hover:border-emerald-200 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                            {admin.email?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{admin.email}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{admin.role}</p>
                          </div>
                        </div>
                        {admin.email !== 'ppdbaplikasi212@gmail.com' && (
                          <button 
                            onClick={() => removeAdmin(admin.id, admin.email)}
                            className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 flex items-center justify-center shrink-0"
                            title="Hapus Panitia"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      <AnimatePresence>
        {selectedFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFile(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-4xl max-h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">{selectedFile.name}</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => downloadFile(selectedFile.url, `${selectedFile.name}.jpg`)}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                  >
                    <Download size={14} /> UNDUH FILE
                  </button>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all"
                  >
                    TUTUP
                  </button>
                </div>
              </div>
              <div className="flex-grow overflow-auto p-4 md:p-10 flex items-center justify-center bg-slate-100">
                <img src={selectedFile.url} alt="Preview" className="max-w-full h-auto shadow-lg rounded-lg" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
