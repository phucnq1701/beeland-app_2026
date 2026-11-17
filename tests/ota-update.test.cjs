// Cập nhật OTA khi mở app (lib/otaUpdate.ts). Chạy: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./helpers/loadTs.cjs');

const { runOtaUpdate, formatUpdatingClock, shortBundleId, progressPercent } = loadTs('lib/otaUpdate.ts', {
  globals: { setTimeout, clearTimeout },
});
const plain = (v) => JSON.parse(JSON.stringify(v));

function deps(over = {}) {
  const calls = [];
  return {
    calls,
    check: async () => (calls.push('check'), { isAvailable: false }),
    fetch: async () => calls.push('fetch'),
    reload: async () => void calls.push('reload'),
    onUpdating: () => calls.push('updating'),
    ...over,
  };
}

test('không có bản mới → vào app ngay, không hiện màn chờ', async () => {
  const d = deps();
  assert.equal(await runOtaUpdate(d), 'none');
  assert.deepEqual(d.calls, ['check']);
});

test('có bản mới → hiện màn chờ, tải, reload', async () => {
  const d = deps({ check: async () => (d.calls.push('check'), { isAvailable: true }) });
  assert.equal(await runOtaUpdate(d), 'reloading');
  assert.deepEqual(d.calls, ['check', 'updating', 'fetch', 'reload']);
});

test('offline / máy chủ lỗi khi hỏi → vào app, không hiện màn chờ', async () => {
  const d = deps({ check: async () => { throw new Error('Network request failed'); } });
  assert.equal(await runOtaUpdate(d), 'error');
  assert.deepEqual(d.calls, []);
});

test('máy chủ treo khi hỏi → hết thời gian thì vào app', async () => {
  const d = deps({ check: () => new Promise(() => {}) });
  assert.equal(await runOtaUpdate(d, { checkTimeoutMs: 20 }), 'error');
  assert.deepEqual(d.calls, []);
});

test('tải lỗi giữa chừng → thoát màn chờ, không reload', async () => {
  const d = deps({
    check: async () => ({ isAvailable: true }),
    fetch: async () => { throw new Error('mất mạng'); },
  });
  assert.equal(await runOtaUpdate(d), 'error');
  assert.deepEqual(d.calls, ['updating']);
});

test('tải treo → hết thời gian thì thoát màn chờ', async () => {
  const d = deps({ check: async () => ({ isAvailable: true }), fetch: () => new Promise(() => {}) });
  assert.equal(await runOtaUpdate(d, { fetchTimeoutMs: 20 }), 'error');
  assert.deepEqual(d.calls, ['updating']);
});

test('giờ + ngày tiếng Việt', () => {
  assert.deepEqual(plain(formatUpdatingClock(new Date(2026, 9, 21, 8, 5))), { time: '08:05', date: 'Thứ tư, 21 tháng 10, 2026' });
  assert.deepEqual(plain(formatUpdatingClock(new Date(2026, 0, 4, 23, 59))), { time: '23:59', date: 'Chủ nhật, 4 tháng 1, 2026' });
});

test('mã bản: 8 ký tự đầu, bản gốc → "gốc"', () => {
  assert.equal(shortBundleId('0199f3a2-7b1c-7d4e-9a10-1234567890ab', false), '0199f3a2');
  assert.equal(shortBundleId('0199f3a2-7b1c', true), 'gốc');
  assert.equal(shortBundleId(null, false), 'gốc');
});

test('phần trăm tải', () => {
  assert.equal(progressPercent(undefined), null);
  assert.equal(progressPercent(0.426), 43);
  assert.equal(progressPercent(1.2), 100);
});
