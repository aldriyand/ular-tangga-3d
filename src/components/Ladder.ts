/**
 * Ladder visual. Slice 3: 7 stylized procedural 3D monuments, one per
 * cultural site in the design doc. Each monument is a self-contained
 * group of meshes that can be placed between any two squares.
 *
 * Sites (designed from iconic photo references):
 *   - Candi Borobudur:    tiered stupa temple
 *   - Candi Prambanan:    narrow Hindu temple tower with stepped roof
 *   - Istana Maimun:      low yellow palace with central dome + minarets
 *   - Benteng Rotterdam:  square Dutch fort with corner towers
 *   - Monas:              tall obelisk with flame on top
 *   - Candi Sewu:         cluster of small stupas
 *   - Taman Nasional Komodo: dragon gate with pillars
 *
 * All monuments are built around a unit "monument anchor" placed at the
 * midpoint between the from and to squares, scaled by the length of the
 * climb so longer ladders have taller monuments.
 */
import * as THREE from 'three';
import type { Ladder as LadderData } from '../data/board';
import { squareToWorld } from '../data/path';

type LadderStyle = 'borobudur' | 'prambanan' | 'maimun' | 'rotterdam' | 'monas' | 'sewu' | 'komodo';

interface LadderStyleSpec {
  readonly style: LadderStyle;
  readonly primary: number;
  readonly secondary: number;
  readonly accent: number;
}

const LADDER_STYLES: Record<string, LadderStyleSpec> = {
  'Candi Borobudur':       { style: 'borobudur', primary: 0x9B8E7A, secondary: 0x7A6E58, accent: 0x4A3F30 },
  'Candi Prambanan':       { style: 'prambanan', primary: 0xA89A7E, secondary: 0x8B5A2B, accent: 0xC41E3A },
  'Istana Maimun':         { style: 'maimun',    primary: 0xE5B14A, secondary: 0x2D5A27, accent: 0x1B2A4A },
  'Benteng Rotterdam':     { style: 'rotterdam', primary: 0xE8DCC0, secondary: 0xC41E3A, accent: 0x6B4423 },
  'Monas':                 { style: 'monas',     primary: 0xF0EBE2, secondary: 0xC0B8A8, accent: 0xD4A843 },
  'Candi Sewu':            { style: 'sewu',      primary: 0x8E8068, secondary: 0x6B5E48, accent: 0x4A3F30 },
  'Taman Nasional Komodo': { style: 'komodo',    primary: 0x6B5D4A, secondary: 0x2D5A27, accent: 0xC41E3A }
};

export class Ladder {
  readonly data: LadderData;
  readonly group: THREE.Group;
  private spec: LadderStyleSpec;
  /** Path along the monument: bottom anchor → top anchor, climbing motion. */
  private climbPath: THREE.CatmullRomCurve3;

  constructor(data: LadderData) {
    this.data = data;
    this.spec = LADDER_STYLES[data.name] ?? { style: 'borobudur', primary: 0xD4A843, secondary: 0x1B2A4A, accent: 0xC41E3A };
    this.group = new THREE.Group();
    this.group.name = `Ladder-${data.name}`;

    const start = squareToWorld(data.from);
    const end = squareToWorld(data.to);
    const length = start.distanceTo(end);

    // Place the monument at the midpoint, rotated to face the climb direction
    const mid = new THREE.Vector3().copy(start).lerp(end, 0.5);
    const monumentGroup = new THREE.Group();
    monumentGroup.position.copy(mid);
    // Face perpendicular to the climb direction
    const facing = new THREE.Vector3().subVectors(end, start).normalize();
    const angle = Math.atan2(facing.x, facing.z);
    monumentGroup.rotation.y = angle;

    // Scale by length so longer climbs have taller monuments (capped)
    const heightScale = Math.min(1.8, 0.7 + length * 0.12);
    monumentGroup.scale.set(1, heightScale, 1);

    // Build the monument per style
    this.buildMonument(monumentGroup, length, heightScale);

    this.group.add(monumentGroup);

    // Build the climb path: from start, up through the monument, to end
    // The path is at the center of the monument, with a slight S so the
    // pion appears to climb up the structure
    const startAnchor = start.clone();
    startAnchor.y = start.y + 0.1;
    const topAnchor = end.clone();
    topAnchor.y = end.y + 0.1;
    const midHigh = mid.clone();
    midHigh.y = mid.y + length * 0.6;
    const midOffset = new THREE.Vector3(-facing.z, 0, facing.x).multiplyScalar(length * 0.05);
    this.climbPath = new THREE.CatmullRomCurve3([
      startAnchor,
      mid.clone().add(midOffset).add(new THREE.Vector3(0, length * 0.3, 0)),
      midHigh,
      mid.clone().sub(midOffset).add(new THREE.Vector3(0, length * 0.5, 0)),
      topAnchor
    ], false, 'catmullrom', 0.5);
  }

