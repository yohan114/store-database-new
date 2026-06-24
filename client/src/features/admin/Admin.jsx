import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';

const ROLES = ['admin', 'storekeeper', 'viewer'];
const ROLE_BADGE = {
  admin: 'bg-brand-100 text-brand-700',
  storekeeper: 'bg-emerald-100 text-emerald-700',
  viewer: 'bg-slate-200 text-slate-600',
};

const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

function Tabs({ tab, setTab }) {
  const items = [
    ['users', 'Users & Roles'],
    ['audit', 'Audit Log'],
  ];
  return (
    <div className="flex gap-1 rounded-lg bg-slate-200/60 p-1">
      {items.map(([key, label]) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
            tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AddUserForm() {
  const qc = useQueryClient();
  const [f, setF] = useState({ username: '', fullName: '', role: 'viewer', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const create = useMutation({
    mutationFn: () => api.post('/users', f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setF({ username: '', fullName: '', role: 'viewer', password: '' });
      setErr('');
    },
    onError: (e) => setErr(e.message),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Add a user</h3>
      {err && <div className="mb-3 rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input" placeholder="Username" value={f.username} onChange={set('username')} />
        <input className="input" placeholder="Full name" value={f.fullName} onChange={set('fullName')} />
        <select className="input" value={f.role} onChange={set('role')}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input className="input" type="password" placeholder="Password" value={f.password} onChange={set('password')} />
        <button
          onClick={() => create.mutate()}
          disabled={!f.username || !f.password || create.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {create.isPending ? 'Adding…' : 'Add user'}
        </button>
      </div>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { data: users = [], isLoading, error } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users') });

  const update = useMutation({
    mutationFn: ({ id, body }) => api.put(`/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => alert(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => api.del(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => alert(e.message),
  });

  const resetPassword = (u) => {
    const pw = window.prompt(`New password for "${u.username}":`);
    if (pw) update.mutate({ id: u.id, body: { password: pw } });
  };

  return (
    <div className="space-y-4">
      <AddUserForm />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {error && <div className="p-4 text-sm text-rose-700">{error.message}</div>}
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'opacity-50'}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{u.fullName || u.username}</div>
                  <div className="text-xs text-slate-400">@{u.username}{me?.id === u.id && ' · you'}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value } })}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_BADGE[u.role] || ''}`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{fmt(u.lastLoginAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => resetPassword(u)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                      Reset password
                    </button>
                    <button
                      onClick={() => update.mutate({ id: u.id, body: { active: !u.active } })}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`Remove ${u.username}?`)) remove.mutate(u.id); }}
                      disabled={me?.id === u.id}
                      className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab() {
  const [entity, setEntity] = useState('');
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit', entity],
    queryFn: () => api.get(`/audit?limit=200${entity ? `&entity=${encodeURIComponent(entity)}` : ''}`),
  });
  const rows = data?.rows || [];
  const entities = ['', 'items', 'receipts', 'issues', 'batteries', 'transfers', 'general-items', 'users', 'auth'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className="input max-w-xs" value={entity} onChange={(e) => setEntity(e.target.value)}>
          {entities.map((en) => (
            <option key={en} value={en}>{en || 'All activity'}</option>
          ))}
        </select>
        <button onClick={() => refetch()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
        <span className="text-sm text-slate-400">{data ? `${data.total} total events` : ''}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No activity yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">{fmt(r.createdAt)}</td>
                <td className="px-4 py-2">
                  <span className="font-medium text-slate-700">{r.username}</span>
                  {r.role && <span className="ml-1 text-xs text-slate-400">({r.role})</span>}
                </td>
                <td className="px-4 py-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{r.action}</span>
                </td>
                <td className="px-4 py-2 text-slate-600">{r.entity}{r.entityId ? ` #${r.entityId}` : ''}</td>
                <td className="max-w-md truncate px-4 py-2 text-xs text-slate-400" title={r.details || ''}>{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('users');
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Users &amp; Audit</h1>
          <p className="text-sm text-slate-500">Manage accounts and review who changed what.</p>
        </div>
        <Tabs tab={tab} setTab={setTab} />
      </div>
      {tab === 'users' ? <UsersTab /> : <AuditTab />}
    </div>
  );
}
