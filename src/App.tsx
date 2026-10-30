import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BiscuitId,
  BISCUIT_SPECS,
  DipEvaluation,
  MAX_SLUDGE_COUNT,
  getLiveCommentary,
} from './game/rules';
import { tongAudio } from './game/audio';
import { TongSceneCanvas, GamePhase } from './components/TongSceneCanvas';
import { TongReceiptModal, RunSummary } from './components/TongReceiptModal';

interface FloatingPopup {
  id: number;
  title: string;
  subtitle: string;
  outcome: DipEvaluation['outcome'];
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  const [biscuitId, setBiscuitId] = useState<BiscuitId>('cracker');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [teaPercent, setTeaPercent] = useState(100);
  const [sludgeCount, setSludgeCount] = useState(0);
  const [survivedCount, setSurvivedCount] = useState(0);
  const [friendName, setFriendName] = useState('রাকিব');
  const [isHoldingInput, setIsHoldingInput] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [liveCommentary, setLiveCommentary] = useState(() =>
    getLiveCommentary(false, 0, 'রাকিব', 0, 0)
  );
  const [floatingPopup, setFloatingPopup] = useState<FloatingPopup | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  // Direct DOM refs for 60Hz Soak Meter updates without React re-renders
  const soakBarFillRef = useRef<HTMLDivElement | null>(null);
  const soakGhostFillRef = useRef<HTMLDivElement | null>(null);
  const soakTextRef = useRef<HTMLSpanElement | null>(null);
  const soakZoneLabelRef = useRef<HTMLSpanElement | null>(null);
  const popupCounterRef = useRef(0);
  const gameoverTimerRef = useRef<number | null>(null);

