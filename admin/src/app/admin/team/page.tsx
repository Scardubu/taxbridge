'use client';

/**
 * Admin Team Management — TaxBridge V13 Sovereign
 *
 * - Role assignment for org members
 * - Last-OWNER guard: cannot demote/remove the last OWNER (client + server enforcement)
 * - role_version increment triggered on every role change (C-44, enforced by backend)
 * - Fetches from backend API — never calls Prisma directly
 */

import { useState, useCallback, useEffect } from 'react';
import { ROLE_HIERARCHY } from '@taxbridge/contracts';

type UserRole = keyof typeof ROLE_HIERARCHY;

interface OrgMember {
  id:        string;
  userId:    string;
  email:     string;
  name:      string;
  role:      UserRole;
  status:    'active' | 'inactive' | 'pending';
  joinedAt:  string;
}

interface TeamResponse {
  members:  OrgMember[];
  orgId:    string;
  orgName:  string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

const ASSIGNABLE_ROLES: UserRole[] = ['VIEWER', 'ACCOUNTANT', 'MANAGER', 'ADMIN', 'OWNER'];

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  OWNER:      { bg: '#FEF3C7', color: '#92400E' },
  ADMIN:      { bg: '#EDE9FE', color: '#6D28D9' },
  MANAGER:    { bg: '#DBEAFE', color: '#1D4ED8' },
  ACCOUNTANT: { bg: '#DCFCE7', color: '#15803D' },
  VIEWER:     { bg: '#F3F4F6', color: '#374151' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:   { bg: '#DCFCE7', color: '#15803D' },
  inactive: { bg: '#F3F4F6', color: '#6B7280' },
  pending:  { bg: '#FEF3C7', color: '#92400E' },
};

async function fetchTeam(): Promise<TeamResponse> {
  const res = await fetch(`${API_BASE}/api/v1/team`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Team fetch failed: ${res.status}`);
  return res.json() as Promise<TeamResponse>;
}

async function updateRole(memberId: string, newRole: UserRole): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/team/${memberId}/role`, {
    method:      'PATCH',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ role: newRole }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(body?.error ?? `Role update failed: ${res.status}`);
  }
}

async function removeMember(memberId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/team/${memberId}`, {
    method:      'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(body?.error ?? `Remove failed: ${res.status}`);
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function TeamPage() {
  const [team,    setTeam]    = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeam();
      setTeam(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  // Last-OWNER guard (client-side pre-check)
  const ownerCount = team?.members.filter((m) => m.role === 'OWNER' && m.status === 'active').length ?? 0;

  const isLastOwner = useCallback((member: OrgMember): boolean => {
    return member.role === 'OWNER' && ownerCount <= 1;
  }, [ownerCount]);

  const handleRoleChange = useCallback(async (member: OrgMember, newRole: UserRole) => {
    if (newRole === member.role) return;

    // Last-OWNER guard
    if (isLastOwner(member) && newRole !== 'OWNER') {
      showToast('Cannot demote the last OWNER. Assign another OWNER first.', 'error');
      return;
    }

    setWorking(member.id);
    try {
      await updateRole(member.id, newRole);
      showToast(`${member.name}'s role updated to ${newRole}`);
      await loadTeam();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setWorking(null);
    }
  }, [isLastOwner, loadTeam, showToast]);

  const handleRemove = useCallback(async (member: OrgMember) => {
    if (isLastOwner(member)) {
      showToast('Cannot remove the last OWNER.', 'error');
      return;
    }
    if (!confirm(`Remove ${member.name} from the organisation?`)) return;

    setWorking(member.id);
    try {
      await removeMember(member.id);
      showToast(`${member.name} removed`);
      await loadTeam();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setWorking(null);
    }
  }, [isLastOwner, loadTeam, showToast]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            position:   'fixed',
            bottom:     24,
            right:      24,
            background: toast.type === 'error' ? '#DC2626' : '#1E3A5F',
            color:      '#fff',
            padding:    '12px 20px',
            borderRadius: 10,
            fontSize:   13,
            fontWeight: 600,
            zIndex:     9999,
            boxShadow:  '0 4px 12px rgba(0,0,0,0.2)',
            maxWidth:   360,
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Team Management</h1>
          {team && (
            <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
              {team.orgName} · {team.members.length} member{team.members.length !== 1 ? 's' : ''}
              {ownerCount === 1 && (
                <span style={{ color: '#D97706', fontWeight: 600 }}> · ⚠ Only 1 OWNER</span>
              )}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" style={{ background: '#FEE2E2', color: '#991B1B', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          {error}
          <button onClick={loadTeam} style={{ marginLeft: 12, textDecoration: 'underline', background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Role hierarchy reference */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 12, color: '#1D4ED8' }}>
        <strong>Role hierarchy (highest → lowest):</strong>{' '}
        {ASSIGNABLE_ROLES.slice().reverse().join(' › ')}
        {' '}— role_version increments on every change (C-44)
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} aria-label="Team members">
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Member', 'Status', 'Current Role', 'Change Role', 'Joined', 'Actions'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#6B7280' }} aria-live="polite">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && (team?.members ?? []).length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#6B7280' }}>
                  No members found.
                </td>
              </tr>
            )}
            {(team?.members ?? []).map((member) => {
              const roleCfg   = ROLE_COLORS[member.role]   ?? ROLE_COLORS.VIEWER;
              const statusCfg = STATUS_COLORS[member.status] ?? STATUS_COLORS.inactive;
              const isProtected = isLastOwner(member);
              const isWorking   = working === member.id;

              return (
                <tr
                  key={member.id}
                  style={{ borderBottom: '1px solid #F3F4F6', opacity: isWorking ? 0.6 : 1 }}
                >
                  {/* Member */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{member.name}</div>
                    <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{member.email}</div>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: statusCfg.bg, color: statusCfg.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                      {member.status}
                    </span>
                  </td>

                  {/* Current role */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: roleCfg.bg, color: roleCfg.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                      {member.role}
                    </span>
                    {isProtected && (
                      <span
                        title="Last OWNER — cannot be demoted"
                        style={{ marginLeft: 6, fontSize: 14 }}
                        aria-label="Last OWNER — protected"
                      >
                        🔒
                      </span>
                    )}
                  </td>

                  {/* Change role */}
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={member.role}
                      disabled={isProtected || isWorking}
                      onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                      aria-label={`Change role for ${member.name}`}
                      style={{
                        padding:         '4px 8px',
                        border:          '1px solid #E5E7EB',
                        borderRadius:    6,
                        fontSize:        12,
                        cursor:          isProtected || isWorking ? 'not-allowed' : 'pointer',
                        backgroundColor: isProtected ? '#F9FAFB' : '#fff',
                      }}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>

                  {/* Joined */}
                  <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: 12 }}>
                    {formatDate(member.joinedAt)}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleRemove(member)}
                      disabled={isProtected || !!working}
                      title={isProtected ? 'Cannot remove last OWNER' : `Remove ${member.name}`}
                      style={{
                        padding:         '4px 10px',
                        fontSize:        12,
                        fontWeight:      600,
                        background:      isProtected ? '#F3F4F6' : '#FEE2E2',
                        color:           isProtected ? '#9CA3AF' : '#991B1B',
                        border:          `1px solid ${isProtected ? '#E5E7EB' : '#FECACA'}`,
                        borderRadius:    6,
                        cursor:          isProtected || working ? 'not-allowed' : 'pointer',
                        opacity:         working ? 0.6 : 1,
                      }}
                      aria-label={`Remove ${member.name} from team`}
                      aria-disabled={isProtected}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
