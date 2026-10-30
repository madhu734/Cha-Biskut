import * as THREE from 'three';
import { BiscuitId, BISCUIT_SPECS } from './rules';
import { createBiscuitTextures, createContactShadowTexture, createWoodTableTextures } from './textures';

export interface TeaCupRig {
  group: THREE.Group;
  teaLiquidMesh: THREE.Mesh;
  teaSurfaceMesh: THREE.Mesh;
  foamRingMesh: THREE.Mesh;
  rippleRings: THREE.Mesh[];
  sludgeChunks: THREE.Group[];
  setTeaPercent: (percent: number, sludgeCount: number) => void;
}

/**
 * Builds the classic Bangladeshi Tong Glass Cup (টংয়ের চায়ের কাপ) as a composite
 * 9-part procedural THREE.Group with fluted glass facets, brass saucer, dynamic milk tea,
 * foam meniscus, concentric surface ripples, and submerged biscuit sludge chunks.
 */
export function createTeaCupGroup(
  isSoftwareGl: boolean,
  maxAnisotropy: number
): TeaCupRig {
  const group = new THREE.Group();

  // 1. Decorative Brass Saucer / Coaster at base (Part 1 & 2)
  const saucerPoints: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.25, 0.0),
    new THREE.Vector2(1.55, 0.12),
    new THREE.Vector2(1.62, 0.16),
    new THREE.Vector2(1.52, 0.19),
    new THREE.Vector2(1.18, 0.07),
    new THREE.Vector2(0.0, 0.07),
  ];
  const saucerGeo = new THREE.LatheGeometry(saucerPoints, 36);
  const saucerMat = new THREE.MeshStandardMaterial({
    color: 0xc8963e,
    roughness: 0.32,
    metalness: 0.78,
  });
  const saucerMesh = new THREE.Mesh(saucerGeo, saucerMat);
  saucerMesh.receiveShadow = !isSoftwareGl;
  saucerMesh.castShadow = !isSoftwareGl;
  group.add(saucerMesh);

  // Inner saucer recessed ring (Part 2 - varied roughness)
  const innerSaucerGeo = new THREE.CylinderGeometry(1.08, 1.05, 0.03, 32);
  const innerSaucerMat = new THREE.MeshStandardMaterial({
    color: 0x8c6223,
    roughness: 0.65,
    metalness: 0.45,
  });
  const innerSaucer = new THREE.Mesh(innerSaucerGeo, innerSaucerMat);
  innerSaucer.position.y = 0.075;
  group.add(innerSaucer);

  // 2. Heavy Solid Glass Base of the Tong Cup (Part 3)
  const glassBaseGeo = new THREE.CylinderGeometry(0.92, 0.84, 0.36, 12);
  const glassBaseMat = new THREE.MeshPhysicalMaterial({
    color: 0xeef7f2,
    roughness: 0.12,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.88,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 0.95,
    ior: 1.52,
    thickness: 1.2,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const glassBase = new THREE.Mesh(glassBaseGeo, glassBaseMat);
  glassBase.position.y = 0.26;
  glassBase.renderOrder = 4;
  group.add(glassBase);

  // 3. Outer Fluted Glass Wall (Part 4 - iconic 12-faceted Tong glass cup)
  const cupProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.84, 0.08),
    new THREE.Vector2(0.93, 0.42),
    new THREE.Vector2(1.08, 1.55),
    new THREE.Vector2(1.18, 2.52),
    new THREE.Vector2(1.21, 2.62),
    new THREE.Vector2(1.13, 2.62),
    new THREE.Vector2(1.02, 1.52),
    new THREE.Vector2(0.87, 0.42),
  ];
  const cupOuterGeo = new THREE.LatheGeometry(cupProfile, 14);
  const cupGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4faf7,
    roughness: 0.08,
    metalness: 0.02,
    transmission: isSoftwareGl ? 0 : 0.92,
    transparent: true,
    opacity: isSoftwareGl ? 0.28 : 0.92,
    ior: 1.54,
    thickness: 0.65,
    attenuationColor: new THREE.Color(0xdff5ec),
    attenuationDistance: 2.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const cupGlassMesh = new THREE.Mesh(cupOuterGeo, cupGlassMat);
  cupGlassMesh.renderOrder = 6;
  group.add(cupGlassMesh);

  // 4. Glass Rim Lip Highlight Ring (Part 5)
  const rimGeo = new THREE.TorusGeometry(1.17, 0.045, 12, 36);
  rimGeo.rotateX(Math.PI / 2);
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.62,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.position.y = 2.62;
  rimMesh.renderOrder = 7;
  group.add(rimMesh);

  // 5. Creamy Milk Tea ("দুধ চা") Liquid Body (Part 6)
  const teaGeo = new THREE.CylinderGeometry(1.09, 0.87, 1.85, 32);
  // Shift geometry so pivot is at bottom (y = 0..1.85)
  teaGeo.translate(0, 0.925, 0);
  const teaMat = new THREE.MeshStandardMaterial({
    color: 0xc67d43, // Rich creamy Karak/Tong milk tea color
    roughness: 0.22,
    metalness: 0.04,
  });
  const teaLiquidMesh = new THREE.Mesh(teaGeo, teaMat);
  teaLiquidMesh.position.y = 0.42;
  teaLiquidMesh.renderOrder = 2;
  group.add(teaLiquidMesh);

  // 6. Dynamic Tea Top Surface Disc (Part 7)
  const surfaceGeo = new THREE.CircleGeometry(1.08, 36);
  surfaceGeo.rotateX(-Math.PI / 2);
  const surfaceMat = new THREE.MeshPhysicalMaterial({
    color: 0xd58c50,
    roughness: 0.12,
    metalness: 0.05,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });
  const teaSurfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
  teaSurfaceMesh.position.y = 2.27;
  teaSurfaceMesh.renderOrder = 3;
  group.add(teaSurfaceMesh);

  // 7. Creamy Milk Foam Meniscus Ring along inner glass wall (Part 8)
  const foamGeo = new THREE.RingGeometry(0.94, 1.085, 36);
  foamGeo.rotateX(-Math.PI / 2);
  const foamMat = new THREE.MeshStandardMaterial({
    color: 0xf4dec1,
    roughness: 0.65,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const foamRingMesh = new THREE.Mesh(foamGeo, foamMat);
  foamRingMesh.position.y = 2.275;
  foamRingMesh.renderOrder = 3;
  group.add(foamRingMesh);

  // 8. Concentric Ripple Rings on the Tea Surface
  const rippleRings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const rGeo = new THREE.RingGeometry(0.18, 0.23, 32);
    rGeo.rotateX(-Math.PI / 2);
    const rMat = new THREE.MeshBasicMaterial({
      color: 0xfcead2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const rMesh = new THREE.Mesh(rGeo, rMat);
    rMesh.position.y = 2.282;
    rMesh.renderOrder = 5;
    group.add(rMesh);
    rippleRings.push(rMesh);
  }

  // 9. Submerged Broken Biscuit Sludge Chunks ("চায়ের তলানি") at Bottom of Cup
  const sludgeChunks: THREE.Group[] = [];
  const sludgeMat = new THREE.MeshStandardMaterial({
    color: 0x5c3312,
    roughness: 0.92,
    metalness: 0.0,
  });
  for (let s = 0; s < 3; s++) {
    const chunkGroup = new THREE.Group();
    const mainSludge = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.22, 0.42),
      sludgeMat
    );
    mainSludge.rotation.set(
      (s - 1) * 0.18,
      s * 1.1,
      (s % 2 === 0 ? 1 : -1) * 0.15
    );
    const subSludge = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      sludgeMat
    );
    subSludge.position.set(0.24, 0.06, -0.12);
    chunkGroup.add(mainSludge, subSludge);
    chunkGroup.position.set(
      (s - 1) * 0.18,
      0.52 + s * 0.18,
      (s % 2 === 0 ? 0.1 : -0.1)
    );
    chunkGroup.visible = false;
    chunkGroup.renderOrder = 2;
    group.add(chunkGroup);
    sludgeChunks.push(chunkGroup);
  }

  // Helper to update tea liquid level & sludge appearance
  const setTeaPercent = (percent: number, sludgeCount: number) => {
    const clamped = Math.max(8, Math.min(100, percent));
    const scaleY = clamped / 100;
    teaLiquidMesh.scale.y = scaleY;
    const topY = 0.42 + 1.85 * scaleY;
    const radiusScale = 0.82 + 0.18 * scaleY;

    teaSurfaceMesh.position.y = topY;
    teaSurfaceMesh.scale.set(radiusScale, 1, radiusScale);

    foamRingMesh.position.y = topY + 0.005;
    foamRingMesh.scale.set(radiusScale, 1, radiusScale);

    rippleRings.forEach((r) => {
      r.position.y = topY + 0.01;
    });

    // Darken tea into thick muddy sludge as broken biscuits accumulate
    const baseTeaColor = new THREE.Color(0xc67d43);
    const sludgeTeaColor = new THREE.Color(0x6e3f19);
    const muddyFactor = Math.min(1, sludgeCount / 3);
    teaMat.color.copy(baseTeaColor).lerp(sludgeTeaColor, muddyFactor * 0.75);
    surfaceMat.color.copy(new THREE.Color(0xd58c50)).lerp(sludgeTeaColor, muddyFactor * 0.75);

    sludgeChunks.forEach((chunk, idx) => {
      chunk.visible = idx < sludgeCount;
    });
  };

  setTeaPercent(100, 0);

  return {
    group,
    teaLiquidMesh,
    teaSurfaceMesh,
    foamRingMesh,
    rippleRings,
    sludgeChunks,
    setTeaPercent,
  };
}

