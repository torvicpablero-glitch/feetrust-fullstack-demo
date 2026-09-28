import React, { useState } from 'react';
import { WorkerProfile, useStore } from '../lib/store';
import { QrCode, X, Copy, Printer, Award, ShieldCheck, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  worker: WorkerProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkerQRModal({ worker, isOpen, onClose }: Props) {
  const { appState } = useStore();
  const [showPrintModal, setShowPrintModal] = useState(false);

  if (!isOpen || !worker) return null;

  const meritLink = `${window.location.origin}/vault/${worker.id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(meritLink)}`;

  const copyLink = () => {
    navigator.clipboard.writeText(meritLink);
    toast.success(`Copied Digital Vault link for ${worker.name}!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-md flex items-center justify-center p-4 font-['Outfit',sans-serif]">
      <div className="bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-white/20 p-6 rounded-3xl max-w-md w-full shadow-2xl relative animate-in zoom-in duration-300 crystal-card">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2 cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        {/* Worker Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 font-extrabold text-2xl shadow-md overflow-hidden font-mono shrink-0">
            {worker.avatar ? (
              <img src={worker.avatar} alt={worker.name} className="w-full h-full object-cover" />
            ) : (
              worker.initials || 'FT'
            )}
          </div>
          <div className="flex items-center justify-center space-x-1.5 mb-1">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">{worker.name}</h3>
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-extrabold uppercase tracking-wider">Verified Merit & Digital Vault</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">{worker.position}</p>
          {worker.workplace && <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{worker.workplace}</p>}
        </div>

        {/* QR Code Container */}
        <div className="text-center space-y-4 animate-in fade-in">
          <div className="bg-white p-4 rounded-3xl inline-block shadow-md border-4 border-indigo-100 dark:border-indigo-900 relative">
            <img 
              src={qrCodeUrl} 
              alt={`${worker.name}'s Personal Vault QR Code`}
              className="w-52 h-52 mx-auto rounded-xl"
            />
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-200 font-medium max-w-xs mx-auto leading-relaxed">
            Scan this QR code to access <span className="text-indigo-600 dark:text-indigo-400 font-bold">{worker.name}</span>'s verified Digital Vault and give instant merit recognition!
          </p>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={copyLink}
              className="flex-1 py-3 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center text-xs transition-colors cursor-pointer font-mono"
            >
              <Copy className="w-4 h-4 mr-1.5 text-indigo-600" /> COPY LINK
            </button>

            <button
              onClick={() => {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Feetrust Merit Badge - ${worker.name}</title>
                        <style>
                          body { font-family: sans-serif; text-align: center; padding: 40px; background: #fff; }
                          .badge { border: 2px solid #3b82f6; border-radius: 20px; padding: 30px; max-w: 320px; margin: auto; }
                          h1 { color: #1e40af; margin-bottom: 4px; font-size: 24px; }
                          p { color: #64748b; font-size: 14px; margin-top: 0; }
                          img { width: 220px; height: 220px; }
                          .footer { margin-top: 15px; font-size: 12px; color: #94a3b8; font-weight: bold; }
                        </style>
                      </head>
                      <body>
                        <div class="badge">
                          <h1>${worker.name}</h1>
                          <p>${worker.position} • ${worker.workplace || 'Feetrust'}</p>
                          <img src="${qrCodeUrl}" />
                          <div class="footer">Scan to Give Recognition on FeeTrust</div>
                        </div>
                        <script>window.print();</script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }
              }}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-xl flex items-center justify-center text-xs shadow-md hover:opacity-95 transition-opacity cursor-pointer font-mono"
            >
              <Printer className="w-4 h-4 mr-1.5" /> PRINT BADGE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
