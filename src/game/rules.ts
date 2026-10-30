export type BiscuitId = 'thin' | 'cracker' | 'toast';

export interface BiscuitSpec {
  id: BiscuitId;
  nameBn: string;
  nameEn: string;
  difficultyLabel: string;
  soakDurationSec: number;
  teaDrainMultiplier: number;
  baseTeaDrain: number;
  descriptionBn: string;
  keyHint: string;
  colorHex: number;
  wetColorHex: number;
  crumbColorHex: number;
}

export const BISCUIT_SPECS: Record<BiscuitId, BiscuitSpec> = {
  thin: {
    id: 'thin',
    nameBn: 'পাতলা এনার্জি বিস্কুট',
    nameEn: 'Thin Biscuit',
    difficultyLabel: 'Hard · 1.5s',
    soakDurationSec: 1.5,
    teaDrainMultiplier: 1.0,
    baseTeaDrain: 6,
    descriptionBn: 'চোখের পলকে ভিজে যায়, একটু দেরি হলেই ধপাস!',
    keyHint: '1',
    colorHex: 0xd99b52,
    wetColorHex: 0x6e4219,
    crumbColorHex: 0xe6ad65,
  },
  cracker: {
    id: 'cracker',
    nameBn: 'ক্র্যাকার্স বিস্কুট',
    nameEn: 'Crispy Cracker',
    difficultyLabel: 'Medium · 2.5s',
    soakDurationSec: 2.5,
    teaDrainMultiplier: 1.2,
    baseTeaDrain: 7,
    descriptionBn: 'ছিদ্রযুক্ত মচমচে বিস্কুট, ভারসাম্যপূর্ণ ডুব!',
    keyHint: '2',
    colorHex: 0xe3b168,
    wetColorHex: 0x784a20,
    crumbColorHex: 0xedd28a,
  },
  toast: {
    id: 'toast',
    nameBn: 'লোহার টোস্ট বিস্কুট',
    nameEn: 'Toast Biscuit',
    difficultyLabel: 'Tank · 4.0s',
    soakDurationSec: 4.0,
    teaDrainMultiplier: 2.0,
    baseTeaDrain: 12,
    descriptionBn: 'লোহার মতো শক্ত! ৪ সেকেন্ড লাগে ভিজতে, ২ গুণ চা টানে!',
    keyHint: '3',
    colorHex: 0xc47d38,
    wetColorHex: 0x593210,
    crumbColorHex: 0xd4914e,
  },
};

export type DipOutcomeType = 'dry' | 'good' | 'perfect' | 'broken';

export interface DipEvaluation {
  outcome: DipOutcomeType;
  pointsDelta: number;
  newCombo: number;
  teaConsumed: number;
  sludgeAdded: number;
  bannerTextBn: string;
  subTextBn: string;
}

export const MAX_SLUDGE_COUNT = 3;
export const SWEET_SPOT_MIN = 70;
export const SWEET_SPOT_MAX = 92;
export const DRY_THRESHOLD = 65;
export const BREAK_THRESHOLD = 93;

/**
 * Calculates new soak percentage (0 to 100) while submerged.
 */
export function advanceSoakPercent(
  currentSoak: number,
  dtSec: number,
  biscuitId: BiscuitId
): number {
  const spec = BISCUIT_SPECS[biscuitId];
  const ratePerSec = 100 / spec.soakDurationSec;
  return Math.min(100, Math.max(0, currentSoak + ratePerSec * dtSec));
}

/**
 * Evaluates the outcome when a biscuit is released at a given soak percentage
 * or when soak crosses the break threshold while still submerged.
 */
export function evaluateDip(
  soakPercent: number,
  currentCombo: number,
  biscuitId: BiscuitId,
  friendName: string = ''
): DipEvaluation {
  const spec = BISCUIT_SPECS[biscuitId];
  const cleanName = friendName.trim();
  const subjectPrefix = cleanName ? `${cleanName}-এর ` : '';

  if (soakPercent >= BREAK_THRESHOLD) {
    return {
      outcome: 'broken',
      pointsDelta: 0,
      newCombo: 0,
      teaConsumed: Math.round(spec.baseTeaDrain * 0.5),
      sludgeAdded: 1,
      bannerTextBn: cleanName
        ? `হায় হায়! ${cleanName}-এর বিস্কুট চায়ে শহীদ হয়েছে! 😭`
        : 'হায় হায়! বিস্কুট ভেঙে চায়ের তলানিতে শহীদ! 😭',
      subTextBn: 'অতিরিক্ত ভিজে তলানিতে ডুবে গেছে (+১ তলানি)',
    };
  }

  if (soakPercent < DRY_THRESHOLD) {
    return {
      outcome: 'dry',
      pointsDelta: 10,
      newCombo: 0,
      teaConsumed: Math.max(2, Math.round(spec.baseTeaDrain * 0.35)),
      sludgeAdded: 0,
      bannerTextBn: 'শক্ত বিস্কুট! দাঁতের এনামেল ক্ষয়!',
      subTextBn: cleanName
        ? `${cleanName} ভয়ে কাঁচা বিস্কুটই তুলে ফেলেছে! (+১০ পয়েন্ট, কম্বো ভঙ্গ)`
        : 'ঠিকমতো ভেজেনি! (+১০ পয়েন্ট, কম্বো ভঙ্গ)',
    };
  }

  if (soakPercent >= SWEET_SPOT_MIN && soakPercent <= SWEET_SPOT_MAX) {
    const nextCombo = currentCombo + 1;
    const multiplier = Math.min(5, nextCombo);
    const points = 100 * multiplier;
    return {
      outcome: 'perfect',
      pointsDelta: points,
      newCombo: nextCombo,
      teaConsumed: spec.baseTeaDrain,
      sludgeAdded: 0,
      bannerTextBn: 'আহ! অমৃত ডুব! 🔥',
      subTextBn: `${subjectPrefix}নিখুঁত মাখন-নরম ডুব! (+${points} পয়েন্ট · ${nextCombo}x স্ট্রিক)`,
    };
  }

  // Between 65% and 70% or 92% and 93% (near sweet spot)
  const nextCombo = currentCombo + 1;
  const points = 45 * Math.min(4, nextCombo);
  return {
    outcome: 'good',
    pointsDelta: points,
    newCombo: nextCombo,
    teaConsumed: spec.baseTeaDrain,
    sludgeAdded: 0,
    bannerTextBn: soakPercent < SWEET_SPOT_MIN ? 'মোটামুটি নরম ডুব! ☕' : 'একটুর জন্য বেঁচে গেছে! 😅',
    subTextBn: `বেশ ভালো ডুব (+${points} পয়েন্ট · ${nextCombo}x স্ট্রিক)`,
  };
}

