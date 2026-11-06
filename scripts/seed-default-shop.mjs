/**
 * seed-default-shop.mjs
 * Tạo tiệm "HD Beauty" và seed 12 dịch vụ nail mặc định cho owner account.
 *
 * Chạy: node scripts/seed-default-shop.mjs
 *    hoặc: npm run seed:shop
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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
const envPath  = resolve(__dirname, '../.env.local');
const env      = readFileSync(envPath, 'utf-8');
const vars     = Object.fromEntries(
  env.split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const firebaseConfig = {
  apiKey:            vars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        vars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     vars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: vars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             vars.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ===== THÔNG TIN OWNER =====
const OWNER_EMAIL    = vars.OWNER_EMAIL;
const OWNER_PASSWORD = vars.OWNER_PASSWORD;
if (!vars.OWNER_EMAIL || !vars.OWNER_PASSWORD) {
  console.error('Thiếu OWNER_EMAIL, OWNER_PASSWORD trong .env.local');
  process.exit(1);
}
const SHOP_NAME      = 'HD Beauty';
// ===========================

const DEFAULT_SERVICES = [
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

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

console.log(`⏳ Đăng nhập với ${OWNER_EMAIL}...`);

try {
  const cred = await signInWithEmailAndPassword(auth, OWNER_EMAIL, OWNER_PASSWORD);
  const uid  = cred.user.uid;
  console.log('✅ Đăng nhập thành công | UID:', uid);

  // Đọc user document (allowed: user đọc chính mình)
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) {
    console.error('❌ Không tìm thấy user document. Chạy create-owner.mjs trước.');
    process.exit(1);
  }

  const userData = userSnap.data();
  let shopId = userData.shopId;

  if (shopId && shopId.length > 0) {
    console.log(`⚠️  Owner đã có shopId: ${shopId}`);
    console.log('   → Bỏ qua tạo tiệm, chỉ seed dịch vụ còn thiếu.');
  } else {
    // Tạo shop mới — dùng uid làm shopId để idempotent
    shopId = uid;
    await setDoc(doc(db, 'shops', shopId), {
      name:      SHOP_NAME,
      ownerId:   uid,
      createdAt: Timestamp.now(),
    });

    // Cập nhật shopId cho owner (user tự update bản thân — rules cho phép)
    await updateDoc(doc(db, 'users', uid), { shopId });

    console.log(`✅ Tạo tiệm "${SHOP_NAME}" thành công!`);
    console.log('   Shop ID:', shopId);
  }

  // Seed dịch vụ — đọc services đã có (sau khi shopId cập nhật, isAdminOf sẽ pass)
  // Tạo từng dịch vụ, bỏ qua nếu trùng tên
  let added   = 0;
  let skipped = 0;

  for (const svc of DEFAULT_SERVICES) {
    // Kiểm tra trùng tên trong shop
    const check = await getDocs(
      query(collection(db, 'services'),
        where('shopId', '==', shopId),
        where('name', '==', svc.name))
    );
    if (!check.empty) { skipped++; continue; }

    await addDoc(collection(db, 'services'), {
      shopId,
      name:      svc.name,
      price:     svc.price,
      active:    true,
      createdAt: Timestamp.now(),
    });
    added++;
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Seed ${added} dịch vụ mặc định thành công!`);
  if (skipped > 0) console.log(`   (${skipped} dịch vụ đã tồn tại, bỏ qua)`);
  console.log('');
  console.log('📋 Danh sách dịch vụ mặc định:');
  DEFAULT_SERVICES.forEach((s, i) => {
    console.log(`   ${String(i + 1).padStart(2)}. ${s.name.padEnd(28)} ${(s.price).toLocaleString('vi-VN')}đ`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('👉 Đăng nhập app → Chủ tiệm → Dịch vụ để sửa giá / tên.');
} catch (err) {
  if (err.code === 'auth/invalid-credential') {
    console.error('❌ Sai email/mật khẩu. Kiểm tra OWNER_EMAIL và OWNER_PASSWORD trong script.');
  } else {
    console.error('❌ Lỗi:', err.code ?? '', err.message);
  }
}

process.exit(0);
