/**
 * The 3D Lab: inspect the rigged cricketer and every animation state, and see
 * honestly where each piece of motion and each asset came from.
 */
import { useEffect, useRef, useState } from 'react';
import { Bone, CheckCircle2, CircleSlash, Cog, FileWarning } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components';
import { ANIMATION_STATES, MISSING_AUTHENTIC_MOTION, type AnimationSource } from '@/game3d/animation/states';
import { ASSETS } from '@/game3d/config/assets';
import { BONE_NAMES, type Outfit } from '@/game3d/characters/rig';
import { inspectModel, type ModelReport } from '@/game3d/characters/gltfInspect';
import { initialQuality, webglSupport } from '@/game3d/render/Renderer3D';
import { LabScene } from '@/game3d/scene/LabScene';
import { cn } from '@/lib/cn';
import { SectionTitle, chip } from './ui';

const SOURCE_TONE: Record<AnimationSource, 'blue' | 'green' | 'gold' | 'grey' | 'red'> = {
  PROCEDURAL_KEYFRAMES: 'blue',
  IMPORTED: 'green',
  RETARGETED: 'gold',
  SYSTEM: 'grey',
  UNAVAILABLE: 'red',
};

const OUTFIT_STATES: Record<Outfit, string[]> = {
  BATTER: ['BattingIdle', 'BattingReady', 'BattingDefence', 'BattingBackDefence', 'BattingDrive', 'BattingCoverDrive', 'BattingPull', 'BattingCut', 'BattingSweep', 'BattingLoftedShot', 'BattingLeave', 'MissedShot', 'RunBetweenWickets', 'RunTurn', 'SlideBat', 'DismissalReaction', 'Disappointment', 'Celebration', 'WalkBack', 'Idle'],
  BOWLER: ['Idle', 'BowlingRunUp', 'BowlingDelivery', 'SpinDelivery', 'BowlerAppeal', 'Disappointment', 'Walk', 'Celebration'],
  FIELDER: ['FieldingReady', 'Sprint', 'FieldingStop', 'FieldingDive', 'Catching', 'Throwing', 'Celebration'],
  KEEPER: ['WicketkeeperReady', 'WicketkeeperAction', 'WicketkeeperCollect', 'BowlerAppeal', 'Celebration'],
  UMPIRE: ['UmpireIdle', 'UmpireOut', 'UmpireFour', 'UmpireSix', 'UmpireWide', 'UmpireNoBall', 'UmpireBye'],
};

