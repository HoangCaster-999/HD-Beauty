/**
 * setup.mjs — Chạy toàn bộ setup 1 lần:
 *   1. Tạo Super Admin
 *   2. Tạo Owner
 *   3. Tạo tiệm HD Beauty + seed 12 dịch vụ nail
 *
 * Chạy: npm run setup
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, getDocs, query, where,
  Timestamp,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
const vars = Object.fromEntries(
  env.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim()];
  })
);

const firebaseConfig = {
  apiKey:            vars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        vars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     vars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: vars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             vars.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ═══════════════════════════════════════════
//   CẤU HÌNH — sửa tại đây nếu cần
// ═══════════════════════════════════════════
if (!vars.SUPER_ADMIN_EMAIL || !vars.SUPER_ADMIN_PASSWORD || !vars.OWNER_EMAIL || !vars.OWNER_PASSWORD) {
  console.error('Thiếu SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, OWNER_EMAIL, OWNER_PASSWORD trong .env.local');
  process.exit(1);
}

const SUPER_ADMIN = {
  email:    vars.SUPER_ADMIN_EMAIL,
  password: vars.SUPER_ADMIN_PASSWORD,
  name:     'Super Admin',
};

const OWNER = {
  email:    vars.OWNER_EMAIL,
  password: vars.OWNER_PASSWORD,
  name:     'Chủ Tiệm',
  phone:    '0901234567',
};

const SHOP_NAME = 'HD Beauty';

const SERVICES = [
  { name: 'Sơn gel màu',              price: 150_000 },
  { name: 'Sơn thường (đổi màu)',     price:  80_000 },
  { name: 'Đắp bột Full Set',         price: 350_000 },
  { name: 'Đắp gel Full Set',         price: 280_000 },
  { name: 'Nail art / Vẽ tay',        price: 100_000 },
  { name: 'Tẩy gel / Tẩy bột',       price:  80_000 },
  { name: 'Sơn chân thường',          price:  60_000 },
  { name: 'Sơn chân gel',             price: 120_000 },
  { name: 'Spa tay dưỡng da',         price: 100_000 },
  { name: 'Đính đá / Vẽ hoa',        price:  50_000 },
  { name: 'Sửa móng gãy (1 móng)',    price:  30_000 },
  { name: 'Đắp móng giả (Tip)',       price: 200_000 },
];
// ═══════════════════════════════════════════

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

function log(msg)  { console.log(msg); }
function ok(msg)   { console.log('  ✅ ' + msg); }
function skip(msg) { console.log('  ⚠️  ' + msg); }
function fail(msg) { console.log('  ❌ ' + msg); }
function sep()     { console.log(''); }

// ─── 1. Super Admin ─────────────────────────────────────────
sep();
log('━━━ [1/3] Super Admin ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const cred = await createUserWithEmailAndPassword(auth, SUPER_ADMIN.email, SUPER_ADMIN.password);
  await setDoc(doc(db, 'users', cred.user.uid), {
    shopId: '', role: 'super_admin',
    name: SUPER_ADMIN.name, phone: '', email: SUPER_ADMIN.email,
    active: true, createdAt: Timestamp.now(),
  });
  ok(`Super Admin tạo xong  |  ${SUPER_ADMIN.email}  /  ${SUPER_ADMIN.password}`);
} catch (e) {
  if (e.code === 'auth/email-already-in-use') skip('Super Admin đã tồn tại — bỏ qua');
  else { fail(e.message); process.exit(1); }
}

// ─── 2. Owner ───────────────────────────────────────────────
sep();
log('━━━ [2/3] Owner ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
let ownerUid;
try {
  const cred = await createUserWithEmailAndPassword(auth, OWNER.email, OWNER.password);
  ownerUid = cred.user.uid;
  await setDoc(doc(db, 'users', ownerUid), {
    shopId: '', role: 'owner',
    name: OWNER.name, phone: OWNER.phone, email: OWNER.email,
    active: true, createdAt: Timestamp.now(),
  });
  ok(`Owner tạo xong  |  ${OWNER.email}  /  ${OWNER.password}`);
} catch (e) {
  if (e.code === 'auth/email-already-in-use') {
    skip('Owner đã tồn tại — đăng nhập lấy UID');
    const cred2 = await signInWithEmailAndPassword(auth, OWNER.email, OWNER.password);
    ownerUid = cred2.user.uid;
  } else { fail(e.message); process.exit(1); }
}

// ─── 3. Shop + Services ─────────────────────────────────────
sep();
log('━━━ [3/3] Tiệm & Dịch vụ ━━━━━━━━━━━━━━━━━━━━━━━━━━');

const userSnap = await getDoc(doc(db, 'users', ownerUid));
let shopId = userSnap.data()?.shopId || '';

if (shopId) {
  skip(`Tiệm đã có (shopId: ${shopId}) — bỏ qua tạo mới`);
} else {
  shopId = ownerUid; // dùng ownerUid làm shopId → idempotent
  await setDoc(doc(db, 'shops', shopId), {
    name: SHOP_NAME, ownerId: ownerUid, createdAt: Timestamp.now(),
  });
  await updateDoc(doc(db, 'users', ownerUid), { shopId });
  ok(`Tiệm "${SHOP_NAME}" tạo xong  |  ID: ${shopId}`);
}

// Seed services
let added = 0, skipped = 0;
for (const svc of SERVICES) {
  const exists = await getDocs(
    query(collection(db, 'services'), where('shopId', '==', shopId), where('name', '==', svc.name))
  );
  if (!exists.empty) { skipped++; continue; }
  await addDoc(collection(db, 'services'), {
    shopId, name: svc.name, price: svc.price, active: true, createdAt: Timestamp.now(),
  });
  added++;
}

if (added > 0)   ok(`Đã seed ${added} dịch vụ nail mặc định`);
if (skipped > 0) skip(`${skipped} dịch vụ đã tồn tại — bỏ qua`);

// ─── Tổng kết ───────────────────────────────────────────────
sep();
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('  HOÀN TẤT SETUP');
log('');
log(`  Super Admin :  ${SUPER_ADMIN.email}  /  ${SUPER_ADMIN.password}`);
log(`  Owner       :  ${OWNER.email}  /  ${OWNER.password}`);
log(`  Tiệm        :  ${SHOP_NAME}  (${shopId})`);
log(`  Dịch vụ     :  ${SERVICES.length} dịch vụ nail`);
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
sep();

process.exit(0);
