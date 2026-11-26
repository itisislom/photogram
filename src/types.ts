import type { PostgresDb } from './db/client';

export interface Env {
  DB: D1Database | PostgresDb;
  STORAGE: R2Bucket;
  ASSETS?: { fetch(request: Request | string): Promise<Response> };
  REALTIME_HUB?: DurableObjectNamespace;
  DATABASE_URL?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  ADMIN_PERMISSIONS?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  bio: string;
  avatar_key: string;
  is_verified?: number | boolean;
  notifications_enabled?: number | boolean;
  created_at: string;
}

export interface Post {
  id: number;
  user_id: number;
  image_key: string;
  caption: string;
  skin_score?: number;
  is_sensitive?: number;
  reports_count?: number;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  username?: string;
  display_name?: string;
  avatar_key?: string;
  is_verified?: number | boolean;
}

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  parent_id?: number | null;
  content: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_key: string;
  can_delete: boolean;
  can_pin?: boolean;
  is_pinned?: boolean;
  liked_by_author?: boolean;
  is_verified?: number | boolean;
  likes_count?: number;
  is_liked?: boolean;
}

export interface ProfileData {
  user: User;
  posts_count: number;
  followers_count: number;
  following_count: number;
  is_owner: boolean;
  is_following: boolean;
  follows_you?: boolean;
  username_changes_left?: number;
  username_unlock_days?: number;
  current_user_id?: number;
  is_admin?: boolean;
  posts: Post[];
}

export interface ExplorePost extends Post {
  username: string;
  display_name: string;
  avatar_key?: string;
  author_avatar_key?: string;
  is_verified?: number | boolean;
}

export interface ExploreUser {
  id: number;
  username: string;
  display_name: string;
  avatar_key: string;
  is_verified?: number | boolean;
}

export interface ExploreData {
  recommended_users: ExploreUser[];
  posts: ExplorePost[];
}

export interface FeedPost extends Post {
  username: string;
  display_name: string;
  avatar_key: string;
  is_followed_author?: boolean;
  is_verified?: number | boolean;
}



export interface FollowerUser {
  id: number;
  username: string;
  display_name: string;
  avatar_key: string;
  is_verified?: number | boolean;
  is_following?: boolean;
  is_self?: boolean;
}

export interface SavedAccountItem {
  id: number;
  username: string;
  display_name: string;
  avatar_key: string;
  is_verified?: number | boolean;
  is_current: boolean;
}

export interface ConversationItem {
  id: number;
  other_user_id: number;
  other_username: string;
  other_display_name: string;
  other_avatar_key: string;
  other_is_verified?: number | boolean;
  last_message_id?: number | null;
  last_message_body: string;
  last_message_image: boolean;
  last_message_encrypted?: boolean;
  last_message_sender_id: number | null;
  last_message_sender_device_id?: number;
  last_message_ciphertext_envelope?: string;
  last_message_edit_version?: number;
  last_message_read?: boolean;
  last_message_at: string;
  unread_count: number;
}

export interface CiphertextEnvelopeItem {
  u: number;
  d: number;
  t: number;
  b: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface DirectMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  image_key: string;
  is_encrypted?: number | boolean;
  sender_device_id?: number;
  ciphertext_envelope?: string;
  read_at: string | null;
  listened_at?: string | null;
  edited_at?: string | null;
  edit_version?: number;
  created_at: string;
  reactions?: MessageReaction[];
}

export interface NotificationItem {
  id: number;
  type: 'like' | 'comment' | 'comment_like' | 'comment_reply' | 'follow' | 'mention';
  actor_id: number;
  actor_username: string;
  actor_display_name: string;
  actor_avatar_key: string;
  actor_is_verified?: number | boolean;
  post_id: number | null;
  post_image_key: string;
  post_author_username?: string;
  comment_preview: string;
  is_read: boolean;
  is_following_actor: boolean;
  created_at: string;
}
