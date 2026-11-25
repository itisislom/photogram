export type LangCode = 'ru' | 'en' | 'uz' | 'kz';

export interface LegalCard {
  title: string;
  paragraphs: string[];
  list?: string[];
}

export interface Translations {
  code: LangCode;
  name: string;

  common: {
    appName: string;
    loading: string;
    saving: string;
    creating: string;
    save: string;
    cancel: string;
    delete: string;
    close: string;
    attention: string;
    authRequired: string;
    authRequiredMsg: string;
    networkError: string;
    understood: string;
    yes: string;
    no: string;
    justNow: string;
    minutesShort: string;
    hoursShort: string;
    daysShort: string;
    likesCount: (n: number) => string;
    commentsCount: (n: number) => string;
    postsCount: (n: number) => string;
    followersCount: (n: number) => string;
    followingCount: (n: number) => string;
    selectLanguage: string;
    theme: string;
    themeLight: string;
    themeDark: string;
  };

  nav: {
    feed: string;
    explore: string;
    create: string;
    profile: string;
    menu: string;
    settings: string;
    logout: string;
  };

  auth: {
    loginTitle: string;
    registerTitle: string;
    username: string;
    displayName: string;
    password: string;
    showPassword: string;
    hidePassword: string;
    loginBtn: string;
    registerBtn: string;
    noAccount: string;
    haveAccount: string;
    termsNotice: string;
    termsLinkText: string;
    termsModalTitle: string;
    accept18Plus: string;
    errUsernameFormat: string;
    errUsernameForbidden: string;
    errDisplayNameRequired: string;
    errPasswordMin: string;
    errTermsRequired: string;
    errTooManyRegAttempts: (mins: number) => string;
    errUsernameTaken: string;
    errAccountCreate: string;
    errTooManyIpAttempts: (mins: number) => string;
    errLoginRequired: string;
    errAccountLocked: (mins: number) => string;
    errLoginLocked15m: string;
    errInvalidCredentials: string;
    changePasswordTitle: string;
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
    changePasswordSuccess: string;
    errCurrentPasswordRequired: string;
    errCurrentPasswordWrong: string;
    errPasswordsMismatch: string;
    errPasswordSame: string;
    errTooManyPwChangeAttempts: (mins: number) => string;
    accountsTitle: string;
    activeAccount: string;
    addAccount: string;
    accountsLimitHint: (count: number, max: number) => string;
    errAccountsLimitReached: string;
    removeAccountTitle: string;
    removeAccountConfirm: (username: string) => string;
    removeAccountBtn: string;
    backToAccounts: string;
  };

  feed: {
    noPosts: string;
    noPostsDesc: string;
    addComment: string;
    viewAllComments: (n: number) => string;
  };

  explore: {
    title: string;
    searchPlaceholder: string;
    noResults: string;
    users: string;
    posts: string;
  };

  profile: {
    editProfile: string;
    follow: string;
    following: string;
    followBack: string;
    followsYou: string;
    unfollowTitle: string;
    unfollowConfirm: (username: string) => string;
    unfollowBtn: string;
    bio: string;
    changePhoto: string;
    uploadPhoto: string;
    removePhoto: string;
    noPosts: string;
    postsTab: string;
    savedTab: string;
    menuTitle: string;
    logoutConfirmTitle: string;
    logoutConfirmDesc: string;
    deletePostConfirmTitle: string;
    deletePostConfirmDesc: string;
    usernameLimitWarning: (left: number, days: number) => string;
    usernameLimitLeft: (left: number) => string;
    usernameLimitNormal: string;
  };

  post: {
    newPostTitle: string;
    selectPhotoDropzone: string;
    selectPhotoBtn: string;
    changePhoto: string;
    replacePhoto: string;
    back: string;
    captionLabel: string;
    captionPlaceholder: string;
    publishBtn: string;
    publishing: string;
    nsfwBlocked: string;
    deletePost: string;
    moreOptions: string;
    downloadPhoto: string;
    downloadSuccess: string;
    downloadError: string;
  };

  error: {
    offlineTitle: string;
    offlineDesc: string;
    reloadBtn: string;
  };

  comments: {
    title: string;
    commentsHeader: (n: number) => string;
    firstCommentPrompt: string;
    loading: string;
    inputPlaceholder: string;
    send: string;
    deleteTitle: string;
    deleteConfirm: string;
  };

  sublist: {
    title: string;
    searchPlaceholder: string;
    noFollowers: string;
    noResults: string;
    followingTitle: string;
    noFollowing: string;
  };

  recommendations: {
    allCaughtUp: string;
    allCaughtUpDesc: string;
    suggestedForYou: string;
    whoToFollow: string;
    follow: string;
    following: string;
    notInterested: string;
    postHidden: string;
    relatedPosts: string;
    similarAccounts: string;
    tagForYou: string;
    tagPopular: string;
    tagRecent: string;
  };

  legal: {
    backToRegister: string;
    title: string;
    date: string;
    cards: LegalCard[];
  };
}