export interface BiscuitRig {
  group: THREE.Group;
  topHalfGroup: THREE.Group;
  bottomHalfGroup: THREE.Group;
  goldenGlowMesh: THREE.Mesh;
  updateSogginess: (soakPercent: number) => void;
  resetBiscuit: () => void;
}

/**
 * Creates a composite multi-part 3D Biscuit with separate Top & Bottom halves
 * so the bottom half dynamically darkens, swells when soggy, and physically detaches
 * and sinks to the bottom of the cup when over-soaked (> 93%).
 */
export function createBiscuitGroup(
  type: BiscuitId,
  isSoftwareGl: boolean,
  maxAnisotropy: number
): BiscuitRig {
  const spec = BISCUIT_SPECS[type];
  const { map, bumpMap } = createBiscuitTextures(type, maxAnisotropy);

  const group = new THREE.Group();
  const topHalfGroup = new THREE.Group();
  const bottomHalfGroup = new THREE.Group();

  const dryMatTop = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    bumpMap,
    bumpScale: 0.035,
    roughness: type === 'toast' ? 0.88 : 0.72,
    metalness: 0.02,
  });

  // Bottom half has its own cloned material so we can dynamically darken it as it soaks!
  const soggyMatBottom = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    bumpMap,
    bumpScale: 0.035,
    roughness: type === 'toast' ? 0.88 : 0.72,
    metalness: 0.02,
  });

  const crustTrimMatTop = new THREE.MeshStandardMaterial({
    color: type === 'toast' ? 0x7d4416 : 0xb87632,
    roughness: 0.55,
    metalness: 0.05,
  });

  const crustTrimMatBottom = new THREE.MeshStandardMaterial({
    color: type === 'toast' ? 0x7d4416 : 0xb87632,
    roughness: 0.55,
    metalness: 0.05,
  });

  // Dimensions by biscuit difficulty
  const width = type === 'thin' ? 1.12 : type === 'cracker' ? 1.18 : 1.24;
  const halfHeight = type === 'thin' ? 0.64 : type === 'cracker' ? 0.62 : 0.68;
  const thickness = type === 'thin' ? 0.14 : type === 'cracker' ? 0.20 : 0.40;

  // Build rounded beveled extruded half-slab
  const makeHalfSlab = (isTop: boolean, bodyMat: THREE.Material, rimMat: THREE.Material, targetGroup: THREE.Group) => {
    const yMin = isTop ? -0.01 : -halfHeight;
    const yMax = isTop ? halfHeight : 0.01;
    const hw = width * 0.5;

    const shape = new THREE.Shape();
    const r = 0.09;
    shape.moveTo(-hw + r, yMin);
    shape.lineTo(hw - r, yMin);
    shape.quadraticCurveTo(hw, yMin, hw, yMin + (isTop ? 0.01 : r));
    shape.lineTo(hw, yMax - (isTop ? r : 0.01));
    shape.quadraticCurveTo(hw, yMax, hw - r, yMax);
    shape.lineTo(-hw + r, yMax);
    shape.quadraticCurveTo(-hw, yMax, -hw, yMax - (isTop ? r : 0.01));
    shape.lineTo(-hw, yMin + (isTop ? 0.01 : r));
    shape.quadraticCurveTo(-hw, yMin, -hw + r, yMin);

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.028,
      bevelThickness: 0.028,
    });
    extrudeGeo.translate(0, 0, -thickness * 0.5);

    const mainMesh = new THREE.Mesh(extrudeGeo, bodyMat);
    mainMesh.castShadow = !isSoftwareGl;
    mainMesh.receiveShadow = !isSoftwareGl;
    targetGroup.add(mainMesh);

    // Secondary details per biscuit type (Composite 6-10 parts)
    if (type === 'thin') {
      // Scalloped decorative ribs & embossed ridges
      for (let i = -2; i <= 2; i++) {
        const ribGeo = new THREE.BoxGeometry(width * 0.76, 0.045, thickness + 0.085);
        const rib = new THREE.Mesh(ribGeo, rimMat);
        rib.position.set(0, (isTop ? 0.16 : -0.16) + i * 0.12, 0);
        targetGroup.add(rib);
      }
    } else if (type === 'cracker') {
      // Embossed docker pins & salt/sugar crystals on surface
      const pinPositions = [
        [-0.32, isTop ? 0.24 : -0.24],
        [0, isTop ? 0.24 : -0.24],
        [0.32, isTop ? 0.24 : -0.24],
        [-0.22, isTop ? 0.52 : -0.52],
        [0.22, isTop ? 0.52 : -0.52],
      ];
      pinPositions.forEach(([px, py]) => {
        const holeMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, thickness + 0.09, 10),
          rimMat
        );
        holeMesh.rotation.x = Math.PI / 2;
        holeMesh.position.set(px, py, 0);
        targetGroup.add(holeMesh);
      });
    } else {
      // Toast Biscuit: Thick dark baked crust outer wrap + sugar crystals
      const sideCrustLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, halfHeight * 0.96, thickness + 0.09),
        rimMat
      );
      sideCrustLeft.position.set(-hw - 0.02, isTop ? halfHeight * 0.5 : -halfHeight * 0.5, 0);
      const sideCrustRight = sideCrustLeft.clone();
      sideCrustRight.position.x = hw + 0.02;

      const endCrust = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.12, 0.12, thickness + 0.09),
        rimMat
      );
      endCrust.position.set(0, isTop ? halfHeight + 0.02 : -halfHeight - 0.02, 0);
      targetGroup.add(sideCrustLeft, sideCrustRight, endCrust);
    }
  };

  makeHalfSlab(true, dryMatTop, crustTrimMatTop, topHalfGroup);
  makeHalfSlab(false, soggyMatBottom, crustTrimMatBottom, bottomHalfGroup);

  group.add(topHalfGroup);
  group.add(bottomHalfGroup);

  // Golden Sweet-Spot Halo Glow Ring around the biscuit
  const glowGeo = new THREE.RingGeometry(0.85, 1.15, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffcf40,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const goldenGlowMesh = new THREE.Mesh(glowGeo, glowMat);
  goldenGlowMesh.position.z = -0.15;
  group.add(goldenGlowMesh);

  const dryBaseColor = new THREE.Color(0xffffff);
  const wetTintColor = new THREE.Color(0x6e3f1b);
  const dryRimColor = new THREE.Color(type === 'toast' ? 0x7d4416 : 0xb87632);
  const wetRimColor = new THREE.Color(0x3b1f09);

  const updateSogginess = (soakPercent: number) => {
    const t = Math.min(1, Math.max(0, soakPercent / 100));
    soggyMatBottom.color.copy(dryBaseColor).lerp(wetTintColor, t * 0.85);
    soggyMatBottom.roughness = THREE.MathUtils.lerp(
      type === 'toast' ? 0.88 : 0.72,
      0.24,
      t
    );
    crustTrimMatBottom.color.copy(dryRimColor).lerp(wetRimColor, t * 0.85);

    // Swell the submerged bottom half slightly as it absorbs hot milk tea
    const swellXY = 1 + t * 0.13;
    const swellZ = 1 + t * 0.22;
    bottomHalfGroup.scale.set(swellXY, 1 + t * 0.06, swellZ);

    // Sweet Spot Golden Glow between 70% and 92%
    if (soakPercent >= 70 && soakPercent <= 92) {
      glowMat.opacity = 0.55;
      glowMat.color.setHex(0xffd24c);
    } else if (soakPercent > 92) {
      glowMat.opacity = 0.65;
      glowMat.color.setHex(0xef4444);
    } else {
      glowMat.opacity = 0;
    }
  };

  const resetBiscuit = () => {
    topHalfGroup.position.set(0, 0, 0);
    topHalfGroup.rotation.set(0, 0, 0);
    topHalfGroup.scale.set(1, 1, 1);
    topHalfGroup.visible = true;

    bottomHalfGroup.position.set(0, 0, 0);
    bottomHalfGroup.rotation.set(0, 0, 0);
    bottomHalfGroup.scale.set(1, 1, 1);
    bottomHalfGroup.visible = true;

    updateSogginess(0);
  };

  return {
    group,
    topHalfGroup,
    bottomHalfGroup,
    goldenGlowMesh,
    updateSogginess,
    resetBiscuit,
  };
}

