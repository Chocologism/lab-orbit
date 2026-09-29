export interface Env {
  DB: D1Database;
  FILES_BUCKET?: R2Bucket;
  JWT_SECRET?: string;
  INVITE_CODE?: string;
  ASSETS?: Fetcher;
}

export interface UserRow {
  id: number;
  name: string;
  real_name: string;
  nickname: string;
  email: string;
  hashed_password: string;
  role: string; // 'student' | 'teacher' | 'admin'
  identity: string; // 'student' | 'teacher'
  avatar: string | null;
  bio: string | null;
  token_version: number;
  can_manage_seminars: number; // 0 or 1
  zotero_user_id?: string | null;
  zotero_api_key?: string | null;
  zotero_default_collection?: string | null;
  last_active_at?: string | null;
  created_at: string;
}

export interface JWTPayload {
  sub: string; // user id
  email?: string;
  role?: string;
  name?: string;
  token_version?: number;
  exp: number;
}
