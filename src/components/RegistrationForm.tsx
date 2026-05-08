import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, auth } from '../lib/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { safeAddDoc } from '../lib/firestore-utils';
import { useState } from 'react';
import { motion } from 'motion/react';
import { User, Phone, MapPin, School, Calendar, CheckCircle2, ChevronLeft, Download, Image, FileText, Ticket } from 'lucide-react';
import Barcode from 'react-barcode';
import { cn } from '../lib/utils';
import { jsPDF } from 'jspdf';

const schema = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter'),
  nisn: z.string().length(10, 'NISN harus 10 digit'),
  originSchool: z.string().min(3, 'Nama sekolah asal minimal 3 karakter'),
  birthPlace: z.string().min(2, 'Tempat lahir minimal 2 karakter'),
  birthDate: z.string().min(1, 'Tanggal lahir harus diisi'),
  gender: z.enum(['Laki-laki', 'Perempuan']),
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit'),
  address: z.string().min(10, 'Alamat lengkap minimal 10 karakter'),
  fatherName: z.string().min(3, 'Nama ayah minimal 3 karakter'),
  motherName: z.string().min(3, 'Nama ibu minimal 3 karakter'),
  photo: z.any().refine((files) => files?.length > 0, "Pasfoto wajib diupload"),
  familyCard: z.any().refine((files) => files?.length > 0, "Kartu Keluarga wajib diupload"),
});

type FormData = z.infer<typeof schema> & {
  photoUrl?: string;
  familyCardUrl?: string;
};

