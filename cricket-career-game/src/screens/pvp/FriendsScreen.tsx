/** Friends and private rooms (online server only). */
import { useEffect, useState } from 'react';
import { Copy, DoorOpen, Mail, UserPlus } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components';
import type { FriendView } from '@/engine/pvp';
import { usePvpStore } from '@/store/pvpStore';
import { rich, useT } from '@/i18n/react';
import { SectionTitle, primaryButton, secondaryButton } from './ui';

export default function FriendsScreen() {
  const profile = usePvpStore((s) => s.profile)!;
  const mode = usePvpStore((s) => s.mode);
  const call = usePvpStore((s) => s.call);
  const room = usePvpStore((s) => s.room);
  const createRoom = usePvpStore((s) => s.createRoom);
  const joinRoom = usePvpStore((s) => s.joinRoom);
  const invites = usePvpStore((s) => s.invites);
  const dismissInvite = usePvpStore((s) => s.dismissInvite);
  const [friends, setFriends] = useState<FriendView[]>([]);
  const [code, setCode] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const t = useT();
  const online = mode === 'ONLINE';

  useEffect(() => {
    if (!online) return;
    void call('friends.list').then((r) => r.ok && setFriends(r.data.friends ?? []));
  }, [online, call]);

  if (!online) {
    return (
      <div className="flex flex-col gap-4">
        <SectionTitle title={t('pvp.fr.title')} />
        <Card>
          <CardHeader title={t('pvp.fr.needs')} subtitle={t('pvp.fr.needsSub')} />
          <ol className="mt-3 list-decimal pl-5 text-[13px] text-ink-muted">
            <li>
              {rich(t('pvp.fr.step1'), { cmd: <code className="rounded bg-page px-1">npm run pvp:server</code>, folder: <code className="rounded bg-page px-1">cricket-career-game</code> })}
            </li>
            <li>{t('pvp.fr.step2')}</li>
            <li>{t('pvp.fr.step3')}</li>
          </ol>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title={t('pvp.fr.title')} subtitle={t('pvp.fr.subtitle')} />
      {invites.length ? (
        <Card className="border-brand-blue/40">
          <CardHeader title={t('pvp.fr.invites')} />
          <ul className="mt-2 flex flex-col gap-2">
            {invites.map((i) => (
              <li key={i.code} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Mail className="size-4 text-brand-blue" aria-hidden />
                <span className="flex-1">
                  {rich(t('pvp.fr.invited', { code: i.code }), { name: <b>{i.fromName}</b> })}
                </span>
                <button type="button" className={primaryButton('py-1.5 text-[13px]')} onClick={() => void joinRoom(i.code).then(() => dismissInvite(i.code))}>
                  {t('pvp.fr.join')}
                </button>
                <button type="button" className={secondaryButton('py-1.5 text-[13px]')} onClick={() => dismissInvite(i.code)}>
                  {t('pvp.fr.decline')}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('pvp.home.privateRoom')} />
          <div className="mt-3 flex flex-col gap-3">
            {room ? (
              <div className="rounded-tile bg-brand-blue-soft p-3 text-center">
                <p className="text-[12px] text-ink-muted">{t('pvp.fr.waiting')}</p>
                <p className="text-[30px] font-extrabold tracking-[0.3em] text-brand-blue">{room}</p>
                <button type="button" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue" onClick={() => void navigator.clipboard?.writeText(room)}>
                  <Copy className="size-3.5" aria-hidden />
                  {t('pvp.fr.copy')}
                </button>
              </div>
            ) : (
              <button type="button" className={primaryButton()} onClick={() => void createRoom()}>
                <DoorOpen className="size-4" aria-hidden />
                {t('pvp.fr.create')}
              </button>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (roomCode.trim()) void joinRoom(roomCode);
              }}
            >
              <input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} maxLength={6} placeholder={t('pvp.fr.roomPh')} aria-label={t('pvp.fr.roomCode')} className="min-w-0 flex-1 rounded-xl border border-line bg-page px-3 py-2 text-[14px] tracking-widest uppercase" />
              <button type="submit" className={secondaryButton()}>
                {t('pvp.fr.join')}
              </button>
            </form>
          </div>
        </Card>
        <Card>
          <CardHeader title={t('pvp.nav.friends')} subtitle={t('pvp.fr.yourCode', { code: profile.friendCode })} />
          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await call('friends.add', { friendCode: code.trim().toUpperCase() });
              if (r.ok) {
                setFriends(r.data.friends ?? []);
                setCode('');
              }
            }}
          >
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder={t('pvp.fr.friendCode')} aria-label={t('pvp.fr.friendCode')} className="min-w-0 flex-1 rounded-xl border border-line bg-page px-3 py-2 text-[14px] tracking-widest uppercase" />
            <button type="submit" className={primaryButton()}>
              <UserPlus className="size-4" aria-hidden />
              {t('pvp.fr.add')}
            </button>
          </form>
          <ul className="mt-3 divide-y divide-line">
            {friends.map((f) => (
              <li key={f.userId} className="flex items-center gap-2 py-2 text-[13px]">
                <span className="min-w-0 flex-1">
                  <b>{f.displayName}</b>
                  <span className="block text-[11.5px] text-ink-muted">
                    {f.rating !== null ? t('pvp.fr.rating', { n: f.rating }) : t('pvp.unranked')} · {f.friendCode}
                  </span>
                </span>
                <Badge tone={f.online ? 'green' : 'grey'} className="text-[10.5px]">
                  {t(f.online ? 'pvp.fr.online' : 'pvp.fr.offline')}
                </Badge>
                <button type="button" disabled={!f.online} className={secondaryButton('py-1.5 text-[12.5px]')} onClick={() => void call('friends.invite', { userId: f.userId }).then((r) => r.ok && usePvpStore.setState({ room: r.data.code ?? null }))}>
                  {t('pvp.fr.invite')}
                </button>
              </li>
            ))}
            {friends.length === 0 ? <li className="py-2 text-[13px] text-ink-muted">{t('pvp.fr.none')}</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