  // Sync document.body.dataset.state with phase
  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const startNewGame = useCallback(() => {
    if (gameoverTimerRef.current) {
      clearTimeout(gameoverTimerRef.current);
      gameoverTimerRef.current = null;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTeaPercent(100);
    setSludgeCount(0);
    setSurvivedCount(0);
    setIsHoldingInput(false);
    setFloatingPopup(null);
    setRunSummary(null);
    setPhase('playing');
    setLiveCommentary(getLiveCommentary(false, 0, friendName, 0, 0));
  }, [friendName]);

  const handleToggleMute = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      if (e) e.currentTarget.blur();
      const next = !isMuted;
      setIsMuted(next);
      tongAudio.setMuted(next);
      if (!next) tongAudio.playUiClick();
    },
    [isMuted]
  );

  const handleTogglePause = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      if (e) e.currentTarget.blur();
      tongAudio.playUiClick();
      setIsHoldingInput(false);
      tongAudio.stopDippingSound();
      setPhase((prev) => {
        if (prev === 'playing') return 'paused';
        if (prev === 'paused') return 'playing';
        return prev;
      });
    },
    []
  );

  const handleSoakMilestoneChange = useCallback(
    (soakVal: number, isDipping: boolean) => {
      setLiveCommentary(
        getLiveCommentary(isDipping, soakVal, friendName, sludgeCount, combo)
      );
    },
    [friendName, sludgeCount, combo]
  );

  const handleDipEvaluated = useCallback(
    (result: DipEvaluation) => {
      setIsHoldingInput(false);

      const nextScore = score + result.pointsDelta;
      const nextBest = Math.max(bestScore, nextScore);
      const nextCombo = result.newCombo;
      const nextMaxCombo = Math.max(maxCombo, nextCombo);
      const nextTea = Math.max(0, teaPercent - result.teaConsumed);
      const nextSludge = sludgeCount + result.sludgeAdded;
      const nextSurvived =
        result.outcome === 'broken' ? survivedCount : survivedCount + 1;

      setScore(nextScore);
      setBestScore(nextBest);
      setCombo(nextCombo);
      setMaxCombo(nextMaxCombo);
      setTeaPercent(nextTea);
      setSludgeCount(nextSludge);
      setSurvivedCount(nextSurvived);

      popupCounterRef.current += 1;
      setFloatingPopup({
        id: popupCounterRef.current,
        title: result.bannerTextBn,
        subtitle: result.subTextBn,
        outcome: result.outcome,
      });

      setLiveCommentary(result.bannerTextBn);

      // Check Game Over conditions: 3 broken biscuits in cup OR all tea finished
      if (nextSludge >= MAX_SLUDGE_COUNT || nextTea <= 0) {
        const summarySnapshot: RunSummary = {
          score: nextScore,
          bestScore: nextBest,
          survivedCount: nextSurvived,
          brokenCount: nextSludge,
          maxCombo: nextMaxCombo,
          teaRemaining: nextTea,
          friendName,
          lastBiscuitId: biscuitId,
          reason: nextSludge >= MAX_SLUDGE_COUNT ? 'sludge_full' : 'tea_finished',
        };
        gameoverTimerRef.current = window.setTimeout(() => {
          setRunSummary(summarySnapshot);
          setPhase('gameover');
        }, 620);
      }
    },
    [
      score,
      bestScore,
      maxCombo,
      teaPercent,
      sludgeCount,
      survivedCount,
      friendName,
      biscuitId,
    ]
  );

  // Global keyboard & focus-loss listeners
  useEffect(() => {
    const isTypingInInput = () => {
      const el = document.activeElement;
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput()) {
        if (e.key === 'Escape' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      if (phase === 'title') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          tongAudio.playUiClick();
          startNewGame();
        }
        return;
      }

      if (phase === 'gameover') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          tongAudio.playUiClick();
          startNewGame();
        }
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        handleTogglePause();
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (e.code === 'KeyR') {
        e.preventDefault();
        tongAudio.playUiClick();
        startNewGame();
        return;
      }

      if (e.code === 'KeyH') {
        e.preventDefault();
        setDockCollapsed((prev) => !prev);
        return;
      }

      if (phase === 'playing') {
        if (e.code === 'Digit1') {
          setBiscuitId('thin');
          tongAudio.playUiClick();
        } else if (e.code === 'Digit2') {
          setBiscuitId('cracker');
          tongAudio.playUiClick();
        } else if (e.code === 'Digit3') {
          setBiscuitId('toast');
          tongAudio.playUiClick();
        } else if (e.code === 'Space') {
          e.preventDefault();
          if (!e.repeat) {
            setIsHoldingInput(true);
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsHoldingInput(false);
      }
    };

    const onBlurOrVisibility = () => {
      setIsHoldingInput(false);
      tongAudio.stopDippingSound();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlurOrVisibility);
    document.addEventListener('visibilitychange', onBlurOrVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlurOrVisibility);
      document.removeEventListener('visibilitychange', onBlurOrVisibility);
    };
  }, [phase, startNewGame, handleTogglePause, handleToggleMute]);

  // Global mouseup / pointerup release safety
  useEffect(() => {
    const handleGlobalUp = () => {
      if (isHoldingInput) {
        setIsHoldingInput(false);
      }
    };
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [isHoldingInput]);

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      {/* 1. Isolated Full-Viewport 3D Three.js Canvas */}
      <TongSceneCanvas
        phase={phase}
        biscuitId={biscuitId}
        teaPercent={teaPercent}
        sludgeCount={sludgeCount}
        combo={combo}
        friendName={friendName}
        isHoldingInput={isHoldingInput}
        soakBarFillRef={soakBarFillRef}
        soakGhostFillRef={soakGhostFillRef}
        soakTextRef={soakTextRef}
        soakZoneLabelRef={soakZoneLabelRef}
        onDipEvaluated={handleDipEvaluated}
        onSoakMilestoneChange={handleSoakMilestoneChange}
      />

      {/* 2. Interactive Full-Screen Canvas Pointer Catcher during 'playing' */}
      {phase === 'playing' && (
        <div
          aria-label="চায়ে বিস্কুট ডুবানোর এরিয়া (Hold to dip biscuit)"
          onPointerDown={(e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            setIsHoldingInput(true);
          }}
          className="fixed inset-0 z-10 cursor-pointer"
        />
      )}

      {/* 3. TITLE SCREEN OVERLAY ('title') */}
      {phase === 'title' && (
        <section
          aria-label="Title Screen"
          className="fixed inset-0 z-30 flex flex-col justify-between p-6 sm:p-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(16, 9, 4, 0.92) 0%, rgba(16, 9, 4, 0.72) 44%, rgba(16, 9, 4, 0.15) 100%)',
          }}
        >
          {/* Left-Third Asymmetric Title Lockup over calm negative space */}
          <div className="my-auto max-w-xl space-y-5 pointer-events-auto">
            {/* Bespoke Inline SVG Bangladeshi Tong Crest Emblem */}
            <div className="inline-flex items-center gap-3">
              <svg
                width="54"
                height="54"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle
                  cx="32"
                  cy="32"
                  r="30"
                  fill="#2A160B"
                  stroke="#D97706"
                  strokeWidth="3"
                />
                {/* Steaming Tea Cup & Biscuit Silhouette */}
                <path
                  d="M20 28H44L41 50C40.5 52.5 38.5 54 36 54H28C25.5 54 23.5 52.5 23 50L20 28Z"
                  fill="#D97706"
                  stroke="#FEF3C7"
                  strokeWidth="2"
                />
                <rect
                  x="25"
                  y="14"
                  width="14"
                  height="18"
                  rx="3"
                  transform="rotate(-8 25 14)"
                  fill="#F59E0B"
                  stroke="#78350F"
                  strokeWidth="2"
                />
                <circle cx="30" cy="20" r="1.3" fill="#78350F" />
                <circle cx="35" cy="19" r="1.3" fill="#78350F" />
                <path
                  d="M24 12C24 9 27 8 27 5M39 13C39 10 42 9 42 6"
                  stroke="#FDE68A"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <div>
                <span className="text-xs font-mono-num tracking-widest text-amber-400 block">
                  TONG-ER DOKAN 3D SIMULATOR
                </span>
                <span className="text-sm text-amber-100/80">
                  বাংলার ঐতিহ্যবাহী টংয়ের দুধ চা ও বিস্কুট পদার্থবিজ্ঞান
                </span>
              </div>
            </div>

            <h1
              className="text-3xl sm:text-5xl font-bold text-[#fdf6ec] leading-tight tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              চায়ে বিস্কুট ডুবানো সিমুলেটর
            </h1>

            <p className="text-base sm:text-lg text-amber-100/90 max-w-md leading-relaxed">
              গরম দুধ চায়ে বিস্কুট ডুবিয়ে নরম করুন, কিন্তু সাবধান—বেশি ভিজে গেলেই বিস্কুট
              ভেঙে চায়ের তলানিতে শহীদ হবে! ৩টি বিস্কুট ডুবলেই খেলা শেষ!
            </p>

            {/* Quick Friend Roast Name & Difficulty Setup before starting */}
            <div
              className="p-4 rounded-2xl border border-[#5c3a1e] space-y-3 max-w-md"
              style={{ backgroundColor: 'rgba(28, 16, 8, 0.92)' }}
            >
              <div>
                <label
                  htmlFor="title-friend-input"
                  className="block text-xs font-semibold text-amber-300 mb-1"
                >
                  বন্ধুকে রোস্ট/চ্যালেঞ্জ করুন (Friend&apos;s Name):
                </label>
                <input
                  id="title-friend-input"
                  type="text"
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  placeholder="যেমন: রাকিব, সুমন, ফাহিম..."
                  maxLength={24}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#160c05] border border-[#6e4624] text-[#fdf6ec] text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-amber-300 mb-1.5">
                  বিস্কুট নির্বাচন করুন (Select Biscuit Difficulty):
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['thin', 'cracker', 'toast'] as BiscuitId[]).map((id) => {
                    const b = BISCUIT_SPECS[id];
                    const active = biscuitId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          tongAudio.playUiClick();
                          setBiscuitId(id);
                        }}
                        className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-amber-600/30 border-amber-400 text-[#fdf6ec]'
                            : 'bg-[#1a0f07] border-[#4d3018] text-amber-100/75 hover:border-amber-500/60'
                        }`}
                      >
                        <span className="text-xs font-bold block truncate">
                          {b.nameBn}
                        </span>
                        <span className="text-[11px] font-mono-num text-amber-300 block">
                          {b.difficultyLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-1 flex items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  tongAudio.playUiClick();
                  startNewGame();
                }}
                className="px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#1c0f05] font-bold text-lg shadow-lg transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
              >
                চায়ে ডুব দিন · Start Dipping
              </button>
            </div>
          </div>

          {/* Flat Borderless Control Hint Line at Bottom Safe Margin */}
          <div className="text-xs sm:text-sm text-amber-200/80 font-medium tracking-wide">
            Hold Left Click / Touch / Spacebar to Dip · Release at 70%–92% Sweet Spot to Eat · 1/2/3 Switch Biscuit · P Pause
          </div>
        </section>
      )}

      {/* 4. PLAYING HUD OVERLAY ('playing' | 'paused' | 'gameover') */}
      {phase !== 'title' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
          {/* TOP ROW: Top-Left Score/Tea/Sludge | Top-Center Commentary & Soak Gauge | Top-Right Utilities */}
          <div className="flex items-start justify-between gap-3 w-full">
            {/* Top-Left Cluster: Score, Combo, Tea Remaining & 3 Cup Sludge Pips */}
            <div
              className="pointer-events-auto rounded-2xl border border-[#5e3a1c] px-4 py-3 shadow-xl space-y-2.5 min-w-[230px] sm:min-w-[270px]"
              style={{ backgroundColor: 'rgba(22, 12, 6, 0.90)' }}
            >
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-amber-300/90 uppercase block">
                    স্কোর · SCORE
                  </span>
                  <span
                    data-testid="hud-score"
                    className="text-2xl sm:text-3xl font-bold font-mono-num text-[#fdf6ec] hud-stroke"
                  >
                    {score}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-semibold tracking-wider text-amber-300/90 uppercase block">
                    স্ট্রিক · COMBO
                  </span>
                  <span
                    data-testid="hud-combo"
                    className="text-xl sm:text-2xl font-bold font-mono-num text-amber-400 hud-stroke"
                  >
                    {combo}x
                  </span>
                </div>
              </div>

              {/* Tea Level Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-amber-200/90 font-medium">
                    কাপে বাকি দুধ চা (Tea Left)
                  </span>
                  <span
                    data-testid="hud-tea-percent"
                    className="font-mono-num font-bold text-amber-300"
                  >
                    {Math.round(teaPercent)}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#120904] border border-[#4a2c14] overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-200"
                    style={{ width: `${Math.max(0, Math.min(100, teaPercent))}%` }}
                  />
                </div>
              </div>

              {/* 3 Discrete Cup Sludge Sockets ("চায়ের তলানি") */}
              <div className="pt-1 border-t border-[#3d2410] flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-amber-200/90">
                  চায়ের তলানি (Sludge {sludgeCount}/{MAX_SLUDGE_COUNT}):
                </span>
                <div
                  className="flex items-center gap-1.5"
                  aria-label={`Broken biscuits in cup: ${sludgeCount} of ${MAX_SLUDGE_COUNT}`}
                >
                  {[0, 1, 2].map((idx) => {
                    const isBroken = idx < sludgeCount;
                    return (
                      <svg
                        key={idx}
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="4"
                          fill={isBroken ? '#7F1D1D' : '#1E1108'}
                          stroke={isBroken ? '#EF4444' : '#784A22'}
                          strokeWidth="2"
                        />
                        {isBroken ? (
                          <path
                            d="M7 8L12 13L17 8M8 16H16"
                            stroke="#FCA5A5"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        ) : (
                          <circle cx="12" cy="12" r="3" fill="#D97706" />
                        )}
                      </svg>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top-Center Cluster: Live Friend Roast Commentary & Soak Meter Gauge */}
            <div className="flex-1 max-w-xl mx-auto flex flex-col items-center gap-2">
              <div
                className="w-full rounded-2xl border border-[#6e4421] px-4 py-2.5 shadow-xl text-center"
                style={{ backgroundColor: 'rgba(24, 13, 6, 0.92)' }}
              >
                <p
                  data-testid="live-commentary"
                  className="text-sm sm:text-base font-bold text-amber-200 truncate"
                >
                  {liveCommentary}
                </p>

                {/* Live Soak Meter ("ভেজার মাত্রা") with Sweet Spot 70%-92% marker */}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-100/90 font-semibold">
                      ভেজার মাত্রা (Soak Meter):{' '}
                      <span
                        ref={soakZoneLabelRef}
                        className="text-amber-300 font-bold"
                      >
                        শুকনা (Dry)
                      </span>
                    </span>
                    <span
                      ref={soakTextRef}
                      data-testid="soak-percent-text"
                      className="font-mono-num font-bold text-amber-300"
                    >
                      0%
                    </span>
                  </div>

                  {/* Gauge Track with Sweet Spot (70% - 92%) & Break (>93%) Zones */}
                  <div className="relative w-full h-4 rounded-lg bg-[#120904] border border-[#5e3a1c] overflow-hidden">
                    {/* Sweet Spot Zone Highlight (70% to 92%) */}
                    <div
                      className="absolute top-0 bottom-0 border-l border-r border-emerald-400/80"
                      style={{
                        left: '70%',
                        width: '22%',
                        backgroundColor: 'rgba(16, 185, 129, 0.28)',
                      }}
                      title="Sweet Spot: 70%–92%"
                    />
                    {/* Danger Break Zone (93% to 100%) */}
                    <div
                      className="absolute top-0 bottom-0 right-0"
                      style={{
                        left: '93%',
                        backgroundColor: 'rgba(239, 68, 68, 0.38)',
                      }}
                    />
                    {/* Trailing Ghost Bar */}
                    <div
                      ref={soakGhostFillRef}
                      className="absolute top-0 bottom-0 left-0 transition-none"
                      style={{
                        width: '0%',
                        backgroundColor: 'rgba(251, 191, 36, 0.25)',
                      }}
                    />
                    {/* Active Soak Fill Bar */}
                    <div
                      ref={soakBarFillRef}
                      className="
                        absolute top-0 bottom-0 left-0 transition-none
                      "
                      style={{ width: '0%', backgroundColor: '#d97706' }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] font-mono-num text-amber-200/70 px-0.5">
                    <span>0% কাঁচা</span>
                    <span className="text-emerald-300 font-semibold">
                      ★ 70%–92% অমৃত ডুব
                    </span>
                    <span className="text-rose-400 font-semibold">93%+ ধপাস!</span>
                  </div>
                </div>
              </div>

              {/* Floating Outcome Feedback Banner */}
              {floatingPopup && (
                <div
                  key={floatingPopup.id}
                  data-testid="dip-outcome-banner"
                  className=" fixed left-1/2 top-36 z-30 pointer-events-none animate-float-banner px-5 py-2.5 rounded-2xl border shadow-2xl text-center whitespace-nowrap"
                  style={{
                    backgroundColor:
                      floatingPopup.outcome === 'perfect'
                        ? 'rgba(20, 83, 45, 0.95)'
                        : floatingPopup.outcome === 'broken'
                        ? 'rgba(127, 29, 29, 0.95)'
                        : 'rgba(42, 24, 12, 0.95)',
                    borderColor:
                      floatingPopup.outcome === 'perfect'
                        ? '#34d399'
                        : floatingPopup.outcome === 'broken'
                        ? '#f87171'
                        : '#f59e0b',
                  }}
                >
                  <p className="text-base sm:text-lg font-bold text-white">
                    {floatingPopup.title}
                  </p>
                  <p className="text-xs text-amber-100 mt-0.5">
                    {floatingPopup.subtitle}
                  </p>
                </div>
              )}
            </div>

            {/* Top-Right Cluster: Compact Square SVG Utility Buttons (Mute [M], Pause [P], Restart [R]) */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                tabIndex={-1}
                aria-label={isMuted ? 'Unmute Audio [M]' : 'Mute Audio [M]'}
                title={isMuted ? 'Unmute [M]' : 'Mute [M]'}
                onClick={handleToggleMute}
                className="w-11 h-11 rounded-xl border border-[#5e3a1c] flex items-center justify-center text-amber-200 hover:border-amber-400 transition-colors cursor-pointer"
                style={{ backgroundColor: 'rgba(22, 12, 6, 0.90)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M11 5L6 9H2V15H6L11 19V5Z"
                    fill="#D97706"
                    stroke="#FEF3C7"
                    strokeWidth="1.8"
                  />
                  {isMuted ? (
                    <path
                      d="M22 9L16 15M16 9L22 15"
                      stroke="#EF4444"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  ) : (
                    <path
                      d="M15.5 8.5C16.8 9.8 16.8 14.2 15.5 15.5M19 5.5C21.8 8.5 21.8 15.5 19 18.5"
                      stroke="#FDE68A"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game [P]"
                title="Pause [P]"
                onClick={handleTogglePause}
                className="w-11 h-11 rounded-xl border border-[#5e3a1c] flex items-center justify-center text-amber-200 hover:border-amber-400 transition-colors cursor-pointer"
                style={{ backgroundColor: 'rgba(22, 12, 6, 0.90)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="6"
                    y="5"
                    width="4"
                    height="14"
                    rx="1"
                    fill="#D97706"
                    stroke="#FEF3C7"
                    strokeWidth="1.6"
                  />
                  <rect
                    x="14"
                    y="5"
                    width="4"
                    height="14"
                    rx="1"
                    fill="#D97706"
                    stroke="#FEF3C7"
                    strokeWidth="1.6"
                  />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                aria-label="Restart Game [R]"
                title="Restart [R]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  tongAudio.playUiClick();
                  startNewGame();
                }}
                className="w-11 h-11 rounded-xl border border-[#5e3a1c] flex items-center justify-center text-amber-200 hover:border-amber-400 transition-colors cursor-pointer"
                style={{ backgroundColor: 'rgba(22, 12, 6, 0.90)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12C4 7.58 7.58 4 12 4C15.3 4 18.1 6 19.3 8.8M20 4V9H15M20 12C20 16.42 16.42 20 12 20C8.7 20 5.9 18 4.7 15.2"
                    stroke="#FDE68A"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* BOTTOM ROW: Unified Collapsible Control Dock (Pinned to Bottom Center) */}
          <div className="mx-auto w-full max-w-[1040px] flex flex-col items-center pointer-events-auto">
            {/* Collapse / Expand Toggle Handle */}
            <button
              type="button"
              onClick={() => setDockCollapsed((prev) => !prev)}
              className="px-4 py-1 rounded-t-xl border border-b-0 border-[#5e3a1c] text-xs font-semibold text-amber-200 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: 'rgba(22, 12, 6, 0.92)' }}
            >
              {dockCollapsed
                ? '▴ কন্ট্রোল ডক দেখান (Show Controls [H])'
                : '▾ কন্ট্রোল ডক লুকান (Hide Controls [H])'}
            </button>

            {!dockCollapsed && (
              <div
                className="w-full rounded-2xl border border-[#6e4421] p-2.5 sm:p-3.5 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5"
                style={{ backgroundColor: 'rgba(22, 12, 6, 0.94)' }}
              >
                {/* 1. Three Selectable Biscuit Difficulties */}
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {(['thin', 'cracker', 'toast'] as BiscuitId[]).map((id) => {
                    const spec = BISCUIT_SPECS[id];
                    const isSelected = biscuitId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          tongAudio.playUiClick();
                          setBiscuitId(id);
                        }}
                        className={`px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/25 border-amber-400 text-[#fdf6ec] shadow-inner'
                            : 'bg-[#140a04] border-[#4a2c14] text-amber-100/75 hover:border-amber-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold whitespace-nowrap truncate">
                            {spec.nameBn}
                          </span>
                          <span className="text-[10px] font-mono-num px-1 py-0.5 rounded bg-[#2b180b] text-amber-300 shrink-0">
                            [{spec.keyHint}]
                          </span>
                        </div>
                        <span className="text-[11px] font-mono-num text-amber-300/90 block mt-0.5 whitespace-nowrap truncate">
                          {spec.difficultyLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 2. Friend Roast Input ("বন্ধুকে রোস্ট/চ্যালেঞ্জ করুন") */}
                <div className="flex items-center gap-2 md:w-48 shrink-0">
                  <div className="w-full">
                    <label
                      htmlFor="dock-friend-input"
                      className="block text-[11px] font-semibold text-amber-300/90 mb-0.5 whitespace-nowrap"
                    >
                      বন্ধুকে রোস্ট করুন (Friend Mode):
                    </label>
                    <input
                      id="dock-friend-input"
                      type="text"
                      value={friendName}
                      onChange={(e) => setFriendName(e.target.value)}
                      placeholder="বন্ধুর নাম লিখুন..."
                      maxLength={24}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[#120904] border border-[#5e3a1c] text-sm text-[#fdf6ec] focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* 3. Primary Tactile Hold-to-Dip Action Button */}
                <button
                  type="button"
                  data-testid="hold-dip-button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setIsHoldingInput(true);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    setIsHoldingInput(false);
                  }}
                  onPointerLeave={() => {
                    if (isHoldingInput) setIsHoldingInput(false);
                  }}
                  className={`py-3 px-5 rounded-xl font-bold text-sm sm:text-base transition-transform cursor-pointer shrink-0 whitespace-nowrap ${
                    isHoldingInput
                      ? 'bg-emerald-500 text-stone-950 scale-95 shadow-inner'
                      : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-lg'
                  }`}
                >
                  {isHoldingInput
                    ? '☕ ডুবছে... ছেড়ে দিন! (Release)'
                    : '👇 চেপে ধরুন = চায়ে ডুব (Hold Dip)'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. PAUSE MODAL ('paused') */}
      {phase === 'paused' && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-auto"
          style={{ backgroundColor: 'rgba(14, 8, 4, 0.82)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-modal-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border-2 border-[#6e4421] p-6 text-center space-y-5 shadow-2xl"
            style={{ backgroundColor: 'rgba(28, 16, 8, 0.96)' }}
          >
            <div>
              <span className="text-xs font-mono-num text-amber-400 tracking-widest uppercase">
                GAME PAUSED · চা পানের বিরতি
              </span>
              <h2
                id="pause-modal-title"
                className="text-2xl font-bold text-[#fdf6ec] mt-1"
              >
                টংয়ের আড্ডা সাময়িক বিরতি ☕
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-[#180d06] border border-[#4d2f16]">
                <span className="text-xs text-amber-200/80 block">স্কোর</span>
                <span className="text-xl font-bold font-mono-num text-white">
                  {score}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#180d06] border border-[#4d2f16]">
                <span className="text-xs text-amber-200/80 block">অক্ষত</span>
                <span className="text-xl font-bold font-mono-num text-emerald-400">
                  {survivedCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#180d06] border border-[#4d2f16]">
                <span className="text-xs text-amber-200/80 block">তলানি</span>
                <span className="text-xl font-bold font-mono-num text-rose-400">
                  {sludgeCount}/{MAX_SLUDGE_COUNT}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleTogglePause()}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-base transition-colors cursor-pointer"
              >
                খেলা চালিয়ে যান (Resume [P])
              </button>
              <button
                type="button"
                onClick={() => {
                  tongAudio.playUiClick();
                  startNewGame();
                }}
                className="w-full py-2.5 rounded-xl border border-[#6e4421] bg-[#1f1108] hover:bg-[#2b180c] text-amber-100 font-semibold text-sm transition-colors cursor-pointer"
              >
                নতুন কাপ চা নিন (Restart [R])
              </button>
              <button
                type="button"
                onClick={() => {
                  tongAudio.playUiClick();
                  setPhase('title');
                }}
                className="w-full py-2.5 rounded-xl border border-transparent text-amber-300/80 hover:text-amber-200 text-sm font-medium cursor-pointer"
              >
                মূল পাতায় ফিরে যান (Title Screen)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SHAREABLE TONG RECEIPT / OBITUARY MODAL ('gameover') */}
      {phase === 'gameover' && runSummary && (
        <TongReceiptModal
          summary={runSummary}
          onPlayAgain={startNewGame}
          onBackToTitle={() => {
            setRunSummary(null);
            setPhase('title');
          }}
        />
      )}
    </main>
  );
}
