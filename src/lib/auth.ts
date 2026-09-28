export interface User {
  uid: string;
  name: string;
  email: string;
  role: 'Customer' | 'Worker' | 'Business' | 'Admin';
  photoURL?: string | null;
  isOnboarded?: boolean;
  hasPaid?: boolean;
  paymentStatus?: 'paid' | 'pending' | 'cancelled';
}

export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  error?: string;
}

const STORAGE_KEY_USER = 'feetrust_user';
const STORAGE_KEY_TOKEN = 'feetrust_token';

export const DEFAULT_USER: User | null = null;

export const getSavedUser = (): User | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (saved) return JSON.parse(saved);
  } catch (e) { }
  return null;
};

export const getSavedToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY_TOKEN);
  } catch (e) {
    return null;
  }
};

const STORAGE_KEY_ONBOARDED = 'feetrust_onboarded_emails';

export const isUserOnboarded = (email?: string): boolean => {
  if (!email) return false;
  try {
    const clean = email.trim().toLowerCase();
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_ONBOARDED) || '[]');
    if (Array.isArray(list) && list.includes(clean)) {
      return true;
    }
    const savedUser = getSavedUser();
    if (savedUser && savedUser.email?.toLowerCase() === clean && (savedUser.isOnboarded || savedUser.role === 'Admin' || savedUser.role === 'Worker' || savedUser.role === 'Business')) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export const markUserOnboarded = (email?: string) => {
  if (!email) return;
  try {
    const clean = email.trim().toLowerCase();
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_ONBOARDED) || '[]');
    if (!list.includes(clean)) {
      list.push(clean);
      localStorage.setItem(STORAGE_KEY_ONBOARDED, JSON.stringify(list));
    }
    const savedUser = getSavedUser();
    if (savedUser && savedUser.email?.toLowerCase() === clean) {
      savedUser.isOnboarded = true;
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(savedUser));
    }
  } catch (e) { }
};

export const unmarkUserOnboarded = (email?: string) => {
  if (!email) return;
  try {
    const clean = email.trim().toLowerCase();
    const list: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY_ONBOARDED) || '[]');
    const updated = list.filter(item => item !== clean);
    localStorage.setItem(STORAGE_KEY_ONBOARDED, JSON.stringify(updated));
    localStorage.removeItem(`onboarded_${clean}`);
    localStorage.removeItem('feetrust_onboarded');
  } catch (e) { }
};

export const setAuthSession = (user: User, token: string, markOnboarded: boolean = false) => {
  try {
    if (markOnboarded || user.isOnboarded || isUserOnboarded(user.email)) {
      user.isOnboarded = true;
      markUserOnboarded(user.email);
    }
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
  } catch (e) { }
};

export const clearAuthSession = () => {
  try {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    // Preserved: STORAGE_KEY_ONBOARDED is retained so returning users skip onboarding
    localStorage.removeItem('feetrust_app_state');
    localStorage.removeItem('cached_workers');
    localStorage.removeItem('cached_businesses');
  } catch (e) { }
};

export interface RegisteredAccount {
  uid: string;
  name: string;
  email: string;
  role: 'Customer' | 'Worker' | 'Business' | 'Admin';
  passwordHash: string;
  photoURL?: string | null;
  createdAt: string;
}

const STORAGE_KEY_ACCOUNTS = 'feetrust_registered_accounts';

export const hashClientPassword = async (password: string): Promise<string> => {
  try {
    const msgBuffer = new TextEncoder().encode(password + "_feetrust_salt_2026");
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = ((hash << 5) - hash) + password.charCodeAt(i);
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash);
  }
};

export const getRegisteredAccounts = (): Record<string, RegisteredAccount> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  return {};
};

export const saveRegisteredAccount = (acc: RegisteredAccount) => {
  try {
    const all = getRegisteredAccounts();
    all[acc.email.toLowerCase().trim()] = acc;
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(all));
  } catch (e) { }
};

export const deleteAccountPermanently = async (
  userId?: string,
  email?: string,
  businessId?: string,
  businessName?: string
) => {
  const cleanEmail = email ? email.trim().toLowerCase() : '';

  try {
    if (userId || cleanEmail || businessId || businessName) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const t = getSavedToken();
      if (t) headers['Authorization'] = `Bearer ${t}`;
      await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          email: cleanEmail,
          businessId,
          businessName
        }),
      }).catch(() => { });
    }
  } catch (e) { }

  if (cleanEmail) {
    unmarkUserOnboarded(cleanEmail);
    try {
      const allAccounts = getRegisteredAccounts();
      delete allAccounts[cleanEmail];
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(allAccounts));
    } catch (e) { }
    try {
      const rawMock = localStorage.getItem('feetrust_mock_users');
      if (rawMock) {
        const mockUsers = JSON.parse(rawMock);
        delete mockUsers[cleanEmail];
        localStorage.setItem('feetrust_mock_users', JSON.stringify(mockUsers));
      }
    } catch (e) { }
    localStorage.removeItem(`onboarded_${cleanEmail}`);
  }

  try {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem('feetrust_app_state');
    localStorage.removeItem('cached_workers');
    localStorage.removeItem('cached_businesses');
    localStorage.removeItem('feetrust_cached_workers');
    localStorage.removeItem('feetrust_cached_businesses');
    localStorage.removeItem('feetrust_claimed_coupons');
    localStorage.removeItem('feetrust_pending_invite');
    localStorage.removeItem('feetrust_onboarded');
    sessionStorage.clear();
  } catch (e) { }
};

