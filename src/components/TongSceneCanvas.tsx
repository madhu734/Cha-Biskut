import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BiscuitId,
  advanceSoakPercent,
  evaluateDip,
  BREAK_THRESHOLD,
  DipEvaluation,
} from '../game/rules';
import {
  createTeaCupGroup,
  createBiscuitGroup,
  createTongEnvironment,
  TeaCupRig,
  BiscuitRig,
} from '../game/models';
import { tongAudio } from '../game/audio';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

interface TongSceneCanvasProps {
  phase: GamePhase;
  biscuitId: BiscuitId;
  teaPercent: number;
  sludgeCount: number;
  combo: number;
  friendName: string;
  isHoldingInput: boolean;
  soakBarFillRef: React.RefObject<HTMLDivElement | null>;
  soakGhostFillRef: React.RefObject<HTMLDivElement | null>;
  soakTextRef: React.RefObject<HTMLSpanElement | null>;
  soakZoneLabelRef: React.RefObject<HTMLSpanElement | null>;
  onDipEvaluated: (result: DipEvaluation) => void;
  onSoakMilestoneChange: (bucket: number, isDipping: boolean) => void;
}

// Pre-allocated scratch math helpers outside the animation loop (Zero-GC discipline)
const _dummyObj = new THREE.Object3D();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 2.2, 0);

const STEAM_COUNT = 26;
const DROPLET_COUNT = 32;

interface SteamParticle {
  x: number;
  y: number;
  z: number;
  vy: number;
  vx: number;
  scale: number;
  life: number;
  maxLife: number;
}

interface DropletParticle {
  active: boolean;
  isCrumb: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  life: number;
  maxLife: number;
}

