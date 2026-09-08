export const GROUPS = [{ id: 'musik-1', name: 'Himti Musik 1' }, { id: 'musik-2', name: 'Himti Musik 2' }];
export const STATUSES = ['Calon', 'Aktif', 'Nonaktif'];
export const PROCESSES = ['Selesai', 'Incoming', 'Outgoing', 'Transfer'];

export function normalizePhone(value = '') {
  let phone = String(value).trim().replace(/[\s().-]/g, '').replace(/^\+/, '');
  if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
  else if (phone.startsWith('8')) phone = `62${phone}`;
  if (phone && !/^\d{8,15}$/.test(phone)) throw new Error('Nomor WhatsApp harus 8–15 digit.');
  return phone;
}

export function memberInput(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Data member tidak valid.');
  const groupId = String(raw.groupId || ''), name = String(raw.name || '').trim();
  const status = String(raw.status || ''), process = String(raw.process || ''), updatedDate = String(raw.updatedDate || ''), notes = String(raw.notes || '').trim();
  if (!GROUPS.some((group) => group.id === groupId)) throw new Error('Kelompok tidak valid.');
  if (!name || name.length > 100) throw new Error('Nama wajib diisi dan maksimal 100 karakter.');
  if (!STATUSES.includes(status)) throw new Error('Status member tidak valid.');
  if (!PROCESSES.includes(process)) throw new Error('Proses member tidak valid.');
  const date = new Date(`${updatedDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updatedDate) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== updatedDate) throw new Error('Tanggal update tidak valid.');
  if (notes.length > 2000) throw new Error('Keterangan maksimal 2.000 karakter.');
  if (process === 'Incoming' && status !== 'Calon') throw new Error('Incoming harus berstatus Calon.');
  if (['Outgoing', 'Transfer'].includes(process) && status !== 'Aktif') throw new Error('Outgoing / Transfer harus berstatus Aktif.');
  return { groupId, name, phone: normalizePhone(raw.phone), status, process, updatedDate, notes };
}

export function completeMember(member, targetGroup) {
  if (member.process === 'Selesai') throw new Error('Proses member sudah selesai.');
  if (member.process === 'Incoming') return { groupId: member.group_id, status: 'Aktif', process: 'Selesai' };
  if (member.process === 'Outgoing') return { groupId: member.group_id, status: 'Nonaktif', process: 'Selesai' };
  if (member.process === 'Transfer') {
    if (!GROUPS.some((group) => group.id === targetGroup) || targetGroup === member.group_id) throw new Error('Pilih kelompok tujuan yang berbeda.');
    return { groupId: targetGroup, status: 'Aktif', process: 'Selesai' };
  }
  throw new Error('Proses tidak dikenal.');
}

export function summary(members) {
  return { active: members.filter((member) => member.status === 'Aktif').length, incoming: members.filter((member) => member.process === 'Incoming').length, outgoing: members.filter((member) => member.process === 'Outgoing').length, transfer: members.filter((member) => member.process === 'Transfer').length };
}