export default function LabScreen() {
  const container = useRef<HTMLDivElement>(null);
  const lab = useRef<LabScene | null>(null);
  const [support] = useState(webglSupport);
  const [outfit, setOutfit] = useState<Outfit>('BATTER');
  const [left, setLeft] = useState(false);
  const [state, setState] = useState('BattingIdle');
  const [skeleton, setSkeleton] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [reports, setReports] = useState<ModelReport[]>([]);

  useEffect(() => {
    if (!support.ok || !container.current) return;
    const l = new LabScene(container.current, initialQuality());
    lab.current = l;
    return () => {
      l.dispose();
      lab.current = null;
    };
  }, [support.ok]);

  useEffect(() => {
    const l = lab.current;
    if (!l) return;
    l.setCharacter(outfit, left);
    const first = OUTFIT_STATES[outfit][0];
    setState(first);
    l.play(first);
    l.showSkeleton(skeleton);
  }, [outfit, left]);

  useEffect(() => {
    lab.current?.showSkeleton(skeleton);
  }, [skeleton]);

  useEffect(() => {
    if (lab.current) lab.current.speed = speed;
  }, [speed]);

  useEffect(() => {
    let alive = true;
    Promise.all(ASSETS.filter((a) => a.path?.endsWith('.glb')).map((a) => inspectModel(a.path!))).then((r) => alive && setReports(r));
    return () => {
      alive = false;
    };
  }, []);

  const play = (s: string) => {
    setState(s);
    lab.current?.play(s);
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title="3D Lab" subtitle="The rigged cricketer, every animation state, and where each asset really came from." />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card flush className="overflow-hidden">
          {support.ok ? (
            <div ref={container} className="h-[min(62vh,520px)] w-full touch-none bg-brand-blue-soft" aria-label="3D character preview - drag to orbit" role="img" />
          ) : (
            <p className="p-6 text-[13px] text-ink-muted">WebGL is not available: {support.reason}</p>
          )}
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(OUTFIT_STATES) as Outfit[]).map((o) => (
                <button key={o} type="button" className={chip(outfit === o)} onClick={() => setOutfit(o)}>
                  {o.charAt(0) + o.slice(1).toLowerCase()}
                </button>
              ))}
              <button type="button" className={chip(left)} onClick={() => setLeft((v) => !v)}>
                Left-handed (mirrored clips)
              </button>
              <button type="button" className={chip(skeleton)} onClick={() => setSkeleton((v) => !v)}>
                <Bone className="mr-1 inline size-3.5" aria-hidden />
                Skeleton
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OUTFIT_STATES[outfit].map((s) => (
                <button key={s} type="button" className={cn(chip(state === s), 'text-[12px]')} onClick={() => play(s)}>
                  {s}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
              Speed
              <input type="range" min={0.1} max={1.5} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="flex-1" />
              <span className="w-10 text-right font-semibold text-ink">{speed.toFixed(2)}x</span>
            </label>
          </div>
        </Card>

        <Card>
          <CardHeader title="Animation states" subtitle="Only states with a real clip are ever played. None of these are motion capture." />
          <ul className="mt-3 max-h-[480px] divide-y divide-line overflow-y-auto pr-1">
            {ANIMATION_STATES.map((s) => (
              <li key={s.state} className="flex items-start gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink">{s.state}</span>
                  <span className="block text-[11.5px] text-ink-muted">{s.note}</span>
                </span>
                <Badge tone={SOURCE_TONE[s.source]} className="shrink-0 text-[10px]">
                  {s.source === 'PROCEDURAL_KEYFRAMES' ? 'Procedural keyframes' : s.source.toLowerCase()}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Asset manifest" subtitle="Status is only DOWNLOADED AND VERIFIED for a file in this repository that the tests parse." />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead className="text-[11px] tracking-wide text-ink-muted uppercase">
              <tr>
                <th className="py-2 pr-3">Asset</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Licence</th>
                <th className="py-2 pr-3">Skeleton / clips</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {ASSETS.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-ink">{a.name}</p>
                    <p className="text-[11.5px] break-all text-ink-muted">{a.url}</p>
                    <p className="mt-1 text-[11.5px] text-ink-muted">{a.notes}</p>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={a.status.includes('VERIFIED') || a.status.includes('BUILT') ? 'green' : a.status === 'INCOMPATIBLE' || a.status === 'NOT FOUND' ? 'red' : 'orange'} className="text-[10px] whitespace-nowrap">
                      {a.status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">{a.license}</td>
                  <td className="py-2 pr-3 text-ink-muted">
                    {a.skeleton}
                    <br />
                    {a.clips}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Imported model check (live)" subtitle="Loaded and inspected in this browser just now." />
          <div className="mt-3 flex flex-col gap-3">
            {reports.length === 0 ? <p className="text-[13px] text-ink-muted">Inspecting…</p> : null}
            {reports.map((r) => (
              <div key={r.url} className="rounded-tile border border-line p-3 text-[12.5px]">
                <p className="flex items-center gap-1.5 font-semibold text-ink">
                  {r.ok ? <CheckCircle2 className="size-4 text-brand-green" aria-hidden /> : <FileWarning className="size-4 text-brand-red" aria-hidden />}
                  {r.url}
                </p>
                {r.ok ? (
                  <ul className="mt-1 text-ink-muted">
                    <li>
                      {r.skinnedMeshes} skinned mesh, {r.triangles} triangles, {r.height} m tall
                    </li>
                    <li>Clips: {r.clips.map((c) => `${c.name || '(unnamed)'} ${c.duration}s`).join(', ') || 'none'}</li>
                    <li>
                      Skeleton: {r.skeleton?.boneCount} bones -{' '}
                      {r.skeleton?.compatibleWithCricketClips ? (
                        <b className="text-brand-green">compatible with the cricket clips</b>
                      ) : (
                        <b className="text-brand-red">INCOMPATIBLE - missing {r.skeleton?.missingForCricketClips.slice(0, 6).join(', ')}…</b>
                      )}
                    </li>
                    <li>Not used as a cricketer: the cricket clips are never forced onto a mismatched skeleton.</li>
                  </ul>
                ) : (
                  <p className="mt-1 text-brand-red">{r.error}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Still missing" subtitle="Authentic cricket motion that could not be obtained legally in this environment." />
          <ul className="mt-3 flex flex-col gap-2 text-[13px]">
            {MISSING_AUTHENTIC_MOTION.map((m) => (
              <li key={m} className="flex items-start gap-2">
                <CircleSlash className="mt-0.5 size-4 shrink-0 text-brand-orange" aria-hidden />
                {m}
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-2 text-[12px] text-ink-muted">
            <Cog className="mt-0.5 size-4 shrink-0" aria-hidden />
            The procedural rig uses Mixamo bone names ({BONE_NAMES.length} bones: {BONE_NAMES.slice(0, 6).join(', ')}…), so a licensed Mixamo FBX converted to GLB can be checked here and its clips mapped by name. See docs/assets/ASSET_MANIFEST.md.
          </p>
        </Card>
      </div>
    </div>
  );
}
