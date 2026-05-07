import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Link2, Check } from "lucide-react";

interface ProspectQRDialogProps {
  open: boolean;
  onClose: () => void;
  prospectName: string;
  prospectOrg?: string;
  qrValue: string;
  copyState: "idle" | "copied" | "failed";
  onCopy: () => void;
}

export default function ProspectQRDialog({
  open,
  onClose,
  prospectName,
  prospectOrg,
  qrValue,
  copyState,
  onCopy,
}: ProspectQRDialogProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const downloadQR = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const slug = (prospectName || "prospect")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const filename = slug ? `sado-${slug}-demo-qr.png` : "sado-prospect-demo-qr.png";
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-[oklch(0.14_0.03_255)] border border-slate-700 rounded-2xl p-6 shadow-2xl w-72"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Prospect header */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-blue-300 uppercase tracking-wide">
            Prospect Link
          </div>
          <div className="text-sm font-bold text-white mt-0.5">{prospectName}</div>
          {prospectOrg && prospectOrg !== prospectName && (
            <div className="text-xs text-slate-400">{prospectOrg}</div>
          )}
        </div>

        {/* QR code */}
        <div className="flex justify-center p-3 bg-white rounded-xl mb-4">
          <QRCodeCanvas ref={qrCanvasRef} value={qrValue} size={192} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-600 text-xs text-slate-300 hover:border-blue-500 hover:text-blue-300 transition-colors"
          >
            {copyState === "copied" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5" />
                <span>Copy link</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={downloadQR}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-600 text-xs text-slate-300 hover:border-emerald-500 hover:text-emerald-300 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
}
