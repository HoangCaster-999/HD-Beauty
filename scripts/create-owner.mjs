import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Đọc .env.local
const envPath = resolve(__dirname, '../.env.local');
const env = readFileSync(envPath, 'utf-8');
const vars = Object.fromEntries(
  env.split('\n')
    .filter(line => line.includes('='))
    .map(line => {
      const [key, ...rest] = line.split('=');
      return [key.trim(), rest.join('=').trim()];
    })
);

const firebaseConfig = {
  apiKey: vars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: vars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: vars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: vars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: vars.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ============================================================
// ĐIỀN THÔNG TIN OWNER VÀO ĐÂY
const OWNER_EMAIL    = vars.OWNER_EMAIL;
const OWNER_PASSWORD = vars.OWNER_PASSWORD;
if (!vars.OWNER_EMAIL || !vars.OWNER_PASSWORD) {
  console.error('Thiếu OWNER_EMAIL, OWNER_PASSWORD trong .env.local');
  process.exit(1);
}
const OWNER_NAME     = 'Chủ Tiệm';
const OWNER_PHONE    = '0901234567';
// ============================================================

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

console.log('⏳ Đang tạo tài khoản Owner...');

try {
  const cred = await createUserWithEmailAndPassword(auth, OWNER_EMAIL, OWNER_PASSWORD);
  const uid  = cred.user.uid;

  await setDoc(doc(db, 'users', uid), {
    shopId:    '',
    role:      'owner',
    name:      OWNER_NAME,
    phone:     OWNER_PHONE,
    email:     OWNER_EMAIL,
    active:    true,
    createdAt: Timestamp.now(),
  });

  console.log('✅ Tạo thành công!');
  console.log('');
  console.log('📧 Email   :', OWNER_EMAIL);
  console.log('🔑 Password:', OWNER_PASSWORD);
  console.log('🆔 UID     :', uid);
  console.log('');
  console.log('👉 Bây giờ chạy: npm run dev  →  đăng nhập  →  tạo tiệm');
} catch (err) {
  if (err.code === 'auth/email-already-in-use') {
    console.log('⚠️  Email đã tồn tại. Dùng email khác hoặc đăng nhập thẳng vào app.');
  } else {
    console.error('❌ Lỗi:', err.message);
  }
}

process.exit(0);
