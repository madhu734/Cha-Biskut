import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSoakPercent,
  evaluateDip,
  assignTongTitle,
  getLiveCommentary,
  BISCUIT_SPECS,
  MAX_SLUDGE_COUNT,
} from './rules';

test('advanceSoakPercent respects biscuit difficulty soak durations', () => {
  // Thin biscuit takes 1.5s -> 0.75s should be 50%
  const thinHalf = advanceSoakPercent(0, 0.75, 'thin');
  assert.equal(Math.round(thinHalf), 50);

  // Cracker takes 2.5s -> 1.25s should be 50%
  const crackerHalf = advanceSoakPercent(0, 1.25, 'cracker');
  assert.equal(Math.round(crackerHalf), 50);

  // Toast takes 4.0s -> 2.0s should be 50%
  const toastHalf = advanceSoakPercent(0, 2.0, 'toast');
  assert.equal(Math.round(toastHalf), 50);
});

test('evaluateDip handles Too Early (< 65% soaked) dry dip and breaks combo', () => {
  const res = evaluateDip(42, 3, 'cracker', 'রাকিব');
  assert.equal(res.outcome, 'dry');
  assert.equal(res.pointsDelta, 10);
  assert.equal(res.newCombo, 0);
  assert.equal(res.sludgeAdded, 0);
  assert.ok(res.bannerTextBn.includes('শক্ত বিস্কুট! দাঁতের এনামেল ক্ষয়!'));
});

test('evaluateDip handles Sweet Spot (70% to 92% soaked) perfect dip with combo multiplier', () => {
  const first = evaluateDip(80, 0, 'thin', 'রাকিব');
  assert.equal(first.outcome, 'perfect');
  assert.equal(first.newCombo, 1);
  assert.equal(first.pointsDelta, 100);
  assert.equal(first.sludgeAdded, 0);
  assert.ok(first.bannerTextBn.includes('আহ! অমৃত ডুব! 🔥'));

  const second = evaluateDip(85, 2, 'toast', 'রাকিব');
  assert.equal(second.outcome, 'perfect');
  assert.equal(second.newCombo, 3);
  assert.equal(second.pointsDelta, 300);
  assert.equal(second.teaConsumed, BISCUIT_SPECS.toast.baseTeaDrain);
  assert.ok(second.teaConsumed >= BISCUIT_SPECS.thin.baseTeaDrain * 2);
});

test('evaluateDip handles Tragedy / Over-soaked (>= 93%) broken biscuit with friend roast', () => {
  const broken = evaluateDip(95, 4, 'thin', 'রাকিব');
  assert.equal(broken.outcome, 'broken');
  assert.equal(broken.pointsDelta, 0);
  assert.equal(broken.newCombo, 0);
  assert.equal(broken.sludgeAdded, 1);
  assert.ok(broken.bannerTextBn.includes('রাকিব-এর বিস্কুট চায়ে শহীদ হয়েছে!'));
});

test('assignTongTitle and getLiveCommentary return valid Bangla titles and commentary', () => {
  const rookie = assignTongTitle(40, 1, MAX_SLUDGE_COUNT, 'রাকিব');
  assert.ok(rookie.titleBn.includes('কাঁচা হাতের চা-খোর'));

  const legend = assignTongTitle(1200, 9, 1, 'রাকিব');
  assert.ok(legend.titleBn.includes('টংয়ের সম্রাট'));

  const trembling = getLiveCommentary(true, 45, 'রাকিব', 0, 1);
  assert.ok(trembling.includes('রাকিব ভয়ে হাত কাঁপাচ্ছে!'));
});
