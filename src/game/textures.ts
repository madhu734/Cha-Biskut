import * as THREE from 'three';
import { BiscuitId } from './rules';

/**
 * Generates procedural Three.js CanvasTextures with zero external image URLs.
 */
export function createWoodTableTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = 512;
  colorCanvas.height = 512;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Base warm rustic teak wood tone
  ctx.fillStyle = '#4a2c18';
  ctx.fillRect(0, 0, 512, 512);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  // Plank seams & wood grain fibers
  const plankCount = 4;
  const plankH = 512 / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const y0 = p * plankH;
    // Slight variation per plank
    const shade = p % 2 === 0 ? 'rgba(255, 195, 130, 0.04)' : 'rgba(20, 8, 2, 0.08)';
    ctx.fillStyle = shade;
    ctx.fillRect(0, y0, 512, plankH);

    // Grain lines
    for (let i = 0; i < 65; i++) {
      const gy = y0 + Math.random() * plankH;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(30, 14, 5, 0.25)' : 'rgba(120, 74, 38, 0.16)';
      ctx.lineWidth = 1 + Math.random() * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(
        170,
        gy + (Math.random() - 0.5) * 10,
        340,
        gy + (Math.random() - 0.5) * 10,
        512,
        gy
      );
      ctx.stroke();

      bCtx.strokeStyle = i % 2 === 0 ? 'rgba(210,210,210,0.35)' : 'rgba(50,50,50,0.35)';
      bCtx.lineWidth = 1.2;
      bCtx.beginPath();
      ctx.moveTo(0, gy);
      bCtx.lineTo(512, gy);
      bCtx.stroke();
    }

    // Plank groove line
    ctx.fillStyle = '#1f1006';
    ctx.fillRect(0, y0, 512, 4);
    bCtx.fillStyle = '#181818';
    bCtx.fillRect(0, y0, 512, 5);
  }

  // Subtle historical tea cup stain rings on the Tong table
  const rings = [
    { x: 140, y: 190, r: 42 },
    { x: 380, y: 310, r: 36 },
  ];
  rings.forEach(({ x, y, r }) => {
    ctx.strokeStyle = 'rgba(28, 12, 4, 0.22)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

/**
 * Generates baked surface albedo and bump maps tailored to each biscuit type.
 */
export function createBiscuitTextures(
  type: BiscuitId,
  maxAnisotropy: number
): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const bump = document.createElement('canvas');
  bump.width = 256;
  bump.height = 256;
  const bCtx = bump.getContext('2d')!;

  if (type === 'thin') {
    // Golden baked Energy Biscuit
    ctx.fillStyle = '#d99b52';
    ctx.fillRect(0, 0, 256, 256);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, 256, 256);

    // Baked golden edge gradient
    const grad = ctx.createRadialGradient(128, 128, 40, 128, 128, 135);
    grad.addColorStop(0, 'rgba(245, 198, 126, 0.35)');
    grad.addColorStop(1, 'rgba(138, 75, 22, 0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Embossed border & ribs
    ctx.strokeStyle = 'rgba(120, 62, 16, 0.55)';
    ctx.lineWidth = 5;
    ctx.strokeRect(20, 20, 216, 216);
    bCtx.strokeStyle = '#d0d0d0';
    bCtx.lineWidth = 6;
    bCtx.strokeRect(20, 20, 216, 216);

    // Docker pinholes
    for (let y = 44; y <= 212; y += 28) {
      for (let x = 44; x <= 212; x += 28) {
        ctx.fillStyle = 'rgba(95, 48, 12, 0.55)';
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();

        bCtx.fillStyle = '#202020';
        bCtx.beginPath();
        bCtx.arc(x, y, 4, 0, Math.PI * 2);
        bCtx.fill();
      }
    }
  } else if (type === 'cracker') {
    // Pale golden Crispy Cracker with flaky blisters & salt/sugar crystals
    ctx.fillStyle = '#e5b56d';
    ctx.fillRect(0, 0, 256, 256);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, 256, 256);

    // Toasted blister spots
    for (let i = 0; i < 45; i++) {
      const bx = 20 + Math.random() * 216;
      const by = 20 + Math.random() * 216;
      const br = 4 + Math.random() * 9;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(184, 114, 42, 0.35)' : 'rgba(255, 232, 185, 0.35)';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();

      bCtx.fillStyle = i % 2 === 0 ? '#a8a8a8' : '#666666';
      bCtx.beginPath();
      bCtx.arc(bx, by, br, 0, Math.PI * 2);
      bCtx.fill();
    }

    // Cracker docker holes grid
    for (let y = 38; y <= 218; y += 36) {
      for (let x = 38; x <= 218; x += 36) {
        ctx.fillStyle = '#6b3e15';
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();

        bCtx.fillStyle = '#151515';
        bCtx.beginPath();
        bCtx.arc(x, y, 5, 0, Math.PI * 2);
        bCtx.fill();
      }
    }
  } else {
    // Tank Mode: Iron Toast Biscuit (Thick porous cellular bread crumb texture)
    ctx.fillStyle = '#c8823b';
    ctx.fillRect(0, 0, 256, 256);
    bCtx.fillStyle = '#888888';
    bCtx.fillRect(0, 0, 256, 256);

    // Deep porous air cells all over the toast face
    for (let i = 0; i < 240; i++) {
      const px = Math.random() * 256;
      const py = Math.random() * 256;
      const pr = 1.8 + Math.random() * 5.2;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(84, 42, 10, 0.65)' : 'rgba(155, 88, 30, 0.45)';
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();

      bCtx.fillStyle = '#242424';
      bCtx.beginPath();
      bCtx.arc(px, py, pr * 1.1, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(0.75, 0.75);
  map.offset.set(0.5, 0.5);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(0.75, 0.75);
  bumpMap.offset.set(0.5, 0.5);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

/**
 * Generates a soft radial contact shadow texture.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(12, 5, 1, 0.72)');
  grad.addColorStop(0.55, 'rgba(18, 8, 2, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