  /** Expose the climb path so the Game can animate a pion climbing. */
  getPath(): THREE.Curve<THREE.Vector3> { return this.climbPath; }

  // -------------------------------------------------------------------------
  // Monument builders
  // -------------------------------------------------------------------------

  private buildMonument(group: THREE.Group, length: number, scale: number): void {
    const pMat = new THREE.MeshStandardMaterial({ color: this.spec.primary, roughness: 0.7, metalness: 0.05 });
    const sMat = new THREE.MeshStandardMaterial({ color: this.spec.secondary, roughness: 0.6, metalness: 0.1 });
    const aMat = new THREE.MeshStandardMaterial({ color: this.spec.accent, roughness: 0.5, metalness: 0.2 });

    switch (this.spec.style) {
      case 'borobudur':   return this.buildBorobudur(group, pMat, sMat, aMat, length, scale);
      case 'prambanan':   return this.buildPrambanan(group, pMat, sMat, aMat, length, scale);
      case 'maimun':      return this.buildMaimun(group, pMat, sMat, aMat, length, scale);
      case 'rotterdam':   return this.buildRotterdam(group, pMat, sMat, aMat, length, scale);
      case 'monas':       return this.buildMonas(group, pMat, sMat, aMat, length, scale);
      case 'sewu':        return this.buildSewu(group, pMat, sMat, aMat, length, scale);
      case 'komodo':      return this.buildKomodo(group, pMat, sMat, aMat, length, scale);
    }
  }

