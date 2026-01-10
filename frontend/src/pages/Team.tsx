/**
 * Team management page - manage studio team members (owner only).
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUsers, inviteUser, updateUser, deactivateUser } from '../services/users';
import type { User, UserRole, UserInvite, UserUpdate } from '../types/api';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (data: UserInvite) => Promise<void>;
}

function InviteModal({ isOpen, onClose, onInvite }: InviteModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'artist' as UserRole,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onInvite(formData);
      setFormData({ email: '', first_name: '', last_name: '', role: 'artist' });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-100">Invite Team Member</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              placeholder="artist@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">First Name</label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Last Name</label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
            >
              <option value="artist">Artist</option>
              <option value="receptionist">Receptionist</option>
              <option value="owner">Owner</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSave: (userId: string, data: UserUpdate) => Promise<void>;
  currentUserId: string;
}

function EditModal({ isOpen, user, onClose, onSave, currentUserId }: EditModalProps) {
  const [formData, setFormData] = useState<UserUpdate>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      await onSave(user.id, formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  const isSelf = user.id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-ink-800 rounded-xl border border-ink-700 p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-100">Edit Team Member</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">First Name</label>
              <input
                type="text"
                value={formData.first_name || ''}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-300 mb-1.5">Last Name</label>
              <input
                type="text"
                value={formData.last_name || ''}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Phone</label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value || null })}
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 placeholder-ink-500 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-300 mb-1.5">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              disabled={isSelf}
              className="w-full px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-ink-100 focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="artist">Artist</option>
              <option value="receptionist">Receptionist</option>
              <option value="owner">Owner</option>
            </select>
            {isSelf && (
              <p className="text-xs text-ink-500 mt-1">You cannot change your own role</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              disabled={isSelf}
              className="rounded border-ink-600 bg-ink-900 text-accent-primary focus:ring-accent-primary disabled:opacity-50"
            />
            <label htmlFor="is_active" className="text-sm text-ink-300">
              Account Active
            </label>
            {isSelf && (
              <span className="text-xs text-ink-500">(cannot deactivate yourself)</span>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles = {
    owner: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    artist: 'bg-accent-primary/10 text-accent-primary border-accent-primary/20',
    receptionist: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full border capitalize ${styles[role]}`}>
      {role}
    </span>
  );
}

export function Team() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await getUsers(0, 100, true);
      setUsers(response.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (data: UserInvite) => {
    await inviteUser(data);
    setSuccessMessage(`Invitation sent to ${data.email}`);
    setTimeout(() => setSuccessMessage(''), 5000);
    loadUsers();
  };

  const handleUpdate = async (userId: string, data: UserUpdate) => {
    await updateUser(userId, data);
    setSuccessMessage('Team member updated successfully');
    setTimeout(() => setSuccessMessage(''), 5000);
    loadUsers();
  };

  const handleDeactivate = async (user: User) => {
    if (!confirm(`Are you sure you want to deactivate ${user.first_name} ${user.last_name}'s account?`)) {
      return;
    }
    try {
      await deactivateUser(user.id);
      setSuccessMessage(`${user.first_name} ${user.last_name} has been deactivated`);
      setTimeout(() => setSuccessMessage(''), 5000);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate user');
    }
  };

  // Only owners can access this page
  if (currentUser?.role !== 'owner') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="w-16 h-16 text-ink-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-ink-200">Access Denied</h2>
          <p className="text-ink-400 mt-1">Only studio owners can manage team members.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Team</h1>
          <p className="text-ink-400 mt-1">Manage your studio's artists and staff.</p>
        </div>
        <button
          onClick={() => setInviteModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Invite Member
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Team Members Table */}
      <div className="bg-ink-800 rounded-xl border border-ink-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-ink-400 mt-2">Loading team members...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 text-ink-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-medium text-ink-200">No team members yet</h3>
            <p className="text-ink-400 mt-1">Invite artists and staff to join your studio.</p>
            <button
              onClick={() => setInviteModalOpen(true)}
              className="mt-4 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg transition-colors"
            >
              Invite Your First Member
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-ink-700/50 border-b border-ink-700">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Email</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Role</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-ink-300">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-ink-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-ink-700/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary font-medium">
                        {user.first_name[0]}{user.last_name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-ink-100">
                          {user.first_name} {user.last_name}
                          {user.id === currentUser?.id && (
                            <span className="ml-2 text-xs text-ink-500">(you)</span>
                          )}
                        </p>
                        {user.phone && (
                          <p className="text-xs text-ink-400">{user.phone}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-ink-300">{user.email}</td>
                  <td className="py-3 px-4">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        user.is_active
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setEditModalOpen(true);
                        }}
                        className="p-1.5 text-ink-400 hover:text-ink-200 hover:bg-ink-700 rounded transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {user.id !== currentUser?.id && user.is_active && (
                        <button
                          onClick={() => handleDeactivate(user)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                          title="Deactivate"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <InviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInvite={handleInvite}
      />
      <EditModal
        isOpen={editModalOpen}
        user={selectedUser}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedUser(null);
        }}
        onSave={handleUpdate}
        currentUserId={currentUser?.id || ''}
      />
    </div>
  );
}

export default Team;
