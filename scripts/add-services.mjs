import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
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

const app  = initializeApp({ apiKey: vars.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: vars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket: vars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, messagingSenderId: vars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: vars.NEXT_PUBLIC_FIREBASE_APP_ID });
const auth = getAuth(app);
const db   = getFirestore(app);

// ════════════════════════════════════════════
//  DANH SÁCH DỊCH VỤ — thêm / sửa tại đây
// ════════════════════════════════════════════
const SERVICES = [
  // ── Sơn móng ──────────────────────────────
  { name: 'Sơn gel màu',               price: 150_000 },
  { name: 'Sơn thường (đổi màu)',      price:  80_000 },
  { name: 'Sơn gel ombre / gradient',  price: 200_000 },
  { name: 'Sơn gel cat eye',           price: 180_000 },
  { name: 'Sơn gel chrome / gương',    price: 220_000 },

  // ── Đắp móng ──────────────────────────────
  { name: 'Đắp gel Full Set',          price: 280_000 },
  { name: 'Đắp bột acrylic Full Set',  price: 350_000 },
  { name: 'Đắp móng giả (Tip)',        price: 200_000 },
  { name: 'Bấm bột / Fill bột',        price: 180_000 },
  { name: 'Bấm gel / Fill gel',        price: 150_000 },

  // ── Nail art ──────────────────────────────
  { name: 'Nail art cơ bản (1 ngón)',  price:  30_000 },
  { name: 'Vẽ hoa / hoạ tiết',        price:  50_000 },
  { name: 'Đính đá rhinestone',        price:  20_000 },
  { name: 'Foil / giấy bạc',          price:  40_000 },
  { name: 'Sticker nail / decal',      price:  25_000 },

  // ── Chăm sóc ──────────────────────────────
  { name: 'Tẩy gel / Tẩy bột',        price:  80_000 },
  { name: 'Sửa móng gãy (1 móng)',     price:  30_000 },
  { name: 'Cắt & dũa móng tay',        price:  50_000 },
  { name: 'Spa tay dưỡng da',          price: 100_000 },
  { name: 'Wax tay / chân',           price: 120_000 },

  // ── Móng chân ─────────────────────────────
  { name: 'Sơn chân thường',           price:  60_000 },
  { name: 'Sơn chân gel',              price: 120_000 },
  { name: 'Spa chân cơ bản',           price: 150_000 },
  { name: 'Spa chân đặc trị',          price: 220_000 },
];
// ════════════════════════════════════════════

const OWNER_EMAIL    = vars.OWNER_EMAIL;
const OWNER_PASSWORD = vars.OWNER_PASSWORD;
if (!vars.OWNER_EMAIL || !vars.OWNER_PASSWORD) {
  console.error('Thiếu OWNER_EMAIL, OWNER_PASSWORD trong .env.local');
  process.exit(1);
}

const cred   = await signInWithEmailAndPassword(auth, OWNER_EMAIL, OWNER_PASSWORD);
const shopId = cred.user.uid; // shopId = ownerUid theo cách setup hiện tại

console.log(`\n📦 Đang thêm dịch vụ vào tiệm (shopId: ${shopId})...\n`);

// Lấy danh sách tên đã có để tránh trùng
const snap = await getDocs(query(collection(db, 'services'), where('shopId', '==', shopId)));
const existing = new Set(snap.docs.map(d => d.data().name));

let added = 0, skipped = 0;
for (const svc of SERVICES) {
  if (existing.has(svc.name)) {
    console.log(`  ⚠️  Bỏ qua (đã có): ${svc.name}`);
    skipped++;
    continue;
  }
  await addDoc(collection(db, 'services'), {
    shopId, name: svc.name, price: svc.price, active: true, createdAt: Timestamp.now(),
  });
  console.log(`  ✅ Thêm: ${svc.name.padEnd(30)} ${svc.price.toLocaleString('vi-VN')}đ`);
  added++;
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  Thêm mới: ${added}   |   Bỏ qua: ${skipped}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

process.exit(0);