// API Calls with Vercel SPA Integration

export const apiSignUp = async (
  email: string,
  password: string,
  name: string,
  role: 'Customer' | 'Worker' | 'Business' = 'Customer'
): Promise<AuthResponse> => {
  const cleanEmail = email.trim().toLowerCase();
  const passHash = await hashClientPassword(password);

  let finalUser: User | null = null;
  let finalToken: string | null = null;

  // 1. Primary: Express REST API on Vercel
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password, name, role }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        if (data.error && data.error.includes('exists')) {
          // Account already exists on server
          throw new Error(data.error);
        }
      } else if (data.user) {
        finalUser = data.user;
        finalToken = data.token;
      }
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('exists') || err.message.includes('already exists'))) {
      throw err;
    }
  }

  // 2. Client-side SPA Registration if server is cold or offline
  if (!finalUser) {
    finalUser = {
      uid: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: name.trim() || 'User',
      email: cleanEmail,
      role: role,
      photoURL: null,
      isOnboarded: true,
    };
    finalToken = 'token_' + finalUser.uid + '_' + Date.now();
  }

  // Save account to persistent local vault across signouts
  saveRegisteredAccount({
    uid: finalUser.uid,
    name: finalUser.name,
    email: cleanEmail,
    role: finalUser.role,
    passwordHash: passHash,
    photoURL: finalUser.photoURL,
    createdAt: new Date().toISOString(),
  });

  setAuthSession(finalUser, finalToken!, true);
  return { success: true, user: finalUser, token: finalToken! };
};

export const apiLogin = async (email: string, password: string): Promise<AuthResponse> => {
  const cleanEmail = email.trim().toLowerCase();
  const passHash = await hashClientPassword(password);

  let serverError = '';
  let serverStatus = 0;
  let serverReachable = false;

  // 1. Primary: Express REST API on Vercel
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });
    serverStatus = res.status;
    serverReachable = true;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (res.ok && data.user) {
        // Sync account to local vault
        saveRegisteredAccount({
          uid: data.user.uid,
          name: data.user.name,
          email: cleanEmail,
          role: data.user.role,
          passwordHash: passHash,
          photoURL: data.user.photoURL,
          createdAt: new Date().toISOString(),
        });
        setAuthSession(data.user, data.token);
        return data;
      } else {
        serverError = data.error || '';
      }
    }
  } catch (err: any) {
    serverError = err.message || '';
  }

  // The server is the source of truth whenever it actually answered. Only fall back to the
  // local vault when the server was UNREACHABLE (offline) — never when it explicitly denied
  // the login, otherwise a stale local cache would bypass server auth.
  if (serverReachable) {
    throw new Error(serverError || 'Sign in failed. Please check your credentials.');
  }

  // 2. Persistent Account Vault Check (Handles Vercel ephemeral /tmp instance isolation)
  const allAccounts = getRegisteredAccounts();
  const localAccount = allAccounts[cleanEmail];

  if (localAccount) {
    // Verify password hash
    if (localAccount.passwordHash && localAccount.passwordHash !== passHash) {
      throw new Error('Incorrect password. Please check your credentials.');
    }

    const restoredUser: User = {
      uid: localAccount.uid,
      name: localAccount.name,
      email: localAccount.email,
      role: localAccount.role,
      photoURL: localAccount.photoURL || null,
      isOnboarded: true,
    };
    const token = 'token_' + restoredUser.uid + '_' + Date.now();
    setAuthSession(restoredUser, token);

    return { success: true, user: restoredUser, token };
  }

  // 3. Fallback: Saved Session Check
  const savedUser = getSavedUser();
  if (savedUser && savedUser.email?.toLowerCase() === cleanEmail) {
    const token = getSavedToken() || ('token_' + savedUser.uid + '_' + Date.now());
    setAuthSession(savedUser, token);
    return { success: true, user: savedUser, token };
  }

  throw new Error("No account found with this email. Please click 'Sign Up' tab to create an account.");
};

export const apiGoogleSignIn = async (payload?: {
  credential?: string;
  accessToken?: string;
  email?: string;
  name?: string;
  photoURL?: string;
  role?: 'Customer' | 'Worker' | 'Business';
}): Promise<AuthResponse & { isNewUser?: boolean }> => {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.user) {
    throw new Error(data?.error || 'Google authentication failed. Please try again.');
  }
  const onboarded = !data.isNewUser && isUserOnboarded(data.user.email);
  setAuthSession(data.user, data.token, onboarded);
  return data;
};

export const apiUpdateRole = async (role: 'Customer' | 'Worker' | 'Business'): Promise<User> => {
  const token = getSavedToken();
  const res = await fetch('/api/auth/role', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ role }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.user) {
    throw new Error(data?.error || 'Failed to update user role.');
  }
  return data.user;
};

export const getAccessToken = async (): Promise<string | null> => {
  return getSavedToken() || 'demo_token';
};