/**
 * Generates live Bangla commentary at the top of the screen based on current action.
 */
export function getLiveCommentary(
  isDipping: boolean,
  soakPercent: number,
  friendName: string,
  sludgeCount: number,
  combo: number
): string {
  const name = friendName.trim() || 'চা-প্রেমী';

  if (isDipping) {
    if (soakPercent >= 82) {
      return `সাবধান! ${name}-এর বিস্কুট এক্ষুণি ভেঙে পড়বে! 😰`;
    }
    if (soakPercent >= 68) {
      return `এখনই তোলার সময়! ${name}, তাড়াতাড়ি টান দিন! ✨`;
    }
    if (soakPercent >= 35) {
      return `${name} ভয়ে হাত কাঁপাচ্ছে! চায়ে বুদবুদ উঠছে...`;
    }
    return `${name} গরম দুধ চায়ে বিস্কুট ডুবিয়েছে...`;
  }

  if (sludgeCount === 2) {
    return `সতর্কতা: কাপে ২টি বিস্কুট ডুবে আছে! আর ১টি ভাঙলেই চা কাদা হয়ে যাবে!`;
  }
  if (combo >= 3) {
    return `আগুন ফর্ম! ${name} টানা ${combo}টি নিখুঁত ডুব দিয়েছে! 🔥`;
  }
  return `${name} টংয়ের বেঞ্চে বসে বিস্কুট ডুবানোর প্রস্তুতি নিচ্ছে...`;
}

export interface TongRankInfo {
  titleBn: string;
  titleEn: string;
  roastBn: string;
  badgeCode: string;
}

/**
 * Assigns a humorous Bangladeshi Tong title based on score, survived biscuits, and broken biscuits.
 */
export function assignTongTitle(
  score: number,
  survivedCount: number,
  brokenCount: number,
  friendName: string = ''
): TongRankInfo {
  const target = friendName.trim() || 'আপনি';

  if (score >= 900 || survivedCount >= 8) {
    return {
      titleBn: 'টংয়ের সম্রাট ও গ্র্যান্ডমাস্টার ডুবুরি',
      titleEn: 'Supreme Tong Legend',
      roastBn: `${target}-কে দেখে মামা ফ্রি মালাই চা অফার করেছে! নিখুঁত বিস্কুট পদার্থবিজ্ঞানী!`,
      badgeCode: 'TONG-LEGEND-01',
    };
  }

  if (score >= 450 || survivedCount >= 5) {
    return {
      titleBn: 'পাকা হাতের বিস্কুট ইঞ্জিনিয়ার',
      titleEn: 'Senior Biscuit Tactician',
      roastBn: `${target} চায়ের কাপের মাপ জানেন, কিন্তু শেষ মুহূর্তে লোভে পড়ে ডুবিয়েছেন!`,
      badgeCode: 'TONG-PRO-02',
    };
  }

  if (score >= 150 || survivedCount >= 2) {
    return {
      titleBn: 'আবেগপ্রবণ চা-খোর',
      titleEn: 'Emotional Tea Dipper',
      roastBn: `${target} চায়ের চেয়ে বিস্কুটের তলানিই বেশি বানিয়েছেন। চামচ ছাড়া এই চা খাওয়া অসম্ভব!`,
      badgeCode: 'TONG-AMATEUR-03',
    };
  }

  return {
    titleBn: 'কাঁচা হাতের চা-খোর (বিস্কুট খুনি)',
    titleEn: 'Certified Biscuit Sinker',
    roastBn: `${target}-এর হাতে বিস্কুট দেওয়া মানেই চায়ের কাপে সলিল সমাধি! টংয়ের মামাও হতাশ!`,
    badgeCode: 'TONG-ROOKIE-04',
  };
}
