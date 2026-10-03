/**
 * The 3D layer without a GPU: the rig, the clips, the controller, IK, the
 * GLB pipeline and the choreography that keeps the pictures true to the engine.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PvpMatch, autoPickSquad, claimStarter, createProfile, type MatchEvent, type MatchSetup, type PvpProfile, type SideSetup } from '@/engine/pvp';
import { createRng } from '@/engine/match/rng';
import { AnimationController } from './animation/AnimationController';
import { cricketClips, mirrorClip, SHOT_CONTACT_SEC } from './animation/clips';
import { ANIMATION_STATES, STATE_INFO } from './animation/states';
import { Cricketer } from './characters/Cricketer';
import { GRIP } from './characters/props';
import { BONES, BONE_NAMES, DEFAULT_KIT, createCharacter } from './characters/rig';
import { inspectSkeleton, parseGlb } from './characters/gltfInspect';
import { batterStateFor, planAfterContact, type Spot } from './choreography';
import { PITCH, deliveryPath, pointOnPath, ropeCrossing, radius } from './physics/ballFlight';

describe('rig', () => {
  it('builds a skinned mesh bound to a full skeleton', () => {
    const c = createCharacter('BATTER', DEFAULT_KIT);
    expect(c.mesh.isSkinnedMesh).toBe(true);
    expect(c.skeleton.bones.length).toBe(BONES.length);
    const skin = c.mesh.geometry.getAttribute('skinIndex');
    const weight = c.mesh.geometry.getAttribute('skinWeight');
    for (let i = 0; i < skin.count; i += 1) {
      expect(skin.getX(i)).toBeLessThan(BONES.length);
      expect(weight.getX(i) + weight.getY(i)).toBeCloseTo(1, 4);
    }
    c.mesh.updateMatrixWorld(true);
    const head = c.bones.Head.getWorldPosition(new THREE.Vector3());
    expect(head.y).toBeGreaterThan(1.5);
    expect(head.y).toBeLessThan(1.75);
  });
});

describe('clips', () => {
  const clips = cricketClips();

  it('every state with a clip has it, and every track targets a real bone or the bat', () => {
    for (const s of ANIMATION_STATES) if (s.clip) expect(clips[s.clip], s.state).toBeDefined();
    const nodes = new Set([...BONE_NAMES, 'BatControl']);
    for (const clip of Object.values(clips)) {
      for (const t of clip.tracks) expect(nodes.has(t.name.split('.')[0]), `${clip.name}: ${t.name}`).toBe(true);
      expect(clip.validate()).toBe(true);
    }
  });

  it('mirroring swaps sides and keeps the clip valid', () => {
    const m = mirrorClip(clips.BowlingDelivery);
    expect(m.tracks.some((t) => t.name === 'LeftArm.quaternion')).toBe(true);
    const right = clips.BowlingDelivery.tracks.find((t) => t.name === 'RightArm.quaternion')!;
    const left = m.tracks.find((t) => t.name === 'LeftArm.quaternion')!;
    expect(left.values[0]).toBeCloseTo(right.values[0]);
    expect(left.values[1]).toBeCloseTo(-right.values[1]);
    expect(m.validate()).toBe(true);
  });
});

describe('animation controller', () => {
  it('plays clips that move bones, and refuses unknown states', () => {
    const c = createCharacter('BOWLER', DEFAULT_KIT);
    const ctrl = new AnimationController(c.root, cricketClips());
    expect(ctrl.play('BowlingDelivery', { token: 'd1' })).toBe(true);
    for (let i = 0; i < 6; i += 1) ctrl.update(0.07);
    expect(c.bones.RightArm.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(1);
    expect(ctrl.play('NoSuchState')).toBe(false);
    expect(ctrl.diagnostics.missing).toContain('NoSuchState');
    expect(ctrl.play('Contact')).toBe(false);
    ctrl.dispose();
  });

  it('never plays the same delivery twice, and settles after a one-shot', () => {
    const c = createCharacter('BOWLER', DEFAULT_KIT);
    const ctrl = new AnimationController(c.root, cricketClips());
    let finished = 0;
    expect(ctrl.play('BowlingDelivery', { token: 'del-1', then: 'Idle', onFinish: () => (finished += 1) })).toBe(true);
    expect(ctrl.play('BowlingDelivery', { token: 'del-1' })).toBe(false);
    for (let i = 0; i < 40; i += 1) ctrl.update(0.05);
    expect(finished).toBe(1);
    expect(ctrl.state).toBe('Idle');
    // A looping state asked for again keeps playing instead of restarting.
    const t = ctrl.time;
    ctrl.play('Idle');
    expect(ctrl.time).toBe(t);
    ctrl.dispose();
    expect(ctrl.play('Idle')).toBe(false);
  });

  it('a stale one-shot completion does not hijack the current state', () => {
    const c = createCharacter('BATTER', DEFAULT_KIT);
    const ctrl = new AnimationController(c.root, cricketClips());
    let stale = 0;
    ctrl.play('BattingDrive', { token: 'a', onFinish: () => (stale += 1), then: 'BattingIdle' });
    ctrl.update(0.2);
    ctrl.play('BattingPull', { token: 'b', then: 'BattingIdle' });
    for (let i = 0; i < 40; i += 1) ctrl.update(0.05);
    expect(stale).toBe(0);
    expect(ctrl.state).toBe('BattingIdle');
    ctrl.dispose();
  });
});

describe('batting IK', () => {
  it.each([false, true])('both hands stay on the handle (left-handed: %s)', (leftHanded) => {
    const batter = new Cricketer({ outfit: 'BATTER', kit: DEFAULT_KIT, name: 'B', withBat: true, leftHanded });
    for (const state of ['BattingIdle', 'BattingDrive', 'BattingPull', 'BattingCut']) {
      batter.play(state, { token: `${state}-${leftHanded}` });
      for (let t = 0; t < SHOT_CONTACT_SEC; t += 0.06) batter.update(0.06);
      const top = batter.bat!.localToWorld(GRIP.top.clone());
      const bottom = batter.bat!.localToWorld(GRIP.bottom.clone());
      const handTop = batter.rig.bones[leftHanded ? 'RightHand' : 'LeftHand'].getWorldPosition(new THREE.Vector3());
      const handBottom = batter.rig.bones[leftHanded ? 'LeftHand' : 'RightHand'].getWorldPosition(new THREE.Vector3());
      expect(handTop.distanceTo(top), `${state} top`).toBeLessThan(0.04);
      expect(handBottom.distanceTo(bottom), `${state} bottom`).toBeLessThan(0.04);
    }
    batter.dispose();
  });
});

describe('imported models', () => {
  it('parses the Khronos RiggedFigure GLB and reports its skeleton as incompatible', async () => {
    // Node's fs, loaded dynamically: the app's tsconfig has no Node types.
    const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises' as string);
    const data: Uint8Array = await readFile('public/assets/players/third-party/RiggedFigure.glb');
    // Copy into this realm's ArrayBuffer (GLTFLoader checks `instanceof ArrayBuffer`).
    const { report } = await parseGlb(Uint8Array.from(data).buffer, 'RiggedFigure.glb');
    expect(report.ok).toBe(true);
    expect(report.skinnedMeshes).toBeGreaterThan(0);
    expect(report.clips.length).toBeGreaterThan(0);
    expect(report.skeleton!.boneCount).toBeGreaterThan(5);
    expect(report.skeleton!.compatibleWithCricketClips).toBe(false);
    expect(report.skeleton!.missingForCricketClips).toContain('Hips');
  });

  it('accepts a Mixamo-named skeleton after stripping the prefix', () => {
    const r = inspectSkeleton(BONE_NAMES.map((n) => `mixamorig:${n}`));
    expect(r.prefix).toBe('mixamorig:');
    expect(r.compatibleWithCricketClips).toBe(true);
  });
});

describe('ball flight', () => {
  it('reaches the batter exactly at the arrival time, after pitching', () => {
    const path = deliveryPath({ release: { x: 0.3, y: 2.2, z: 8.6 }, releaseMs: 0, arrivalMs: 700, line: 'OFF_STUMP', length: 'GOOD', leftHanded: false, spin: false });
    expect(path).toHaveLength(2);
    expect(path[0].to.y).toBe(0);
    const at = pointOnPath(path, 700);
    expect(at.z).toBeCloseTo(PITCH.strikerZ + 0.25);
    expect(at.x).toBeLessThan(0);
  });

  it('rope crossings are on the rope', () => {
    for (const a of [0, 45, 90, 180, 270, 330]) expect(radius(ropeCrossing(a, false))).toBeCloseTo(PITCH.boundaryRadius, 3);
  });
});

// ---------------------------------------------------------------- choreography over real engine outcomes

const NOW = '2026-10-02T10:00:00.000Z';
function starter(seed: number, id: string): PvpProfile {
  const r = claimStarter(createProfile({ userId: id, displayName: id, friendCode: 'ABC123', now: NOW }), { requestId: `starter-${id}` }, { now: NOW, rng: createRng(seed) });
  if (!r.ok) throw new Error(r.message);
  return r.profile;
}
function side(p: PvpProfile, name: string): SideSetup {
  const squad = p.squad ?? autoPickSquad(p.inventory)!;
  const by = new Map(p.inventory.map((o) => [o.instanceId, o]));
  return { userId: p.userId, displayName: name, isBot: true, xi: squad.xi.map((id) => ({ instanceId: id, cardId: by.get(id)!.cardId, upgrades: 0 })), captainInstanceId: squad.captain };
}
function events(seed: number): MatchEvent[] {
  const setup: MatchSetup = { matchId: `c-${seed}`, seed, mode: 'PRACTICE', sides: [side(starter(seed, 'a'), 'A'), side(starter(seed + 7, 'b'), 'B')] };
  let now = 0;
  const m = new PvpMatch(setup, now);
  while (!m.complete) {
    now = Math.max(now + 50, m.nextWakeAt() ?? now);
    m.tick(now);
  }
  return m.events;
}

describe('choreography follows the engine', () => {
  const all = Array.from({ length: 25 }, (_, i) => events(i + 1)).flat();
  const results = all.filter((e): e is Extract<MatchEvent, { kind: 'BALL_RESULT' }> => e.kind === 'BALL_RESULT');
  const opens = new Map(all.filter((e): e is Extract<MatchEvent, { kind: 'DELIVERY_OPEN' }> => e.kind === 'DELIVERY_OPEN').map((e) => [e.deliveryId, e]));

  it('has a varied sample of outcomes', () => {
    expect(results.length).toBeGreaterThan(200);
    expect(results.some((r) => r.outcome.isBoundaryFour || r.outcome.isBoundarySix)).toBe(true);
    expect(results.some((r) => r.outcome.wicket)).toBe(true);
    expect(results.some((r) => r.contact === 'MISS' || r.contact === 'NO_SHOT')).toBe(true);
  });

  for (const leftHanded of [false, true]) {
    it(`never contradicts the result (left-handed: ${leftHanded})`, () => {
      for (const r of results) {
        const open = opens.get(r.deliveryId)!;
        const spots: Spot[] = open.field.fielders.map((f) => ({ id: f.playerId, pos: { x: 0, y: 0, z: 0 } }));
        const plan = planAfterContact({
          shot: r.shot, contact: r.contact, outcome: r.outcome, contactMs: 1000, arrival: { x: 0, y: 0.7, z: PITCH.strikerZ + 0.25 },
          leftHanded, spin: false, keeper: { id: open.field.keeperId, pos: { x: 0, y: 0, z: PITCH.keeperZ } }, bowler: { id: open.bowlerId, pos: { x: 0, y: 0, z: 9 } },
          fielders: spots.map((s, i) => ({ ...s, pos: { x: Math.sin(i) * 30, y: 0, z: Math.cos(i) * 30 } })), strikerId: open.strikerId,
        });
        // A miss or a leave never shows a shot that connects.
        if (r.contact === 'MISS' || r.contact === 'NO_SHOT' || r.contact === 'PAD') {
          expect(['BattingLeave', 'MissedShot', 'BattingDefence']).toContain(plan.batterState);
          expect(['KEEPER', 'STUMPS', 'PAD', 'BYES']).toContain(plan.end);
        }
        expect(plan.batterState).toBe(batterStateFor(r.shot, r.contact));
        // A boundary is never caught, and only a recorded catch shows a catch.
        if (r.outcome.isBoundaryFour || r.outcome.isBoundarySix) {
          expect(['FOUR', 'SIX']).toContain(plan.end);
          expect(plan.tasks.some((t) => t.action === 'Catching')).toBe(false);
          expect(plan.umpireSignal).toBe(r.outcome.isBoundarySix ? 'UmpireSix' : 'UmpireFour');
        }
        if (plan.end === 'CATCH') expect(['CAUGHT', 'CAUGHT_AND_BOWLED']).toContain(r.outcome.wicket?.type);
        if (r.outcome.wicket?.type === 'CAUGHT' && r.outcome.wicket.fielderId) {
          expect(plan.end).toBe('CATCH');
          const task = plan.tasks.find((t) => t.action === 'Catching')!;
          expect(task.id).toBe(r.outcome.wicket.fielderId);
          // The ball arrives where the catcher's hands are.
          const last = plan.ballPath[plan.ballPath.length - 1];
          expect(Math.hypot(last.to.x - task.runTo.x, last.to.z - task.runTo.z)).toBeLessThan(0.01);
        }
        if (r.outcome.wicket) expect(plan.umpireSignal).toBe('UmpireOut');
        else expect(plan.umpireSignal).not.toBe('UmpireOut');
        if (r.outcome.wicket?.type === 'BOWLED') expect(plan.bailsAtMs).not.toBeNull();
        // Runs the batters run never exceed what the engine scored.
        expect(plan.runs).toBeLessThanOrEqual(r.outcome.runsOffBat + (r.outcome.extras?.runs ?? 0));
        expect(plan.endMs).toBeGreaterThan(1000);
        for (const seg of plan.ballPath) expect(seg.t1).toBeGreaterThanOrEqual(seg.t0);
      }
    });
  }

  it('animation states in the table are consistent', () => {
    for (const s of ANIMATION_STATES) expect(STATE_INFO[s.state]).toBe(s);
  });
});
