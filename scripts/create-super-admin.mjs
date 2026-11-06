import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
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
  apiKey:            vars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        vars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     vars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: vars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             vars.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ============================================================
// ĐIỀN THÔNG TIN SUPER ADMIN VÀO ĐÂY
const SA_EMAIL    = vars.SUPER_ADMIN_EMAIL;
const SA_PASSWORD = vars.SUPER_ADMIN_PASSWORD;
if (!vars.SUPER_ADMIN_EMAIL || !vars.SUPER_ADMIN_PASSWORD) {
  console.error('Thiếu SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD trong .env.local');
  process.exit(1);
}
const SA_NAME     = 'Super Admin';
// ============================================================

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

console.log('⏳ Đang tạo tài khoản Super Admin...');

try {
  const cred = await createUserWithEmailAndPassword(auth, SA_EMAIL, SA_PASSWORD);
  const uid  = cred.user.uid;

  await setDoc(doc(db, 'users', uid), {
    shopId:    '',
    role:      'super_admin',
    name:      SA_NAME,
    phone:     '',
    email:     SA_EMAIL,
    active:    true,
    createdAt: Timestamp.now(),
  });

  console.log('');
  console.log('✅ Super Admin tạo thành công!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Email   :', SA_EMAIL);
  console.log('🔑 Password:', SA_PASSWORD);
  console.log('🆔 UID     :', uid);
  console.log('🛡  Role    : super_admin');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('⚠️  Hãy đổi mật khẩu sau khi đăng nhập lần đầu!');
  console.log('👉 Đăng nhập tại /login → tự động chuyển đến /super-admin/dashboard');
} catch (err) {
  if (err.code === 'auth/email-already-in-use') {
    console.log('⚠️  Email đã tồn tại. Super Admin đã được tạo trước đó.');
  } else {
    console.error('❌ Lỗi:', err.message);
  }
}

process.exit(0);
