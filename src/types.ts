export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
}

export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  bio: string;
  avatar_key: string;
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
}

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_key: string;
  can_delete: boolean;
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
  posts: Post[];
}

export interface ExplorePost extends Post {
  username: string;
  display_name: string;
  avatar_key?: string;
  author_avatar_key?: string;
}

export interface ExploreUser {
  id: number;
  username: string;
  display_name: string;
  avatar_key: string;
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
}



