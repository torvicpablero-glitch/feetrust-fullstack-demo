import React, { useState } from 'react';
import { useStore, Review } from '../lib/store';
import { MessageSquare, Send, X, Sparkles, Heart, Star, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  review: Review | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ThankYouNoteModal({ review, isOpen, onClose }: Props) {
  const { appState, addThankYouNote } = useStore();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !review) return null;

  const quickTemplates = [
    "Thanks so much for coming in today! Glad you enjoyed your visit! ☕",
    "Appreciate the awesome merit recognition and support! ⭐",
    "You made my day! Thanks for being an amazing customer! 🙌",
    "Thank you! Looking forward to serving you again soon! 🏆",
  ];

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a thank you message!");
      return;
    }

    setSubmitting(true);
    try {
      await addThankYouNote(review.id, message.trim());
      toast.success(`Thank you note sent to ${review.fromUserName}!`, {
        icon: '💖',
        style: { background: '#1a103c', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }
      });
      setMessage('');
      onClose();
    } catch (err: any) {
      toast.error('Failed to send thank you note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 font-['Outfit',sans-serif]">
      <div className="bg-white border border-slate-200 p-6 rounded-3xl max-w-md w-full shadow-2xl relative animate-in zoom-in duration-300">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2">
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-rose-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 font-bold shadow-md">
            <Heart className="w-7 h-7 fill-white" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">Send Thank You Note</h3>
          <p className="text-xs text-slate-500 mt-1">
            Replying to <span className="text-indigo-600 font-bold">{review.fromUserName}</span>'s {review.meritType} Recognition
          </p>
        </div>

        {/* Customer Review Summary Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-5 text-left">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-indigo-600 flex items-center">
              <Star className="w-3.5 h-3.5 mr-1 text-amber-500 fill-amber-400" /> {review.meritType} Recognition
            </span>
            <span className="text-[10px] text-slate-400">Received</span>
          </div>
          {review.reviewText && (
            <p className="text-xs text-slate-600 italic font-medium">"{review.reviewText}"</p>
          )}
        </div>

        {/* Quick Template Chips */}
        <div className="mb-4 text-left">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 mr-1" /> Quick Templates
          </label>
          <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
            {quickTemplates.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setMessage(tmpl)}
                className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                  message === tmpl
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tmpl}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Message Input */}
        <div className="mb-6 text-left">
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Custom Thank You Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Write a personalized appreciation message..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors resize-none"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={submitting || !message.trim()}
          className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold rounded-2xl text-sm shadow-md hover:opacity-95 transition-opacity flex items-center justify-center cursor-pointer disabled:opacity-50"
        >
          <Send className="w-4 h-4 mr-2" /> Send Appreciation Note
        </button>
      </div>
    </div>
  );
}