// Utility to compress and convert image to Base64
const processImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // High compression to save space
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export default function RegistrationForm({ onComplete, logoUrl, academicYear }: { onComplete: () => void, logoUrl?: string, academicYear?: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState<FormData & { id?: string }>({} as any);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      gender: 'Laki-laki',
    }
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Process images to Base64 with compression
      // Keep sizes reasonable for Firestore (1MB limit per document)
      const photoUrl = await processImage(data.photo[0], 300, 400);
      const familyCardUrl = await processImage(data.familyCard[0], 600, 800);

      const { photo, familyCard, ...firestoreData } = data as any;

      const registrantsRef = collection(db, 'registrants');
      const docRef = await safeAddDoc(registrantsRef, {
        ...firestoreData,
        photoUrl,
        familyCardUrl,
        status: 'Pending',
        userId: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
      });
      
      const newId = docRef?.id || 'PENDING-' + Math.random().toString(36).substr(2, 9).toUpperCase();

      setSubmittedData({ ...data, photoUrl, familyCardUrl, id: newId });
      setIsSuccess(true);
    } catch (err) {
      console.error('Submission error:', err);
      setError('Terjadi kesalahan saat mengirim data. Pastikan file yang diunggah adalah gambar yang valid dan ukuran total tidak terlalu besar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = () => {
    if (!submittedData) return;

    const doc = new jsPDF();
    const primaryColor = [16, 185, 129]; // emerald-500
    
    // Header
    doc.setFillColor(16, 24, 40); // dark blue/gray
    doc.rect(0, 0, 210, 40, 'F');
    
    // Add Logo to PDF if exists
    if (logoUrl) {
      try {
        doc.addImage(logoUrl, 'PNG', 10, 5, 30, 30);
      } catch (e) {
        console.error('PDF Logo error:', e);
      }
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('BUKTI PENDAFTARAN PPDB', 115, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`TAHUN PELAJARAN ${academicYear || '2026/2027'}`, 115, 30, { align: 'center' });
    
    // Body
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('NOMOR PENDAFTARAN:', 105, 50, { align: 'center' });
    doc.setFontSize(24);
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(`${submittedData.id}`, 105, 62, { align: 'center' });
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    const startY = 85;
    const lineHeight = 10;
    
    doc.setFont('helvetica', 'bold');
    doc.text('DATA CALON SISWA:', 20, startY - 5);
    doc.line(20, startY - 3, 190, startY - 3);
    
    const details = [
      ['Nama Lengkap', submittedData.fullName],
      ['NISN', submittedData.nisn],
      ['Jenis Kelamin', submittedData.gender],
      ['Tempat, Tgl Lahir', `${submittedData.birthPlace}, ${submittedData.birthDate}`],
      ['Asal Sekolah', submittedData.originSchool],
      ['Nama Ayah', submittedData.fatherName],
      ['Nama Ibu', submittedData.motherName],
      ['No. HP/WA', submittedData.phone],
      ['Alamat', submittedData.address],
    ];
    
    details.forEach((item, index) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${item[0]}`, 20, startY + (index * lineHeight));
      doc.setFont('helvetica', 'normal');
      doc.text(`: ${item[1]}`, 70, startY + (index * lineHeight));
    });
    
    // Footer / Verification info
    const footerY = startY + (details.length * lineHeight) + 20;
    doc.setFillColor(248, 250, 252);
    doc.rect(20, footerY, 170, 40, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(20, footerY, 170, 40, 'S');
    
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.text('Catatan Penting:', 25, footerY + 10);
    doc.text('1. Simpan bukti pendaftaran ini sebagai syarat mengikuti seleksi.', 25, footerY + 18);
    doc.text('2. Panitia akan menghubungi Anda melalui nomor WhatsApp untuk verifikasi.', 25, footerY + 26);
    doc.text('3. Pastikan data yang diinput benar dan dapat dipertanggungjawabkan.', 25, footerY + 34);
    
    // QR Code placeholder or Signature
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text('Bombana, ' + new Date().toLocaleDateString('id-ID'), 140, footerY + 60);
    doc.text('Panitia PPDB', 140, footerY + 80, { align: 'center' });
    
    doc.save(`PPDB_MTsN3Bombana_${submittedData.nisn}.pdf`);
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-[2.5rem] shadow-2xl p-6 md:p-12 text-center border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 pointer-events-none opacity-50" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-50 rounded-full -ml-32 -mb-32 pointer-events-none opacity-50" />
        
        <div className="bg-emerald-600 -mx-6 md:-mx-12 -mt-6 md:-mt-12 mb-8 p-10 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Ticket size={100} />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30"
          >
            <CheckCircle2 size={32} className="text-white" />
          </motion.div>
          <h2 className="text-2xl font-black tracking-tight mb-1">BERHASIL TERDAFTAR!</h2>
          <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">TAHUN AJARAN {academicYear || '2024/2025'}</p>
          <div className="w-12 h-1 bg-emerald-400 mx-auto rounded-full opacity-50" />
        </div>
        
        <div className="space-y-6 relative z-10">
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Validasi Barcode Digital</p>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <Barcode 
                value={submittedData?.id || 'PENDING'} 
                width={1.2} 
                height={50} 
                fontSize={10}
                background="transparent"
              />
            </div>
            <p className="mt-3 text-xs font-black text-emerald-700 tracking-widest">ID: {submittedData?.id}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left px-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Calon Siswa</label>
              <p className="font-bold text-slate-800 uppercase text-sm border-l-4 border-emerald-500 pl-3">{submittedData?.fullName}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">NISN</label>
              <p className="font-bold text-slate-800 text-sm border-l-4 border-amber-500 pl-3">{submittedData?.nisn}</p>
            </div>
          </div>

          <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex gap-4 text-left">
            <div className="text-amber-500 shrink-0"><Calendar size={20} /></div>
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              Simpan bukti pendaftaran ini (Unduh PDF). Bawa bukti ini saat verifikasi berkas luring di Panitia Madrasah.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <button 
              onClick={generatePDF}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg"
            >
              <Download size={18} /> UNDUH BUKTI
            </button>
            <button 
              onClick={onComplete}
              className="flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
            >
              KE HALAMAN UTAMA
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col p-4 md:p-10 h-full max-w-2xl mx-auto">
      <div className="mb-8 border-b border-slate-100 pb-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <div className="w-12 h-12 bg-slate-50 rounded-xl p-2 border border-slate-100 overflow-hidden">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            )}
            <h3 className="text-2xl font-extrabold text-emerald-900 uppercase">Formulir Pendaftaran</h3>
          </div>
          <button onClick={onComplete} className="text-slate-400 hover:text-emerald-600 transition-colors pt-2"><ChevronLeft size={24}/></button>
        </div>
        <p className="text-sm text-slate-500">Lengkapi data calon siswa di bawah ini dengan informasi valid.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 flex-grow">
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
            <div className="w-4 h-[1px] bg-emerald-600" /> Identitas Calon Siswa
          </h4>
          
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Lengkap (Sesuai Ijazah)</label>
            <div className="relative">
              <input 
                {...register('fullName')}
                placeholder="Contoh: Ahmad Fauzi" 
                className={cn("w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all", errors.fullName && "border-red-300")}
              />
              <User className="absolute left-3 top-3 text-slate-400" size={16} />
            </div>
            {errors.fullName && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.fullName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">NISN</label>
              <input 
                {...register('nisn')}
                placeholder="10 digit" 
                className={cn("w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm", errors.nisn && "border-red-300")}
              />
              {errors.nisn && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.nisn.message}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Jenis Kelamin</label>
              <select 
                {...register('gender')}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm appearance-none"
              >
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tempat Lahir</label>
              <input {...register('birthPlace')} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tanggal Lahir</label>
              <input type="date" {...register('birthDate')} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
            <div className="w-4 h-[1px] bg-amber-600" /> Kontak & Asal Sekolah
          </h4>
          
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Asal Sekolah (SD/MI)</label>
            <input 
              {...register('originSchool')}
              placeholder="Nama sekolah asal" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Ayah</label>
              <input {...register('fatherName')} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Ibu</label>
              <input {...register('motherName')} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">No. HP Aktif (Wajib WhatsApp)</label>
            <div className="relative">
              <input 
                {...register('phone')}
                placeholder="08xxxxxxxx" 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
              <Phone className="absolute left-3 top-3 text-slate-400" size={16} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div>
              <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-2 flex items-center gap-1">
                <Image size={12} /> Pasfoto 3x4 (JPG/PNG uk. dibawah 1 MB)
              </label>
              <input 
                type="file" 
                accept="image/*"
                {...register('photo')}
                className={cn("w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer", errors.photo && "text-red-500")}
              />
              {errors.photo && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.photo.message as string}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-amber-700 uppercase mb-2 flex items-center gap-1">
                <FileText size={12} /> Kartu Keluarga (JPG/foto uk. dibawah 1 MB)
              </label>
              <input 
                type="file" 
                accept=".pdf,image/*"
                {...register('familyCard')}
                className={cn("w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer", errors.familyCard && "text-red-500")}
              />
              {errors.familyCard && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.familyCard.message as string}</p>}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Alamat Lengkap</label>
            <textarea {...register('address')} rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"></textarea>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}

        <button 
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold mt-6 shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? 'MENGIRIM...' : 'SUBMIT PENDAFTARAN'}
        </button>
      </form>
    </div>
  );
}
