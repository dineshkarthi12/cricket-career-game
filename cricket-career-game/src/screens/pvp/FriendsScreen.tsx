/** Friends and private rooms (online server only). */
import { useEffect, useState } from 'react';
import { Copy, DoorOpen, Mail, UserPlus } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components';
import type { FriendView } from '@/engine/pvp';
import { usePvpStore } from '@/store/pvpStore';
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
  const online = mode === 'ONLINE';

  useEffect(() => {
    if (!online) return;
    void call('friends.list').then((r) => r.ok && setFriends(r.data.friends ?? []));
  }, [online, call]);

  if (!online) {
    return (
      <div className="flex flex-col gap-4">
        <SectionTitle title="Friends & private rooms" />
        <Card>
          <CardHeader title="Needs the online server" subtitle="Friends, invitations and private rooms are real online features - the offline demo has no other players to connect to." />
          <ol className="mt-3 list-decimal pl-5 text-[13px] text-ink-muted">
            <li>
              Start the server: <code className="rounded bg-page px-1">npm run pvp:server</code> (in the <code className="rounded bg-page px-1">cricket-career-game</code> folder).
            </li>
            <li>On Live PvP home, enter its address (for example ws://localhost:8787) under Connection and press Connect.</li>
            <li>Share your friend code or a room code with a friend connected to the same server.</li>
          </ol>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title="Friends & private rooms" subtitle="Private matches are unranked. Both players use their saved XI." />
      {invites.length ? (
        <Card className="border-brand-blue/40">
          <CardHeader title="Invitations" />
          <ul className="mt-2 flex flex-col gap-2">
            {invites.map((i) => (
              <li key={i.code} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Mail className="size-4 text-brand-blue" aria-hidden />
                <span className="flex-1">
                  <b>{i.fromName}</b> invited you to room {i.code}
                </span>
                <button type="button" className={primaryButton('py-1.5 text-[13px]')} onClick={() => void joinRoom(i.code).then(() => dismissInvite(i.code))}>
                  Join
                </button>
                <button type="button" className={secondaryButton('py-1.5 text-[13px]')} onClick={() => dismissInvite(i.code)}>
                  Decline
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Private room" />
          <div className="mt-3 flex flex-col gap-3">
            {room ? (
              <div className="rounded-tile bg-brand-blue-soft p-3 text-center">
                <p className="text-[12px] text-ink-muted">Your room code - waiting for a friend to join</p>
                <p className="text-[30px] font-extrabold tracking-[0.3em] text-brand-blue">{room}</p>
                <button type="button" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue" onClick={() => void navigator.clipboard?.writeText(room)}>
                  <Copy className="size-3.5" aria-hidden />
                  Copy code
                </button>
              </div>
            ) : (
              <button type="button" className={primaryButton()} onClick={() => void createRoom()}>
                <DoorOpen className="size-4" aria-hidden />
                Create a room
              </button>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (roomCode.trim()) void joinRoom(roomCode);
              }}
            >
              <input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ROOM CODE" aria-label="Room code" className="min-w-0 flex-1 rounded-xl border border-line bg-page px-3 py-2 text-[14px] tracking-widest uppercase" />
              <button type="submit" className={secondaryButton()}>
                Join
              </button>
            </form>
          </div>
        </Card>
        <Card>
          <CardHeader title="Friends" subtitle={`Your friend code: ${profile.friendCode}`} />
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
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="Friend code" aria-label="Friend code" className="min-w-0 flex-1 rounded-xl border border-line bg-page px-3 py-2 text-[14px] tracking-widest uppercase" />
            <button type="submit" className={primaryButton()}>
              <UserPlus className="size-4" aria-hidden />
              Add
            </button>
          </form>
          <ul className="mt-3 divide-y divide-line">
            {friends.map((f) => (
              <li key={f.userId} className="flex items-center gap-2 py-2 text-[13px]">
                <span className="min-w-0 flex-1">
                  <b>{f.displayName}</b>
                  <span className="block text-[11.5px] text-ink-muted">
                    {f.rating !== null ? `Rating ${f.rating}` : 'Unranked'} · {f.friendCode}
                  </span>
                </span>
                <Badge tone={f.online ? 'green' : 'grey'} className="text-[10.5px]">
                  {f.online ? 'Online' : 'Offline'}
                </Badge>
                <button type="button" disabled={!f.online} className={secondaryButton('py-1.5 text-[12.5px]')} onClick={() => void call('friends.invite', { userId: f.userId }).then((r) => r.ok && usePvpStore.setState({ room: r.data.code ?? null }))}>
                  Invite
                </button>
              </li>
            ))}
            {friends.length === 0 ? <li className="py-2 text-[13px] text-ink-muted">No friends yet. Swap friend codes to add each other.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
