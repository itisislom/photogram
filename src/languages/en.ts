import { Translations } from './types';

export const en: Translations = {
  code: 'en',
  name: 'English',

  common: {
    appName: 'Photogram',
    loading: 'Loading...',
    saving: 'Saving...',
    creating: 'Creating...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    close: 'Close',
    attention: 'Attention',
    authRequired: 'Authorization Required',
    authRequiredMsg: 'You must log in to your account to perform this action.',
    networkError: 'Network error',
    understood: 'Got it',
    yes: 'Yes',
    no: 'No',
    justNow: 'just now',
    minutesShort: 'm',
    hoursShort: 'h',
    daysShort: 'd',
    likesCount: (n: number) => {
      if (n === 1) return '1 like';
      return `${n} likes`;
    },
    commentsCount: (n: number) => `Comments (${n})`,
    postsCount: (n: number) => `${n}`,
    followersCount: (n: number) => `${n}`,
    followingCount: (n: number) => `${n}`,
    selectLanguage: 'Language',
  },

  nav: {
    feed: 'Feed',
    explore: 'Explore & Search',
    create: 'Create Post',
    profile: 'Profile',
    menu: 'Menu',
    settings: 'Settings',
    logout: 'Log Out',
  },

  auth: {
    loginTitle: 'Log in to Photogram',
    registerTitle: 'Sign up for Photogram',
    username: 'Username',
    displayName: 'Name',
    password: 'Password',
    loginBtn: 'Log In',
    registerBtn: 'Sign Up',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    termsNotice: 'Before registering, you must accept the',
    termsLinkText: 'user agreement',
    termsModalTitle: 'User Agreement',
    accept18Plus: 'Accept (18+)',
    errUsernameFormat: 'Username: 3–24 characters, lowercase letters, numbers and underscores only',
    errDisplayNameRequired: 'Please enter your name',
    errPasswordMin: 'Password must be at least 8 characters',
    errTermsRequired: 'You must accept the user agreement before signing up',
  },

  feed: {
    noPosts: 'No posts yet',
    noPostsDesc: 'Follow other users in the Explore tab or share your first photo!',
    addComment: 'Add a comment...',
    viewAllComments: (n: number) => `View all ${n} comments`,
  },

  explore: {
    title: 'Explore',
    searchPlaceholder: 'Search users...',
    noResults: 'No users found',
    users: 'Users',
    posts: 'Posts',
  },

  profile: {
    editProfile: 'Edit profile',
    follow: 'Follow',
    following: 'Following',
    followBack: 'Follow back',
    followsYou: 'Follows you',
    bio: 'Bio',
    changePhoto: 'Change photo',
    uploadPhoto: 'Upload photo',
    removePhoto: 'Remove current photo',
    noPosts: 'No posts yet',
    postsTab: 'Posts',
    savedTab: 'Saved',
    menuTitle: 'Menu',
    logoutConfirmTitle: 'Log out?',
    logoutConfirmDesc: 'Are you sure you want to log out of your account?',
    deletePostConfirmTitle: 'Delete post?',
    deletePostConfirmDesc: 'Are you sure you want to delete this post? This action cannot be undone.',
    usernameLimitWarning: (left: number, days: number) =>
      `Limit reached (3 of 3). Next change available in ${days} days.`,
    usernameLimitLeft: (left: number) => `You can change username ${left} more times in 14 days`,
    usernameLimitNormal: 'You can change username up to 3 times in 14 days',
  },

  post: {
    newPostTitle: 'New Post',
    selectPhotoDropzone: 'Click or drag to select photo',
    changePhoto: 'Choose another photo',
    captionLabel: 'Post caption',
    captionPlaceholder: 'Write a caption...',
    publishBtn: 'Share',
    publishing: 'Sharing...',
    nsfwBlocked: 'Photo did not pass automated safety check (18+ content detected)',
    deletePost: 'Delete post',
  },

  error: {
    offlineTitle: 'No internet connection',
    offlineDesc: 'Please check your connection and try again',
    reloadBtn: 'Reload',
  },

  comments: {
    title: 'Comments',
    commentsHeader: (n: number) => `Comments (${n})`,
    firstCommentPrompt: 'Be the first to comment...',
    loading: 'Loading comments...',
    inputPlaceholder: 'Add a comment...',
    send: 'Post',
    deleteTitle: 'Delete comment?',
    deleteConfirm: 'Are you sure you want to delete this comment?',
  },

  recommendations: {
    allCaughtUp: 'You’re all caught up',
    allCaughtUpDesc: 'Suggested posts you might like',
    suggestedForYou: 'Suggested for you',
    whoToFollow: 'Suggested for you',
    follow: 'Follow',
    following: 'Following',
    notInterested: 'Not interested',
    postHidden: 'Post hidden from suggestions',
    relatedPosts: 'Related posts',
    similarAccounts: 'Similar accounts',
    tagForYou: 'For you',
    tagPopular: 'Popular',
    tagRecent: 'Recent',
  },

  legal: {
    backToRegister: 'Back to registration',
    title: 'User Agreement and Data Processing Policy',
    date: 'Effective edition as of October 19, 2026',
    cards: [
      {
        title: '1. Service Status (Vibe Coding / As Is)',
        paragraphs: [
          'This Agreement sets forth the terms of use of the "Photogram" web application (hereinafter the "Service", "Platform") between the Administration (Owner) and any individual using the Service (hereinafter the "User").',
          'The "Photogram" Service is an experimental software product created in the vibe coding format. The Service is provided free of charge strictly on an "AS IS" and "AS AVAILABLE" basis.',
          'The Administration provides no express or implied warranties of uninterrupted, error-free, continuous operation, data preservation, or fitness of the Service for the User’s expectations.',
        ],
      },
      {
        title: '2. Consent to Collection and Processing of Personal Data',
        paragraphs: [
          'By registering in the Service and checking the consent box, the User freely, by their own will and in their own interest gives explicit, unconditional and irrevocable consent to the Administration for the collection, systematization, storage, alteration, use, anonymization, blocking and destruction of personal data (username, display name, bio, avatars, IP addresses, publication metadata, session technical identifiers) in accordance with the Law of the Republic of Uzbekistan "On Personal Data" (ZRU No. 547) and international standards.',
          'The User acknowledges and agrees that they independently and voluntarily post any photo materials and text in public access for an unlimited number of persons.',
        ],
      },
      {
        title: '3. Full Disclaimer of Liability for Cyberattacks and Outages',
        paragraphs: [
          'The Administration, owners, and developers of the Service bear no liability (civil, criminal, administrative, or financial) to the User or third parties for:',
        ],
        list: [
          'Any unauthorized access, hacker activity, cyberattacks, malicious software, interception, data theft or leak, modification or destruction of information;',
          'Hardware, server, or network failures, interruptions in cloud providers, hosting (Cloudflare Workers, D1, R2), or communication channels;',
          'Loss, corruption, deletion, or alteration of publications, photos, or profile data;',
          'Any direct, indirect, incidental damages, lost profits, or moral harm.',
        ],
      },
      {
        title: '4. Exclusive User Liability for Content',
        paragraphs: [
          'The User bears sole, direct, and complete liability (criminal, administrative, and civil) for any materials uploaded to the Service (photos, images, captions, name, and bio) in accordance with the Constitution of the Republic of Uzbekistan, Criminal Code of the Republic of Uzbekistan, Code of Administrative Responsibility of the Republic of Uzbekistan, laws "On Informatization", and applicable international norms (including DMCA):',
        ],
        list: [
          'Publication of extremist, terrorist, or separatist materials, calls to violently change the constitutional order, or incitement of ethnic, racial, or religious hatred is strictly prohibited;',
          'Posting defamation, insults, pornographic content, promotion of violence, narcotics, as well as third-party personal data without their consent is strictly prohibited;',
          'Violation of third-party copyrights and intellectual property rights is strictly prohibited.',
        ],
      },
      {
        title: '5. Rights of the Administration',
        paragraphs: [
          'The Administration reserves the right at any time, unilaterally, without prior notice and without explaining reasons to:',
        ],
        list: [
          'Block, restrict access to, or permanently delete accounts of any Users;',
          'Moderate, hide, or delete any publications and photos;',
          'Modify Service functionality, perform maintenance, purge databases, or completely discontinue the Service at any time without compensation.',
        ],
      },
      {
        title: '6. Applicable Law and Dispute Resolution',
        paragraphs: [
          'All relations arising from this Agreement are governed by the applicable legislation of the Republic of Uzbekistan.',
          'The pre-trial claim procedure for resolving disputes is mandatory. The response time to a written claim is 30 calendar days. All unresolved disputes shall be settled in court at the location of the Administration.',
        ],
      },
      {
        title: '7. Age Restrictions (18+) and Acceptance of Agreement',
        paragraphs: [
          'By accepting this Agreement and registering in the Service, the User explicitly declares and confirms that they are at least 18 years of age (they have attained the age of majority and are fully legally capable under applicable law). Registration and use of the Service by persons under 18 years of age are strictly prohibited.',
          'Checking the box "Before registering, you must accept the user agreement" on the registration page constitutes unconditional confirmation that the User is at least 18 years of age and represents full acceptance of this Agreement in accordance with Article 370 of the Civil Code of the Republic of Uzbekistan.',
        ],
      },
    ],
  },
};
