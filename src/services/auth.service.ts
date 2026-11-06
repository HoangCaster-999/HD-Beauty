import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  getAuth,
} from 'firebase/auth';
import { initializeApp, deleteApp, getApp as fbGetApp } from 'firebase/app';
import { doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { encryptPassword, decryptPassword } from '@/lib/crypto';
import { UserRole } from '@/types';

export async function loginWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function createStaffAccount(
  email: string,
  password: string,
  name: string,
  phone: string,
  shopId: string,
  role: UserRole = 'staff'
) {
  const config = fbGetApp().options;
  const appName = `create-staff-${Date.now()}`;
  const secondaryApp = initializeApp(config, appName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;

    const encPwd = await encryptPassword(password);
    // Ghi bằng token của người tạo: firestore.rules kiểm tra role của người tạo, không phải tài khoản mới
    await setDoc(doc(db, 'users', uid), {
      shopId,
      role,
      name,
      phone,
      email,
      active: true,
      encryptedPassword: encPwd,
      createdAt: Timestamp.now(),
    });

    return uid;
  } finally {
    // Fire-and-forget: don't let deleteApp errors mask actual errors
    deleteApp(secondaryApp).catch(() => {});
  }
}

// Đổi mật khẩu cho staff (dùng secondary Firebase app để không đăng xuất owner)
// Trả về encryptedPassword mới đã mã hoá để lưu lại vào Firestore
export async function setStaffPassword(
  staffId: string,
  staffEmail: string,
  currentEncryptedPassword: string,
  newPassword: string,
): Promise<string> {
  const currentPassword = await decryptPassword(currentEncryptedPassword);

  const config = fbGetApp().options;
  const appName = `staff-pwd-${Date.now()}`;
  const secondaryApp = initializeApp(config, appName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await signInWithEmailAndPassword(secondaryAuth, staffEmail, currentPassword);
    await updatePassword(cred.user, newPassword);
  } finally {
    await deleteApp(secondaryApp);
  }

  const newEncrypted = await encryptPassword(newPassword);
  await updateDoc(doc(db, 'users', staffId), { encryptedPassword: newEncrypted });
  return newEncrypted;
}

// Tạo owner + tiệm cùng lúc, dùng secondary app để không đăng xuất super admin
export async function createOwnerWithShop(
  shopName: string,
  ownerEmail: string,
  ownerPassword: string,
  ownerName: string,
  ownerPhone: string,
): Promise<{ shopId: string; ownerId: string }> {
  const config = fbGetApp().options;
  const appName = `create-owner-${Date.now()}`;
  const secondaryApp = initializeApp(config, appName);
  const secondaryAuth = getAuth(secondaryApp);

  let ownerId: string;
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, ownerEmail, ownerPassword);
    ownerId = cred.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }

  const shopId = ownerId;
  const encPwd = await encryptPassword(ownerPassword);

  await Promise.all([
    setDoc(doc(db, 'shops', shopId), {
      name: shopName,
      ownerId,
      createdAt: Timestamp.now(),
    }),
    setDoc(doc(db, 'users', ownerId), {
      shopId,
      role: 'owner' as UserRole,
      name: ownerName,
      phone: ownerPhone,
      email: ownerEmail,
      active: true,
      encryptedPassword: encPwd,
      createdAt: Timestamp.now(),
    }),
  ]);

  return { shopId, ownerId };
}

// Tạo user mới cho một tiệm đã có, dùng secondary app để không đăng xuất super admin
export async function createUserForShop(
  shopId: string,
  email: string,
  password: string,
  name: string,
  phone: string,
  role: UserRole,
): Promise<string> {
  const config = fbGetApp().options;
  const appName = `create-user-${Date.now()}`;
  const secondaryApp = initializeApp(config, appName);
  const secondaryAuth = getAuth(secondaryApp);

  let uid: string;
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    uid = cred.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }

  const encPwd = await encryptPassword(password);
  await setDoc(doc(db, 'users', uid), {
    shopId,
    role,
    name,
    phone,
    email,
    active: true,
    encryptedPassword: encPwd,
    createdAt: Timestamp.now(),
  });

  return uid;
}

export async function resetStaffPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No user logged in');

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}