  /**
   * Borobudur: square base (3 tiers, each smaller) + bell stupa + finial.
   */
  private buildBorobudur(group: THREE.Group, pMat: THREE.Material, sMat: THREE.Material, aMat: THREE.Material, _length: number, _scale: number): void {
    // Three square tiers, each smaller
    const tierHeights = [0.18, 0.15, 0.13];
    const tierSizes = [0.55, 0.42, 0.30];
    let y = 0;
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(tierSizes[i]!, tierHeights[i]!, tierSizes[i]!);
      const mesh = new THREE.Mesh(geo, pMat);
      mesh.position.y = y + tierHeights[i]! / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      y += tierHeights[i]!;
    }
    // Bell stupa (a flattened sphere) on top
    const stupa = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), pMat);
    stupa.position.y = y + 0.12;
    stupa.scale.set(1, 0.7, 1);
    stupa.castShadow = true;
    group.add(stupa);
    // Finial (small accent cube on top of stupa)
    const finial = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), aMat);
    finial.position.y = y + 0.35;
    finial.castShadow = true;
    group.add(finial);
    // Pinnacle point
    const point = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.10, 8), aMat);
    point.position.y = y + 0.49;
    group.add(point);
    // Small Buddha-relief suggestion: a small dark square in the base tier
    void sMat;
  }

  /**
   * Prambanan: tall narrow tower with stepped pyramidal roof + pinnacle.
   * Trapezoidal body (wider at base) with vertical fluting.
   */
  private buildPrambanan(group: THREE.Group, pMat: THREE.Material, sMat: THREE.Material, aMat: THREE.Material, length: number, _scale: number): void {
    // Trapezoidal body using a CylinderGeometry with different top/bottom radii
    const bodyHeight = 0.9;
    const bodyGeo = new THREE.CylinderGeometry(0.20, 0.30, bodyHeight, 8);
    const body = new THREE.Mesh(bodyGeo, pMat);
    body.position.y = bodyHeight / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    // Vertical fluting: 4 thin accent strips
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, bodyHeight * 0.85, 0.03), sMat);
      strip.position.set(Math.cos(angle) * 0.27, bodyHeight * 0.5, Math.sin(angle) * 0.27);
      group.add(strip);
    }
    // Stepped pyramidal roof (3 stepped rings)
    let y = bodyHeight;
    const stepR = [0.28, 0.22, 0.16];
    const stepH = 0.10;
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(stepR[i]! * 0.95, stepR[i]!, stepH, 8), pMat);
      ring.position.y = y + stepH / 2;
      ring.castShadow = true;
      group.add(ring);
      y += stepH;
    }
    // Pinnacle: red-accented spike
    const pinnacle = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 8), aMat);
    pinnacle.position.y = y + 0.09;
    group.add(pinnacle);
    void length;
  }

  /**
   * Istana Maimun: wide low palace with a large central dome + 4 minarets.
   * Yellow walls (the palace's actual color), green dome (Islamic).
   */
  private buildMaimun(group: THREE.Group, pMat: THREE.Material, sMat: THREE.Material, aMat: THREE.Material, _length: number, _scale: number): void {
    // Main building: wide low rectangular block
    const mainGeo = new THREE.BoxGeometry(0.80, 0.35, 0.45);
    const main = new THREE.Mesh(mainGeo, pMat);
    main.position.y = 0.175;
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);
    // Flat roof with overhang
    const roofGeo = new THREE.BoxGeometry(0.92, 0.06, 0.55);
    const roof = new THREE.Mesh(roofGeo, sMat);
    roof.position.y = 0.35 + 0.03;
    roof.castShadow = true;
    group.add(roof);
    // Central dome (green, the actual Maimun color)
    const domeGeo = new THREE.SphereGeometry(0.18, 16, 12);
    const dome = new THREE.Mesh(domeGeo, sMat);
    dome.position.y = 0.35 + 0.06 + 0.16;
    dome.scale.set(1, 0.85, 1);
    dome.castShadow = true;
    group.add(dome);
    // Dome finial (gold accent)
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.10, 8), aMat);
    finial.position.y = 0.35 + 0.06 + 0.18 + 0.10;
    group.add(finial);
    // 4 corner minarets (small thin towers)
    const cornerOffsets = [[0.32, 0.16], [-0.32, 0.16], [0.32, -0.16], [-0.32, -0.16]];
    for (const [x, z] of cornerOffsets) {
      const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.45, 8), pMat);
      minaret.position.set(x, 0.225, z);
      minaret.castShadow = true;
      group.add(minaret);
      // Minaret cap
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.10, 8), aMat);
      cap.position.set(x, 0.225 + 0.225 + 0.05, z);
      group.add(cap);
    }
    // Arched doorway suggestion: dark rectangle in front
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.18, 0.04), aMat);
    door.position.set(0, 0.09, 0.225);
    group.add(door);
  }

  /**
   * Benteng Rotterdam: square fort walls with 4 corner towers and an
   * arched gate. White/cream walls, red roof.
   */
  private buildRotterdam(group: THREE.Group, pMat: THREE.Material, sMat: THREE.Material, aMat: THREE.Material, _length: number, _scale: number): void {
    // 4 wall segments (front, back, left, right) leaving a gap in front for the gate
    const wallSize = 0.75;
    const wallH = 0.30;
    const wallT = 0.10;
    // Back wall (full)
    const back = new THREE.Mesh(new THREE.BoxGeometry(wallSize, wallH, wallT), pMat);
    back.position.set(0, wallH / 2, -wallSize / 2);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);
    // Side walls (full)
    for (const sign of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, wallSize), pMat);
      side.position.set(sign * wallSize / 2, wallH / 2, 0);
      side.castShadow = true;
      group.add(side);
    }
    // Front wall: two segments leaving a gap in the middle for the gate
    const gateGap = 0.20;
    const segW = (wallSize - gateGap) / 2;
    for (const sign of [-1, 1]) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, wallT), pMat);
      seg.position.set(sign * (wallSize / 2 - segW / 2), wallH / 2, wallSize / 2);
      seg.castShadow = true;
      group.add(seg);
    }
    // Red roof slabs on top of each wall
    for (const [x, z, w, d] of [
      [0, -wallSize / 2, wallSize, wallT],
      [-wallSize / 2, 0, wallT, wallSize],
      [wallSize / 2, 0, wallT, wallSize],
      [-(wallSize / 2 - segW / 2), wallSize / 2, segW, wallT],
      [(wallSize / 2 - segW / 2), wallSize / 2, segW, wallT]
    ] as Array<[number, number, number, number]>) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), sMat);
      roof.position.set(x, wallH + 0.025, z);
      roof.castShadow = true;
      group.add(roof);
    }
    // 4 corner towers (cylinders with conical red roofs)
    const cornerOffsets = [[wallSize/2, -wallSize/2], [-wallSize/2, -wallSize/2], [wallSize/2, wallSize/2], [-wallSize/2, wallSize/2]];
    for (const [x, z] of cornerOffsets) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, wallH + 0.12, 8), pMat);
      tower.position.set(x, (wallH + 0.12) / 2, z);
      tower.castShadow = true;
      group.add(tower);
      const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.12, 8), sMat);
      towerRoof.position.set(x, wallH + 0.12 + 0.06, z);
      group.add(towerRoof);
    }
    // Arched gate (a half-torus) at the front
    const archGeo = new THREE.TorusGeometry(0.10, 0.025, 6, 12, Math.PI);
    const arch = new THREE.Mesh(archGeo, aMat);
    arch.position.set(0, 0.20, wallSize / 2);
    arch.rotation.y = Math.PI;
    arch.rotation.x = Math.PI / 2;
    group.add(arch);
  }

  /**
   * Monas: tall marble obelisk on a square platform, with a gold flame
   * on top. Iconic Jakarta monument.
   */
  private buildMonas(group: THREE.Group, pMat: THREE.Material, sMat: THREE.Material, aMat: THREE.Material, length: number, _scale: number): void {
    // Square base platform (wider, shorter)
    const baseGeo = new THREE.BoxGeometry(0.65, 0.10, 0.65);
    const base = new THREE.Mesh(baseGeo, sMat);
    base.position.y = 0.05;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    // Inner platform
    const innerBase = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.06, 0.50), pMat);
    innerBase.position.y = 0.13;
    group.add(innerBase);
    // Tall thin obelisk (slimmer toward the top — use a cone)
    const obeliskH = Math.min(1.10, 0.5 + length * 0.08);
    const obeliskGeo = new THREE.CylinderGeometry(0.10, 0.14, obeliskH, 6);
    const obelisk = new THREE.Mesh(obeliskGeo, pMat);
    obelisk.position.y = 0.16 + obeliskH / 2;
    obelisk.castShadow = true;
    group.add(obelisk);
    // Obelisk neck (small ring)
    const neck = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.02, 6, 16), sMat);
    neck.position.y = 0.16 + obeliskH - 0.04;
    neck.rotation.x = Math.PI / 2;
    group.add(neck);
    // Gold flame (teardrop shape using a stretched sphere on a cone)
    const flameBase = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 12), aMat);
    flameBase.position.y = 0.16 + obeliskH + 0.05;
    flameBase.scale.set(0.7, 1.0, 0.7);
    flameBase.castShadow = true;
    group.add(flameBase);
    const flameTip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), aMat);
    flameTip.position.y = 0.16 + obeliskH + 0.20;
    group.add(flameTip);
  }

  /**
   * Candi Sewu: cluster of 4 small stupas in a square (the "thousand
   * temples" complex). Each stupa = small tiered base + dome + finial.
   */
  private buildSewu(group: THREE.Group, pMat: THREE.Material, _sMat: THREE.Material, aMat: THREE.Material, _length: number, _scale: number): void {
    const positions = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];
    for (const [x, z] of positions) {
      this.buildSmallStupa(group, x, z, pMat, aMat);
    }
    // Connecting low base platform
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.65), pMat);
    platform.position.y = 0.02;
    platform.receiveShadow = true;
    group.add(platform);
  }

  private buildSmallStupa(group: THREE.Group, x: number, z: number, pMat: THREE.Material, aMat: THREE.Material): void {
    // Tiny square base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.16), pMat);
    base.position.set(x, 0.05, z);
    base.castShadow = true;
    group.add(base);
    // Small bell stupa
    const stupa = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10), pMat);
    stupa.position.set(x, 0.18, z);
    stupa.scale.set(1, 0.7, 1);
    stupa.castShadow = true;
    group.add(stupa);
    // Finial
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 6), aMat);
    finial.position.set(x, 0.31, z);
    group.add(finial);
  }

  /**
   * Taman Nasional Komodo: dragon gate (candi bentar style). Two
   * pillars with a curved arch, dragon heads at the top.
   */
  private buildKomodo(group: THREE.Group, pMat: THREE.Material, sMat: THREE.Material, aMat: THREE.Material, _length: number, _scale: number): void {
    // Base platform
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.06, 0.30), pMat);
    platform.position.y = 0.03;
    platform.receiveShadow = true;
    group.add(platform);
    // Two pillars (candi bentar: split, with a jagged inner edge)
    for (const sign of [-1, 1]) {
      // Main pillar body
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), pMat);
      pillar.position.set(sign * 0.22, 0.06 + 0.55 / 2, 0);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      group.add(pillar);
      // Jagged inner edge (a vertical row of small notches)
      for (let i = 0; i < 4; i++) {
        const notch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.04), aMat);
        notch.position.set(sign * 0.22 - sign * 0.075, 0.10 + i * 0.12, 0);
        group.add(notch);
      }
      // Top crown
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.20), sMat);
      crown.position.set(sign * 0.22, 0.66, 0);
      group.add(crown);
    }
    // Curved arch connecting the two pillars at the top
    const archGeo = new THREE.TorusGeometry(0.22, 0.04, 6, 16, Math.PI);
    const arch = new THREE.Mesh(archGeo, sMat);
    arch.position.set(0, 0.66, 0);
    arch.rotation.x = Math.PI;
    arch.rotation.y = Math.PI / 2;
    group.add(arch);
    // Two dragon heads at the tops of the pillars (small stylized Komodo heads)
    for (const sign of [-1, 1]) {
      const head = this.buildKomodoHead(sign, aMat, sMat);
      head.position.set(sign * 0.22, 0.74, 0);
      group.add(head);
    }
    // Central pendant
    const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), aMat);
    pendant.position.set(0, 0.92, 0);
    group.add(pendant);
  }

  private buildKomodoHead(sign: number, aMat: THREE.Material, sMat: THREE.Material): THREE.Group {
    const head = new THREE.Group();
    // Snout (elongated box)
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.08), aMat);
    snout.position.x = -sign * 0.05;
    head.add(snout);
    // Skull
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), aMat);
    skull.position.x = sign * 0.02;
    head.add(skull);
    // Eye ridges (small bumps on top)
    for (const sx of [-0.03, 0.03]) {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), sMat);
      bump.position.set(sign * 0.02 + sx, 0.04, 0);
      head.add(bump);
    }
    return head;
  }
}