export const TongSceneCanvas: React.FC<TongSceneCanvasProps> = ({
  phase,
  biscuitId,
  teaPercent,
  sludgeCount,
  combo,
  friendName,
  isHoldingInput,
  soakBarFillRef,
  soakGhostFillRef,
  soakTextRef,
  soakZoneLabelRef,
  onDipEvaluated,
  onSoakMilestoneChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store mutable React props & callbacks in refs so the WebGL canvas never re-mounts
  const stateRef = useRef({
    phase,
    biscuitId,
    teaPercent,
    sludgeCount,
    combo,
    friendName,
    isHoldingInput,
    onDipEvaluated,
    onSoakMilestoneChange,
  });

  useEffect(() => {
    stateRef.current = {
      phase,
      biscuitId,
      teaPercent,
      sludgeCount,
      combo,
      friendName,
      isHoldingInput,
      onDipEvaluated,
      onSoakMilestoneChange,
    };
  }, [
    phase,
    biscuitId,
    teaPercent,
    sludgeCount,
    combo,
    friendName,
    isHoldingInput,
    onDipEvaluated,
    onSoakMilestoneChange,
  ]);

  const cupRigRef = useRef<TeaCupRig | null>(null);
  const biscuitRigMapRef = useRef<Record<BiscuitId, BiscuitRig> | null>(null);

  // Sync cup tea level & sludge when props change
  useEffect(() => {
    if (cupRigRef.current) {
      cupRigRef.current.setTeaPercent(teaPercent, sludgeCount);
    }
  }, [teaPercent, sludgeCount]);

  // Sync active biscuit model visibility when biscuitId changes
  useEffect(() => {
    const map = biscuitRigMapRef.current;
    if (!map) return;
    (['thin', 'cracker', 'toast'] as BiscuitId[]).forEach((id) => {
      map[id].group.visible = id === biscuitId;
      if (id === biscuitId) {
        map[id].resetBiscuit();
      }
    });
  }, [biscuitId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL (SwiftShader / llvmpipe) from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Fog & Studio RoomEnvironment
    const scene = new THREE.Scene();
    const bgHex = 0x180e07;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.048);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Camera
    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.1,
      60
    );
    camera.position.set(0, 4.4, 7.6);
    camera.lookAt(0, 2.1, 0);

    // 4. 3-Point Warm/Cool Studio Lighting Rig (<= 1 shadow caster)
    const hemiLight = new THREE.HemisphereLight(0xffdca8, 0x263248, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffb86c, 2.4);
    keyLight.position.set(4.5, 8.2, 5.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 20;
    const d = 5.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.SpotLight(0xff944d, 3.2, 18, Math.PI / 3, 0.5);
    rimLight.position.set(-4.2, 5.5, -4.5);
    scene.add(rimLight);

    const warmTableGlow = new THREE.PointLight(0xff8c3b, 1.4, 9);
    warmTableGlow.position.set(0, 3.2, 2.0);
    scene.add(warmTableGlow);

    // 5. Build Environment, Tea Cup & 3 Biscuit Rigs
    const envGroup = createTongEnvironment(isSoftwareGl, maxAniso);
    scene.add(envGroup);

    const cupRig = createTeaCupGroup(isSoftwareGl, maxAniso);
    scene.add(cupRig.group);
    cupRigRef.current = cupRig;

    const biscuitAnchor = new THREE.Group();
    biscuitAnchor.position.set(0, 4.05, 0);
    scene.add(biscuitAnchor);

    const biscuitMap: Record<BiscuitId, BiscuitRig> = {
      thin: createBiscuitGroup('thin', isSoftwareGl, maxAniso),
      cracker: createBiscuitGroup('cracker', isSoftwareGl, maxAniso),
      toast: createBiscuitGroup('toast', isSoftwareGl, maxAniso),
    };
    (['thin', 'cracker', 'toast'] as BiscuitId[]).forEach((id) => {
      biscuitMap[id].group.visible = id === stateRef.current.biscuitId;
      biscuitAnchor.add(biscuitMap[id].group);
    });
    biscuitRigMapRef.current = biscuitMap;

    // 6. Pooled InstancedMesh for Rising 3D Steam Particles (Cup + Kettle)
    const steamGeo = new THREE.IcosahedronGeometry(0.16, 1);
    const steamMat = new THREE.MeshBasicMaterial({
      color: 0xfff3e0,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const steamInstanced = new THREE.InstancedMesh(steamGeo, steamMat, STEAM_COUNT);
    steamInstanced.frustumCulled = false;
    steamInstanced.renderOrder = 8;
    scene.add(steamInstanced);

    const steamPool: SteamParticle[] = [];
    for (let i = 0; i < STEAM_COUNT; i++) {
      const fromKettle = i >= 20;
      steamPool.push({
        x: fromKettle ? -2.1 + (Math.random() - 0.5) * 0.2 : (Math.random() - 0.5) * 1.1,
        y: fromKettle ? 2.4 + Math.random() * 1.8 : 2.3 + Math.random() * 2.2,
        z: fromKettle ? -3.4 + (Math.random() - 0.5) * 0.2 : (Math.random() - 0.5) * 1.1,
        vy: 0.45 + Math.random() * 0.35,
        vx: (Math.random() - 0.5) * 0.2,
        scale: 0.4 + Math.random() * 0.7,
        life: Math.random() * 2.5,
        maxLife: 2.0 + Math.random() * 1.2,
      });
    }

    // 7. Pooled InstancedMesh for Tea Splash Droplets & Floating Crumbs
    const dropletGeo = new THREE.DodecahedronGeometry(0.055, 0);
    const dropletMat = new THREE.MeshStandardMaterial({
      color: 0xd9944e,
      roughness: 0.35,
      metalness: 0.05,
    });
    const dropletInstanced = new THREE.InstancedMesh(
      dropletGeo,
      dropletMat,
      DROPLET_COUNT
    );
    dropletInstanced.frustumCulled = false;
    scene.add(dropletInstanced);

    const dropletPool: DropletParticle[] = [];
    for (let i = 0; i < DROPLET_COUNT; i++) {
      dropletPool.push({
        active: false,
        isCrumb: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0,
        life: 0,
        maxLife: 1,
      });
    }

    const spawnSplashOrCrumbs = (
      count: number,
      originY: number,
      isBigSplash: boolean
    ) => {
      let spawned = 0;
      for (let i = 0; i < DROPLET_COUNT && spawned < count; i++) {
        const p = dropletPool[i];
        if (!p.active) {
          p.active = true;
          p.isCrumb = !isBigSplash;
          const angle = Math.random() * Math.PI * 2;
          const radius = isBigSplash ? 0.15 + Math.random() * 0.45 : 0.2 + Math.random() * 0.55;
          p.x = Math.cos(angle) * radius;
          p.y = originY + 0.04;
          p.z = Math.sin(angle) * radius;
          p.vx = Math.cos(angle) * (isBigSplash ? 1.2 + Math.random() * 1.8 : 0.25);
          p.vy = isBigSplash ? 2.4 + Math.random() * 2.6 : 0.15 + Math.random() * 0.25;
          p.vz = Math.sin(angle) * (isBigSplash ? 1.2 + Math.random() * 1.8 : 0.25);
          p.scale = isBigSplash ? 0.8 + Math.random() * 0.9 : 0.5 + Math.random() * 0.5;
          p.life = 0;
          p.maxLife = isBigSplash ? 0.75 : 0.9;
          spawned++;
        }
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Simulation state variables inside the animation loop
    const sim = {
      soakPercent: 0,
      ghostSoakPercent: 0,
      wasSubmerged: false,
      lastReportedBucket: -1,
      animMode: 'idle' as 'idle' | 'dipping' | 'eating' | 'snapping',
      animTimer: 0,
      cameraTrauma: 0,
      rippleAges: [99, 99, 99],
      nextRippleIdx: 0,
      crumbEmitTimer: 0,
      pointerX: 0,
      pointerY: 0,
    };

    const triggerRipple = () => {
      sim.rippleAges[sim.nextRippleIdx] = 0;
      sim.nextRippleIdx = (sim.nextRippleIdx + 1) % 3;
    };

    const updateSoakHudDOM = (soak: number, ghost: number) => {
      const clamped = Math.round(Math.min(100, Math.max(0, soak)));
      if (soakBarFillRef.current) {
        soakBarFillRef.current.style.width = `${clamped}%`;
        if (soak >= 70 && soak <= 92) {
          soakBarFillRef.current.style.backgroundColor = '#fbbf24';
        } else if (soak > 92) {
          soakBarFillRef.current.style.backgroundColor = '#ef4444';
        } else {
          soakBarFillRef.current.style.backgroundColor = '#d97706';
        }
      }
      if (soakGhostFillRef.current) {
        soakGhostFillRef.current.style.width = `${Math.round(ghost)}%`;
      }
      if (soakTextRef.current) {
        soakTextRef.current.textContent = `${clamped}%`;
      }
      if (soakZoneLabelRef.current) {
        if (clamped === 0) {
          soakZoneLabelRef.current.textContent = 'শুকনা (Dry)';
        } else if (clamped < 65) {
          soakZoneLabelRef.current.textContent = 'কাঁচা / শক্ত (<65%)';
        } else if (clamped >= 70 && clamped <= 92) {
          soakZoneLabelRef.current.textContent = 'অমৃত ডুব! (Sweet Spot ★)';
        } else if (clamped > 92) {
          soakZoneLabelRef.current.textContent = 'বিপদ! ভেঙে যাচ্ছে! (>93%)';
        } else {
          soakZoneLabelRef.current.textContent = 'প্রায় তৈরি...';
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        sim.pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        sim.pointerY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      }
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Software WebGL fenceSync frame pacer from threejs skill
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.25);
      const elapsed = now / 1000;

      const cur = stateRef.current;
      const activeBiscuit = biscuitMap[cur.biscuitId];
      const teaTopY = cupRig.teaSurfaceMesh.position.y;

      // 1. Camera Choreography with smooth exponential damping
      if (cur.phase === 'title') {
        _camTargetPos.set(
          Math.sin(elapsed * 0.35) * 0.9 + sim.pointerX * 0.4,
          4.35 + Math.cos(elapsed * 0.25) * 0.15 + sim.pointerY * 0.2,
          7.45
        );
        _camLookAt.set(-0.35, 2.05, 0);
      } else {
        // Active gameplay camera
        const dipZoomZ = cur.isHoldingInput ? 6.35 : 6.95;
        const dipCamY = cur.isHoldingInput ? 4.45 : 4.25;
        _camTargetPos.set(sim.pointerX * 0.22, dipCamY, dipZoomZ);
        _camLookAt.set(0, 2.05, 0);
      }

      // Apply decaying trauma^2 camera shake when a biscuit snaps into the cup!
      if (sim.cameraTrauma > 0) {
        const shake = sim.cameraTrauma * sim.cameraTrauma;
        _camTargetPos.x += (Math.random() - 0.5) * 0.65 * shake;
        _camTargetPos.y += (Math.random() - 0.5) * 0.55 * shake;
        sim.cameraTrauma = Math.max(0, sim.cameraTrauma - dt * 1.75);
      }

      const dampFactor = 1 - Math.exp(-6.5 * dt);
      camera.position.lerp(_camTargetPos, dampFactor);
      _currentLookAt.lerp(_camLookAt, dampFactor);
      camera.lookAt(_currentLookAt);

      // 2. Gameplay Dipping, Sogginess, Eating & Snapping State Machine
      if (cur.phase === 'playing') {
        if (sim.animMode === 'idle' || sim.animMode === 'dipping') {
          if (cur.isHoldingInput) {
            // Player is holding input to dip biscuit into the hot tea
            if (sim.animMode !== 'dipping') {
              sim.animMode = 'dipping';
              triggerRipple();
              spawnSplashOrCrumbs(5, teaTopY, false);
              tongAudio.startDippingSound();
            }

            const targetDipY = teaTopY - 0.08;
            biscuitAnchor.position.y = THREE.MathUtils.damp(
              biscuitAnchor.position.y,
              targetDipY,
              22,
              dt
            );

            // Advance soak % while holding & submerged
            if (biscuitAnchor.position.y <= teaTopY + 0.95) {
              const soakDt = Math.min(rawDt, 0.6);
              sim.soakPercent = advanceSoakPercent(
                sim.soakPercent,
                soakDt,
                cur.biscuitId
              );
              sim.ghostSoakPercent = Math.max(sim.ghostSoakPercent, sim.soakPercent);
              activeBiscuit.updateSogginess(sim.soakPercent);
              tongAudio.updateDippingProgress(sim.soakPercent);

              // Emit floating crumbs & periodic concentric ripples while soaking
              sim.crumbEmitTimer += dt;
              if (sim.crumbEmitTimer > 0.28) {
                sim.crumbEmitTimer = 0;
                triggerRipple();
                spawnSplashOrCrumbs(3, teaTopY, false);
              }

              // Structural integrity trembling as soak % increases
              const trembleIntensity =
                sim.soakPercent > 45
                  ? ((sim.soakPercent - 45) / 55) * 0.085
                  : 0.008;
              biscuitAnchor.position.x =
                (Math.random() - 0.5) * trembleIntensity;
              biscuitAnchor.rotation.z =
                (Math.random() - 0.5) * trembleIntensity * 1.4;

              // Notify parent only on coarse milestone buckets (avoid 60Hz setState)
              const bucket = Math.floor(sim.soakPercent / 20);
              if (bucket !== sim.lastReportedBucket) {
                sim.lastReportedBucket = bucket;
                cur.onSoakMilestoneChange(sim.soakPercent, true);
              }

              // Check Tragedy / Over-soaked (> 93%)
              if (sim.soakPercent >= BREAK_THRESHOLD) {
                tongAudio.stopDippingSound();
                tongAudio.playTragedySplashAndSadHorn();
                sim.animMode = 'snapping';
                sim.animTimer = 0;
                sim.cameraTrauma = 1.0;
                triggerRipple();
                spawnSplashOrCrumbs(20, teaTopY, true);

                const evalRes = evaluateDip(
                  sim.soakPercent,
                  cur.combo,
                  cur.biscuitId,
                  cur.friendName
                );
                cur.onDipEvaluated(evalRes);
              }
            }
          } else if (sim.animMode === 'dipping') {
            // Player released input! Pull biscuit up and evaluate dip
            tongAudio.stopDippingSound();
            const evalRes = evaluateDip(
              sim.soakPercent,
              cur.combo,
              cur.biscuitId,
              cur.friendName
            );

            if (evalRes.outcome === 'dry') {
              tongAudio.playDryCrunch();
            } else {
              tongAudio.playPerfectSlurpAndChime(evalRes.newCombo);
            }

            cur.onDipEvaluated(evalRes);
            cur.onSoakMilestoneChange(0, false);
            sim.lastReportedBucket = -1;
            sim.animMode = 'eating';
            sim.animTimer = 0;
          } else {
            // Idle hover above cup (framed cleanly below top HUD bar)
            biscuitAnchor.position.x = THREE.MathUtils.damp(
              biscuitAnchor.position.x,
              Math.sin(elapsed * 2.1) * 0.07,
              8,
              dt
            );
            biscuitAnchor.position.y = THREE.MathUtils.damp(
              biscuitAnchor.position.y,
              3.35 + Math.sin(elapsed * 3.0) * 0.05,
              8,
              dt
            );
            biscuitAnchor.rotation.z = THREE.MathUtils.damp(
              biscuitAnchor.rotation.z,
              Math.sin(elapsed * 1.6) * 0.04,
              8,
              dt
            );
            sim.ghostSoakPercent = Math.max(0, sim.ghostSoakPercent - dt * 38);
          }
        } else if (sim.animMode === 'eating') {
          // Pull biscuit up toward mouth with a cheerful bite scale animation
          sim.animTimer += dt;
          biscuitAnchor.position.y = THREE.MathUtils.damp(
            biscuitAnchor.position.y,
            4.1,
            14,
            dt
          );
          biscuitAnchor.position.x = THREE.MathUtils.damp(
            biscuitAnchor.position.x,
            0,
            12,
            dt
          );
          biscuitAnchor.rotation.z = THREE.MathUtils.damp(
            biscuitAnchor.rotation.z,
            0.15 * Math.sin(sim.animTimer * 18),
            12,
            dt
          );

          // Bite shrink steps
          const biteScale = Math.max(0.01, 1 - sim.animTimer * 2.2);
          activeBiscuit.group.scale.setScalar(biteScale);

          sim.soakPercent = Math.max(0, sim.soakPercent - dt * 220);
          sim.ghostSoakPercent = Math.max(0, sim.ghostSoakPercent - dt * 110);

          if (sim.animTimer >= 0.46) {
            sim.animMode = 'idle';
            sim.soakPercent = 0;
            activeBiscuit.group.scale.setScalar(1);
            activeBiscuit.resetBiscuit();
            biscuitAnchor.position.set(0, 3.55, 0);
          }
        } else if (sim.animMode === 'snapping') {
          // Bottom half detaches, tumbles into the tea, and sinks to the bottom!
          sim.animTimer += dt;
          biscuitAnchor.position.y = THREE.MathUtils.damp(
            biscuitAnchor.position.y,
            3.55,
            9,
            dt
          );
          biscuitAnchor.position.x = 0;
          biscuitAnchor.rotation.z = 0;

          // Detach bottomHalfGroup downward into the cup
          activeBiscuit.bottomHalfGroup.position.y -= dt * 3.1;
          activeBiscuit.bottomHalfGroup.rotation.x += dt * 4.5;
          activeBiscuit.bottomHalfGroup.rotation.z -= dt * 3.2;

          sim.soakPercent = Math.max(0, sim.soakPercent - dt * 150);

          if (sim.animTimer >= 0.78) {
            sim.animMode = 'idle';
            sim.soakPercent = 0;
            sim.ghostSoakPercent = 0;
            activeBiscuit.resetBiscuit();
            biscuitAnchor.position.set(0, 3.55, 0);
            cur.onSoakMilestoneChange(0, false);
          }
        }
      } else {
        // Title / Paused / Gameover gentle showcase motion
        tongAudio.stopDippingSound();
        biscuitAnchor.position.x = Math.sin(elapsed * 1.5) * 0.1;
        biscuitAnchor.position.y = 3.38 + Math.sin(elapsed * 2.4) * 0.06;
        biscuitAnchor.rotation.y = Math.sin(elapsed * 0.9) * 0.28;
        biscuitAnchor.rotation.z = Math.cos(elapsed * 1.3) * 0.05;
      }

      updateSoakHudDOM(sim.soakPercent, sim.ghostSoakPercent);

      // 3. Update Concentric Tea Surface Ripple Rings
      cupRig.rippleRings.forEach((ring, idx) => {
        const age = sim.rippleAges[idx];
        const mat = ring.material as THREE.MeshBasicMaterial;
        if (age < 1.2) {
          sim.rippleAges[idx] += dt;
          const progress = sim.rippleAges[idx] / 1.2;
          const s = 0.4 + progress * 3.8;
          ring.scale.set(s, s, 1);
          mat.opacity = (1 - progress) * 0.65;
        } else {
          mat.opacity = 0;
        }
      });

      // 4. Update Rising 3D Steam Particles (Zero-GC InstancedMesh)
      for (let i = 0; i < STEAM_COUNT; i++) {
        const sp = steamPool[i];
        sp.life += dt;
        if (sp.life >= sp.maxLife) {
          sp.life = 0;
          const fromKettle = i >= 20;
          sp.x = fromKettle
            ? -2.15 + (Math.random() - 0.5) * 0.16
            : (Math.random() - 0.5) * 1.1;
          sp.y = fromKettle ? 2.38 : teaTopY + 0.08;
          sp.z = fromKettle
            ? -3.4 + (Math.random() - 0.5) * 0.16
            : (Math.random() - 0.5) * 1.1;
        }
        const progress = sp.life / sp.maxLife;
        sp.y += sp.vy * dt;
        sp.x += Math.sin(elapsed * 2 + i) * 0.15 * dt;
        const curScale = sp.scale * Math.sin(progress * Math.PI);

        _dummyObj.position.set(sp.x, sp.y, sp.z);
        _dummyObj.scale.setScalar(Math.max(0.001, curScale));
        _dummyObj.rotation.set(elapsed + i, elapsed * 0.5, 0);
        _dummyObj.updateMatrix();
        steamInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      steamInstanced.instanceMatrix.needsUpdate = true;

      // 5. Update Splash Droplets & Floating Crumbs (Zero-GC InstancedMesh)
      for (let i = 0; i < DROPLET_COUNT; i++) {
        const dp = dropletPool[i];
        if (!dp.active) {
          _dummyObj.position.set(0, -20, 0);
          _dummyObj.scale.setScalar(0.001);
          _dummyObj.updateMatrix();
          dropletInstanced.setMatrixAt(i, _dummyObj.matrix);
          continue;
        }
        dp.life += dt;
        if (dp.life >= dp.maxLife) {
          dp.active = false;
          continue;
        }
        if (dp.isCrumb) {
          // Floating biscuit crumbs drift gently on the tea surface
          dp.x += dp.vx * dt * 0.3;
          dp.z += dp.vz * dt * 0.3;
          dp.y = teaTopY + 0.02;
        } else {
          // Ballistic splash droplets
          dp.vy -= 9.8 * dt;
          dp.x += dp.vx * dt;
          dp.y += dp.vy * dt;
          dp.z += dp.vz * dt;
        }
        const s = dp.scale * (1 - dp.life / dp.maxLife);
        _dummyObj.position.set(dp.x, dp.y, dp.z);
        _dummyObj.scale.setScalar(Math.max(0.001, s));
        _dummyObj.rotation.set(dp.life * 6, dp.life * 4, 0);
        _dummyObj.updateMatrix();
        dropletInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      dropletInstanced.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      resizeObserver.disconnect();
      tongAudio.stopDippingSound();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="tong-webgl-canvas"
      className="fixed inset-0 w-screen h-screen overflow-hidden"
    />
  );
};
