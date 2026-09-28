import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, CheckCircle2, AlertCircle, Sparkles, User, Building, QrCode } from "lucide-react";
import toast from "react-hot-toast";
import { triggerHaptic } from "../lib/haptics";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorker?: (worker: any) => void;
}

export default function QRScannerModal({ isOpen, onClose, onSelectWorker }: QRScannerModalProps) {
  const [manualCode, setManualCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedEntity, setVerifiedEntity] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader-container";

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setVerifiedEntity(null);
      setErrorMsg(null);
      return;
    }

    let isMounted = true;

    async function startScanner() {
      try {
        const html5Qrcode = new Html5Qrcode(containerId);
        scannerRef.current = html5Qrcode;

        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const cameraId = cameras[cameras.length - 1].id; // Prefer back camera
          await html5Qrcode.start(
            cameraId,
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText) => {
              if (isMounted) {
                handleVerifyPayload(decodedText);
              }
            },
            () => {} // Ignore scan frame errors
          );
          if (isMounted) setCameraActive(true);
        }
      } catch (err: any) {
        if (isMounted) {
          setCameraActive(false);
          console.warn("Camera access unavailable or declined:", err);
        }
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {}
    }
  };

  const handleVerifyPayload = async (payload: string) => {
    if (!payload || isVerifying) return;
    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/qr/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrData: payload }),
      });
      const data = await res.json();

      if (res.ok && data.verified) {
        stopScanner();
        setVerifiedEntity(data);
        triggerHaptic([30, 50, 30]);
        toast.success(`Verified: ${data.entity.name}`);
      } else {
        setErrorMsg(data.error || "Unrecognized QR code");
        toast.error("Invalid QR Code payload");
      }
    } catch (err: any) {
      setErrorMsg("Network error verifying QR code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleVerifyPayload(manualCode.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 font-['Outfit',sans-serif]">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="w-6 h-6 text-amber-400" />
            <h3 className="font-bold text-lg">Scan Business QR</h3>
          </div>
          <button
            onClick={() => { stopScanner(); onClose(); }}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!verifiedEntity ? (
            <>
              {/* Scanner View Box */}
              <div className="relative bg-slate-900 rounded-2xl overflow-hidden min-h-[260px] flex items-center justify-center border-2 border-dashed border-indigo-300/40">
                <div id={containerId} className="w-full h-full text-white" />

                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300 bg-slate-900/90">
                    <Camera className="w-12 h-12 mb-3 text-indigo-400 animate-pulse" />
                    <p className="font-semibold text-sm">Camera Stream Loading or Off</p>
                    <p className="text-xs text-slate-400 mt-1">Point your camera at a worker or business QR code, or use manual entry below.</p>
                  </div>
                )}

                {/* Animated Scanner Reticle Overlay */}
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-indigo-400/80 rounded-2xl relative">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-bounce" />
                    </div>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 shrink-0 text-rose-500" />
                  {errorMsg}
                </div>
              )}

              {/* Manual Code Input Fallback */}
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Or enter QR code payload manually
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. worker_1 or biz_1"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isVerifying || !manualCode.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isVerifying ? "Verifying..." : "Verify"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Verified Entity Result View */
            <div className="text-center space-y-4 py-2 animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>

              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 mb-2">
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                  Verified FeeTrust {verifiedEntity.type === "worker" ? "Worker" : "Business"}
                </span>
                <h4 className="text-2xl font-black text-slate-900">{verifiedEntity.entity.name}</h4>
                <p className="text-slate-500 text-sm font-medium mt-0.5">
                  {verifiedEntity.type === "worker"
                    ? `${verifiedEntity.entity.position} • ${verifiedEntity.entity.workplace}`
                    : `${verifiedEntity.entity.category} • ${verifiedEntity.entity.address}`}
                </p>
              </div>

              {verifiedEntity.type === "worker" && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex justify-around text-center">
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Level</div>
                    <div className="text-lg font-black text-indigo-600">Lvl {verifiedEntity.entity.level}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Role</div>
                    <div className="text-lg font-black text-slate-800">{verifiedEntity.entity.role}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Status</div>
                    <div className="text-lg font-black text-emerald-600">Available</div>
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setVerifiedEntity(null);
                    setManualCode("");
                  }}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Scan Another
                </button>
                {verifiedEntity.type === "worker" && onSelectWorker && (
                  <button
                    onClick={() => {
                      onSelectWorker(verifiedEntity.entity);
                      stopScanner();
                      onClose();
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md hover:opacity-95 transition-all"
                  >
                    Give Merit
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
