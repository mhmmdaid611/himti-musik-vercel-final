import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, verifyPassword } from '../backend/src/auth.js';
import { memberInput, completeMember, summary } from '../backend/src/validation.js';

test('password memakai hash dan hanya password asli yang lolos', () => { const hash = hashPassword('password-ku-aman'); assert.notEqual(hash, 'password-ku-aman'); assert.equal(verifyPassword('password-ku-aman', hash), true); assert.equal(verifyPassword('salah', hash), false); });
test('status, proses, transfer, dan ringkasan mengikuti aturan komunitas', () => { assert.throws(() => memberInput({ groupId: 'musik-1', name: 'A', phone: '', status: 'Aktif', process: 'Incoming', updatedDate: '2026-09-06', notes: '' })); const member = memberInput({ groupId: 'musik-1', name: 'A', phone: '08123456789', status: 'Aktif', process: 'Transfer', updatedDate: '2026-09-06', notes: '' }); assert.deepEqual(completeMember({ ...member, group_id: member.groupId }, 'musik-2'), { groupId: 'musik-2', status: 'Aktif', process: 'Selesai' }); assert.deepEqual(summary([{ status: 'Aktif', process: 'Transfer' }, { status: 'Nonaktif', process: 'Selesai' }]), { active: 1, incoming: 0, outgoing: 0, transfer: 1 }); });
