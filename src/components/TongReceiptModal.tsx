import React, { useState } from 'react';
import { assignTongTitle, BiscuitId, BISCUIT_SPECS } from '../game/rules';
import { tongAudio } from '../game/audio';

export interface RunSummary {
  score: number;
  bestScore: number;
  survivedCount: number;
  brokenCount: number;
  maxCombo: number;
  teaRemaining: number;
  friendName: string;
  lastBiscuitId: BiscuitId;
  reason: 'sludge_full' | 'tea_finished';
}

interface TongReceiptModalProps {
  summary: RunSummary;
  onPlayAgain: () => void;
  onBackToTitle: () => void;
}

export const TongReceiptModal: React.FC<TongReceiptModalProps> = ({
  summary,
  onPlayAgain,
  onBackToTitle,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const playerName = summary.friendName.trim() || 'অজ্ঞাত চা-প্রেমী (You)';
  const rank = assignTongTitle(
    summary.score,
    summary.survivedCount,
    summary.brokenCount,
    summary.friendName
  );
  const spec = BISCUIT_SPECS[summary.lastBiscuitId];
  const isVictory = summary.reason === 'tea_finished';

  // Itemized humorous Tong bill in Taka (৳)
  const teaBill = 15;
  const biscuitBill = (summary.survivedCount + summary.brokenCount) * 5;
  const sludgePenalty = summary.brokenCount * 20;
  const totalTaka = teaBill + biscuitBill + sludgePenalty;

  const generateShareText = () => {
    return [
      `📜 মেসার্স মায়ের দোয়া টং ঘর — শোকবার্তা ও ক্যাশ মেমো 📜`,
      `নাম: ${playerName}`,
      `উপাধি: ${rank.titleBn} (${rank.titleEn})`,
      `স্কোর: ${summary.score} পয়েন্ট (সর্বোচ্চ স্ট্রিক: ${summary.maxCombo}x)`,
      `অক্ষত বিস্কুট: ${summary.survivedCount} টি | চায়ে ডুবে শহীদ বিস্কুট: ${summary.brokenCount} টি 😭`,
      `মোট টং বিল (জরিমানাসহ): ৳${totalTaka}`,
      `মন্তব্য: "${rank.roastBn}"`,
      `#ChaBiscuitSimulator #TongErDokan`,
    ].join('\n');
  };

  const handleCopyReceipt = async () => {
    tongAudio.playUiClick();
    try {
      await navigator.clipboard.writeText(generateShareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleDownloadReceiptImage = () => {
    tongAudio.playUiClick();
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Aged thermal paper background
    ctx.fillStyle = '#f7eedc';
    ctx.fillRect(0, 0, 720, 920);

    // Decorative border frame
    ctx.strokeStyle = '#3b2313';
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, 664, 864);
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, 640, 840);
    ctx.setLineDash([]);

    // Header
    ctx.fillStyle = '#2b1608';
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px "Hind Siliguri", sans-serif';
    ctx.fillText('মেসার্স মায়ের দোয়া স্পেশাল টং ঘর', 360, 95);

    ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#6e4726';
    ctx.fillText(
      isVictory ? '★ বিজয় সনদ ও ক্যাশ মেমো ★' : '⚰️ বিস্কুট শোকবার্তা ও টং রশিদ ⚰️',
      360,
      132
    );

    // Divider
    ctx.strokeStyle = '#8c6239';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(65, 155);
    ctx.lineTo(655, 155);
    ctx.stroke();

    // Player & Rank
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2b1608';
    ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
    ctx.fillText(`ডুবুরির নাম: ${playerName}`, 70, 200);
    ctx.fillStyle = '#b45309';
    ctx.fillText(`অর্জিত উপাধি: ${rank.titleBn}`, 70, 240);
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#5c3a1d';
    ctx.fillText(`RANK: ${rank.titleEn} [${rank.badgeCode}]`, 70, 272);

    // Stats Box
    ctx.fillStyle = '#ede0c8';
    ctx.fillRect(65, 300, 590, 190);
    ctx.strokeStyle = '#bca37f';
    ctx.strokeRect(65, 300, 590, 190);

    ctx.fillStyle = '#2b1608';
    ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
    ctx.fillText(`মোট স্কোর (Total Score): ${summary.score}`, 90, 345);
    ctx.fillText(`বেঁচে ফেরা বিস্কুট (Survived): ${summary.survivedCount} টি`, 90, 385);
    ctx.fillStyle = '#b91c1c';
    ctx.fillText(`চায়ে ডুবে শহীদ বিস্কুট (Martyred): ${summary.brokenCount} টি`, 90, 425);
    ctx.fillStyle = '#4a2c11';
    ctx.fillText(
      `সর্বোচ্চ কম্বো: ${summary.maxCombo}x   |   বাকি চা: ${Math.round(summary.teaRemaining)}%`,
      90,
      465
    );

    // Itemized Bill
    ctx.fillStyle = '#2b1608';
    ctx.font = 'bold 20px "Hind Siliguri", sans-serif';
    ctx.fillText('টংয়ের হিসাব বিবরণী (Itemized Bill):', 70, 540);

    ctx.font = '18px "Hind Siliguri", sans-serif';
    const items = [
      ['১ কাপ মালাই দুধ চা', `৳${teaBill}`],
      [`${spec.nameBn} (${summary.survivedCount + summary.brokenCount} টি)`, `৳${biscuitBill}`],
      ['চায়ের তলানি পরিষ্কার জরিমানা', `৳${sludgePenalty}`],
    ];
    items.forEach(([label, price], idx) => {
      const y = 580 + idx * 36;
      ctx.textAlign = 'left';
      ctx.fillText(label, 80, y);
      ctx.textAlign = 'right';
      ctx.fillText(price, 640, y);
    });

    ctx.strokeStyle = '#2b1608';
    ctx.beginPath();
    ctx.moveTo(70, 675);
    ctx.lineTo(650, 675);
    ctx.stroke();

    ctx.font = 'bold 24px "Hind Siliguri", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('সর্বমোট বিল (বাকি চলবে না):', 80, 712);
    ctx.textAlign = 'right';
    ctx.fillText(`৳${totalTaka}`, 640, 712);

    // Roast Quote
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7c2d12';
    ctx.font = 'bold 18px "Hind Siliguri", sans-serif';
    ctx.fillText(`"${rank.roastBn}"`, 360, 785, 560);

    ctx.fillStyle = '#6e4726';
    ctx.font = '14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('চায়ে বিস্কুট ডুবানো সিমুলেটর · Cha-Biscuit Dipping Simulator', 360, 845);

    const link = document.createElement('a');
    link.download = `tong-receipt-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2400);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(14, 8, 4, 0.84)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tong-receipt-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border-2 border-[#5c3d22] bg-[#f7eedc] text-[#281508] shadow-2xl overflow-hidden">
        {/* Top Perforated Receipt Edge */}
        <div className="bg-[#2a170b] px-6 py-4 text-[#fdf6ec] flex items-center justify-between border-b-2 border-dashed border-[#8a5d36]">
          <div>
            <p className="text-xs font-mono-num tracking-wider text-amber-300">
              {isVictory ? 'TONG VICTORY RECEIPT' : 'OBITUARY & TONG RECEIPT · শোকবার্তা'}
            </p>
            <h2 id="tong-receipt-title" className="text-xl sm:text-2xl font-bold mt-0.5">
              {isVictory
                ? 'সব চা শেষ! অমৃত জয়! 🏆'
                : 'চায়ের কাপ বিস্কুটের কাদায় ভরে গেছে! 😭'}
            </h2>
          </div>
          <div className="text-right font-mono-num">
            <span className="text-xs text-amber-200/80 block">বিল নং</span>
            <span className="text-sm font-bold text-amber-400">#{rank.badgeCode}</span>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Player & Assigned Title Box */}
          <div className="rounded-xl bg-[#ede0c8] border border-[#cbb48c] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-[#6e4726]">
                ডুবুরি / চ্যালেঞ্জার (Player)
              </span>
              <span className="text-base font-bold text-[#231105]">{playerName}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#d5c09b]">
              <span className="text-xs font-semibold text-[#6e4726] block">
                অর্জিত উপাধি (Assigned Tong Title)
              </span>
              <p className="text-lg sm:text-xl font-bold text-[#9a3412] mt-0.5">
                {rank.titleBn}
              </p>
              <p className="text-xs font-mono-num text-[#6e4726]">{rank.titleEn}</p>
            </div>
            <p className="mt-2.5 text-sm font-medium text-[#4a260c] bg-[#f7eedc] px-3 py-2 rounded-lg border border-[#dec9a4]">
              “{rank.roastBn}”
            </p>
          </div>

          {/* 3 Tabular Stat Tiles */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-xl bg-[#efe3cd] border border-[#d5c09b] p-3">
              <span className="text-xs text-[#6e4726] block">মোট স্কোর</span>
              <span className="text-2xl font-bold font-mono-num text-[#231105]">
                {summary.score}
              </span>
              <span className="text-[11px] font-mono-num text-[#7c532f] block">
                সেরা: {summary.bestScore}
              </span>
            </div>

            <div className="rounded-xl bg-[#efe3cd] border border-[#d5c09b] p-3">
              <span className="text-xs text-[#6e4726] block">অক্ষত বিস্কুট</span>
              <span className="text-2xl font-bold font-mono-num text-emerald-800">
                {summary.survivedCount} টি
              </span>
              <span className="text-[11px] font-mono-num text-[#7c532f] block">
                স্ট্রিক: {summary.maxCombo}x
              </span>
            </div>

            <div className="rounded-xl bg-[#fae2dd] border border-[#e3a89c] p-3">
              <span className="text-xs text-[#991b1b] font-semibold block">
                শহীদ বিস্কুট
              </span>
              <span className="text-2xl font-bold font-mono-num text-[#b91c1c]">
                {summary.brokenCount} টি
              </span>
              <span className="text-[11px] text-[#991b1b] block">চায়ের তলানিতে</span>
            </div>
          </div>

          {/* Itemized Tong Bill */}
          <div className="border-t border-b border-dashed border-[#8a5d36] py-3 text-sm space-y-1.5">
            <div className="flex justify-between text-[#4a2c11]">
              <span>১ কাপ স্পেশাল মালাই দুধ চা</span>
              <span className="font-mono-num font-semibold">৳{teaBill}</span>
            </div>
            <div className="flex justify-between text-[#4a2c11]">
              <span>
                {spec.nameBn} ({summary.survivedCount + summary.brokenCount} টি)
              </span>
              <span className="font-mono-num font-semibold">৳{biscuitBill}</span>
            </div>
            <div className="flex justify-between text-[#991b1b]">
              <span>কাপে ডুবে যাওয়া বিস্কুটের কাদা পরিষ্কার ফি</span>
              <span className="font-mono-num font-semibold">৳{sludgePenalty}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#cbb48c] text-base font-bold text-[#231105]">
              <span>মোট টং বিল (নগদ পরিশোধযোগ্য)</span>
              <span className="font-mono-num text-[#9a3412]">৳{totalTaka}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="flex-1 py-2.5 px-4 rounded-xl border border-[#8a5d36] bg-[#ede0c8] hover:bg-[#e3d0ae] text-[#281508] font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              {copied ? '✓ শোকবার্তা কপি হয়েছে!' : '📋 শোকবার্তা কপি করুন'}
            </button>
            <button
              type="button"
              onClick={handleDownloadReceiptImage}
              className="flex-1 py-2.5 px-4 rounded-xl border border-[#8a5d36] bg-[#ede0c8] hover:bg-[#e3d0ae] text-[#281508] font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              {downloaded ? '✓ রশিদ ডাউনলোড হয়েছে!' : '⬇ টং রশিদ (PNG)'}
            </button>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={() => {
                tongAudio.playUiClick();
                onPlayAgain();
              }}
              className="flex-1 py-3 px-5 rounded-xl bg-[#b45309] hover:bg-[#9a3412] text-white font-bold text-base shadow-md transition-colors cursor-pointer whitespace-nowrap"
            >
              আবার চায়ে ডুব দিন (Play Again)
            </button>
            <button
              type="button"
              onClick={() => {
                tongAudio.playUiClick();
                onBackToTitle();
              }}
              className="py-3 px-4 rounded-xl border border-[#8a5d36] bg-transparent hover:bg-[#ede0c8] text-[#4a2c11] font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              শুরুতে যান
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