/**
 * Creates the cozy Bangladeshi Tong-er Dokan wooden table environment,
 * contact shadows, and background props (vintage aluminum tea kettle & biscuit jar).
 */
export function createTongEnvironment(
  isSoftwareGl: boolean,
  maxAnisotropy: number
): THREE.Group {
  const envGroup = new THREE.Group();
  const { map: woodMap, bumpMap: woodBump } = createWoodTableTextures(maxAnisotropy);
  const shadowTex = createContactShadowTexture();

  // 1. Rustic Tong Wooden Table Top
  const tableGeo = new THREE.BoxGeometry(18, 0.5, 12);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: woodMap,
    bumpMap: woodBump,
    bumpScale: 0.04,
    roughness: 0.78,
    metalness: 0.04,
  });
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.position.set(0, -0.25, 0);
  tableMesh.receiveShadow = !isSoftwareGl;
  envGroup.add(tableMesh);

  // 2. Soft Radial Contact Shadow under the Tea Cup (offset >= 0.015 on Y)
  const cupShadowGeo = new THREE.PlaneGeometry(3.8, 3.8);
  cupShadowGeo.rotateX(-Math.PI / 2);
  const cupShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const cupShadow = new THREE.Mesh(cupShadowGeo, cupShadowMat);
  cupShadow.position.set(0, 0.016, 0);
  envGroup.add(cupShadow);

  // 3. Background Prop: Multi-Part Vintage Bangladeshi Tong Aluminum Kettle (চায়ের কেতলি)
  const kettleGroup = new THREE.Group();
  const aluMat = new THREE.MeshStandardMaterial({
    color: 0xd0d5dd,
    roughness: 0.35,
    metalness: 0.82,
  });
  const sootMat = new THREE.MeshStandardMaterial({
    color: 0x38322e,
    roughness: 0.85,
    metalness: 0.25,
  });
  const brassKnobMat = new THREE.MeshStandardMaterial({
    color: 0xd49b3b,
    roughness: 0.28,
    metalness: 0.85,
  });

  const kettleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.45, 1.85, 24),
    aluMat
  );
  kettleBody.position.y = 0.95;
  const kettleBaseSoot = new THREE.Mesh(
    new THREE.CylinderGeometry(1.46, 1.42, 0.38, 24),
    sootMat
  );
  kettleBaseSoot.position.y = 0.19;
  const kettleShoulder = new THREE.Mesh(
    new THREE.SphereGeometry(1.16, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
    aluMat
  );
  kettleShoulder.position.y = 1.65;
  const kettleLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.62, 0.15, 20),
    brassKnobMat
  );
  kettleLid.position.y = 2.62;
  const kettleKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    sootMat
  );
  kettleKnob.position.y = 2.78;

  // Kettle Spout
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.1, 1.1, 0),
    new THREE.Vector3(-1.85, 1.65, 0),
    new THREE.Vector3(-2.15, 2.35, 0),
  ]);
  const spoutGeo = new THREE.TubeGeometry(spoutCurve, 12, 0.22, 12, false);
  const kettleSpout = new THREE.Mesh(spoutGeo, aluMat);

  // Kettle Arch Handle
  const handleGeo = new THREE.TorusGeometry(0.95, 0.09, 10, 24, Math.PI);
  const kettleHandle = new THREE.Mesh(handleGeo, sootMat);
  kettleHandle.position.y = 2.4;

  kettleGroup.add(
    kettleBody,
    kettleBaseSoot,
    kettleShoulder,
    kettleLid,
    kettleKnob,
    kettleSpout,
    kettleHandle
  );
  kettleGroup.position.set(-4.2, 0, -3.4);
  kettleGroup.rotation.y = 0.45;
  envGroup.add(kettleGroup);

  const kettleShadow = new THREE.Mesh(cupShadowGeo, cupShadowMat);
  kettleShadow.position.set(-4.2, 0.016, -3.4);
  kettleShadow.scale.setScalar(1.15);
  envGroup.add(kettleShadow);

  // 4. Background Prop: Glass Biscuit Bhar / Jar on Right Side
  const jarGroup = new THREE.Group();
  const jarBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 2.1, 16),
    new THREE.MeshPhysicalMaterial({
      color: 0xfaf6f0,
      roughness: 0.15,
      transmission: isSoftwareGl ? 0 : 0.8,
      transparent: true,
      opacity: isSoftwareGl ? 0.35 : 0.85,
      depthWrite: false,
    })
  );
  jarBody.position.y = 1.05;
  const jarLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.85, 0.28, 16),
    new THREE.MeshStandardMaterial({
      color: 0xc83e2b,
      roughness: 0.42,
      metalness: 0.3,
    })
  );
  jarLid.position.y = 2.22;

  // Stacked biscuits inside the jar
  const innerBiscuitMat = new THREE.MeshStandardMaterial({
    color: 0xd99b52,
    roughness: 0.75,
  });
  for (let b = 0; b < 5; b++) {
    const bMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 0.22, 12),
      innerBiscuitMat
    );
    bMesh.position.set(0, 0.28 + b * 0.28, 0);
    bMesh.rotation.y = b * 0.4;
    jarGroup.add(bMesh);
  }
  jarGroup.add(jarBody, jarLid);
  jarGroup.position.set(4.1, 0, -3.1);
  envGroup.add(jarGroup);

  const jarShadow = new THREE.Mesh(cupShadowGeo, cupShadowMat);
  jarShadow.position.set(4.1, 0.016, -3.1);
  jarShadow.scale.setScalar(0.85);
  envGroup.add(jarShadow);

  // 5. Warm Roadside Tong Bokeh Lights in the Deep Background
  const bokehColors = [0xffb74d, 0xff8a65, 0xffe082, 0xffca28];
  const bokehPositions = [
    [-6.5, 4.2, -8.5, 0.55],
    [-3.2, 5.1, -9.2, 0.72],
    [0.5, 4.8, -9.8, 0.65],
    [3.8, 5.3, -9.0, 0.75],
    [6.8, 3.9, -8.2, 0.5],
    [-1.5, 3.2, -8.6, 0.42],
    [2.4, 3.5, -8.4, 0.48],
  ];
  bokehPositions.forEach(([bx, by, bz, br], i) => {
    const bMesh = new THREE.Mesh(
      new THREE.SphereGeometry(br, 16, 16),
      new THREE.MeshBasicMaterial({
        color: bokehColors[i % bokehColors.length],
        transparent: true,
        opacity: 0.28,
      })
    );
    bMesh.position.set(bx, by, bz);
    envGroup.add(bMesh);
  });

  return envGroup;
}
