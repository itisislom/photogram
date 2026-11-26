import { layout, esc, safeJsonForScript, renderVerifiedBadge } from './layout';
import { renderBottomNav } from './nav';
import { Translations } from '../languages/types';
import { ru } from '../languages/ru';
import { ProfileData } from '../types';

const BACK_ARROW_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`;

export function editProfilePage(
  data: ProfileData,
  t: Translations = ru,
  theme?: string
): string {
  const user = data.user;
  const usernameSafe = esc(user.username);
  const displayNameSafe = esc(user.display_name || user.username);
  const bioSafe = esc(user.bio || '');
  const initial = (user.display_name || user.username).charAt(0).toUpperCase();

  const avatarHtml = user.avatar_key
    ? `<img id="editAvatarImg" src="/media/${encodeURIComponent(user.avatar_key)}" alt="${usernameSafe}">`
    : `<span id="editAvatarInitial">${esc(initial)}</span>`;

  const left = typeof data.username_changes_left === 'number' ? data.username_changes_left : 3;
  const unlockDays = data.username_unlock_days || 0;
  let hintText = '';
  let hintIsWarning = false;
  if (left <= 0) {
    hintText = t.profile.usernameLimitWarning(3, unlockDays);
    hintIsWarning = true;
  } else if (left < 3) {
    hintText = t.profile.usernameLimitLeft(left);
  } else {
    hintText = t.profile.usernameLimitNormal;
  }

  const clientI18n = safeJsonForScript({
    networkError: t.common.networkError,
    limitWarningTpl: t.profile.usernameLimitWarning(3, 14),
    limitNormal: t.profile.usernameLimitNormal
  });

  const body = `
<div class="editprofile-top-bar">
  <a href="/u/${encodeURIComponent(user.username)}" class="editprofile-back-btn" id="editBackBtn" aria-label="${esc(t.common.close)}">
    ${BACK_ARROW_ICON}
  </a>
  <h1 class="editprofile-title">${esc(t.profile.editProfile)}</h1>
  <button type="submit" form="editProfileForm" class="editprofile-save-link" id="topSaveBtn" disabled>
    ${esc(t.common.save)}
  </button>
</div>

<main class="editprofile-container">
  <div class="editprofile-avatar-section">
    <div class="editprofile-avatar-wrap">
      <div class="profile-avatar" id="editAvatarBox">
        ${avatarHtml}
      </div>
    </div>
    <label for="avatarFileInput" class="editprofile-change-photo-btn">
      ${esc(t.profile.changePhoto)}
    </label>
    <input type="file" id="avatarFileInput" style="display: none;">
  </div>

  <div class="auth-error" id="editProfileError"></div>

  <form class="editprofile-form" id="editProfileForm" autocomplete="off">
    <div class="input-field">
      <input type="text" id="editUsername" name="username" maxlength="24" value="${usernameSafe}" required autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder=" " data-lpignore="true" data-1p-ignore="true" data-form-type="other">
      <label for="editUsername">${esc(t.auth.username)}</label>
    </div>
    <div class="field-hint ${hintIsWarning ? 'warning' : ''}" id="usernameHint">${esc(hintText)}</div>

    <div class="input-field">
      <input type="text" id="editDisplayName" name="display_name" maxlength="50" value="${displayNameSafe}" autocomplete="off" placeholder=" " data-lpignore="true" data-1p-ignore="true" data-form-type="other">
      <label for="editDisplayName">${esc(t.auth.displayName)}</label>
    </div>

    <div class="input-field">
      <textarea id="editBio" name="bio" maxlength="150" rows="3" autocomplete="off" placeholder=" " data-lpignore="true" data-1p-ignore="true" data-form-type="other">${bioSafe}</textarea>
      <label for="editBio">${esc(t.profile.bio)}</label>
    </div>
    <div class="editprofile-bio-hint">
      <span id="bioCharCounter">${(user.bio || '').length}/150</span>
    </div>

    <button type="submit" class="btn btn-primary editprofile-submit-btn" id="saveProfileBtn" disabled>
      ${esc(t.common.save)}
    </button>
  </form>

  ${renderBottomNav('profile', t)}
</main>`;

  const script = `
(function() {
  var i18n = ${clientI18n};
  var form = document.getElementById('editProfileForm');
  var errorEl = document.getElementById('editProfileError');
  var saveBtn = document.getElementById('saveProfileBtn');
  var topSaveBtn = document.getElementById('topSaveBtn');
  var backBtn = document.getElementById('editBackBtn');
  var usernameInput = document.getElementById('editUsername');
  var displayNameInput = document.getElementById('editDisplayName');
  var bioInput = document.getElementById('editBio');
  var bioCounter = document.getElementById('bioCharCounter');
  var avatarInput = document.getElementById('avatarFileInput');
  var avatarBox = document.getElementById('editAvatarBox');

  var initialUsername = usernameInput ? usernameInput.value.trim().toLowerCase() : '';
  var initialDisplayName = displayNameInput ? displayNameInput.value.trim() : '';
  var initialBio = bioInput ? bioInput.value.trim() : '';

  function checkChanges() {
    if (!usernameInput || !displayNameInput || !bioInput) return;
    var u = usernameInput.value.trim().toLowerCase();
    var d = displayNameInput.value.trim();
    var b = bioInput.value.trim();
    var isChanged = (u !== initialUsername) || (d !== initialDisplayName) || (b !== initialBio);
    var isValid = u.length >= 3;
    var canSave = isChanged && isValid;
    if (saveBtn) saveBtn.disabled = !canSave;
    if (topSaveBtn) topSaveBtn.disabled = !canSave;
  }

  if (usernameInput) usernameInput.addEventListener('input', checkChanges);
  if (displayNameInput) displayNameInput.addEventListener('input', checkChanges);
  if (bioInput) {
    bioInput.addEventListener('input', function() {
      if (bioCounter) bioCounter.textContent = this.value.length + '/150';
      checkChanges();
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', function(e) {
      e.preventDefault();
      var href = this.getAttribute('href') || ('/u/' + encodeURIComponent(${safeJsonForScript(user.username)}));
      if (window.spaNavigate) {
        window.spaNavigate(href);
      } else {
        window.location.href = href;
      }
    });
  }

  if (avatarInput) {
    avatarInput.addEventListener('change', function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;

      var img = new Image();
      var reader = new FileReader();

      reader.onload = function(evt) {
        img.src = evt.target.result;
      };

      img.onload = function() {
        var canvas = document.createElement('canvas');
        var size = 400;
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');

        var srcWidth = img.naturalWidth;
        var srcHeight = img.naturalHeight;
        var cropSize = Math.min(srcWidth, srcHeight);
        var sx = (srcWidth - cropSize) / 2;
        var sy = (srcHeight - cropSize) / 2;

        ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);

        canvas.toBlob(async function(blob) {
          if (!blob) return;
          var fd = new FormData();
          fd.append('avatar', blob, 'avatar.webp');

          try {
            var res = await fetch('/api/profile/avatar', {
              method: 'POST',
              body: fd
            });
            var data = {};
            try {
              data = await res.json();
            } catch(e) {}
            if (res.ok && data.avatar_url) {
              if (avatarBox) {
                avatarBox.innerHTML = '<img id="editAvatarImg" src="' + data.avatar_url + '" alt="Avatar">';
              }
            } else {
              if (window.showAppAlert) {
                window.showAppAlert({ message: (data && data.error) ? data.error : i18n.networkError });
              }
            }
          } catch(err) {
            if (window.showAppAlert) window.showAppAlert({ message: i18n.networkError });
          }
        }, 'image/webp', 0.85);
      };

      reader.readAsDataURL(file);
    });
  }

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (saveBtn) saveBtn.disabled = true;
      if (topSaveBtn) topSaveBtn.disabled = true;
      if (errorEl) errorEl.classList.remove('visible');

      try {
        var res = await fetch('/api/profile/update', {
          method: 'POST',
          body: new FormData(form)
        });
        var data = await res.json();
        if (res.ok) {
          var targetUsername = data.username || (usernameInput ? usernameInput.value.trim().toLowerCase() : ${safeJsonForScript(user.username)});
          var targetUrl = '/u/' + encodeURIComponent(targetUsername);
          if (window.spaNavigate) {
            window.spaNavigate(targetUrl);
          } else {
            window.location.href = targetUrl;
          }
        } else {
          if (errorEl) {
            errorEl.textContent = data.error || i18n.networkError;
            errorEl.classList.add('visible');
          }
          if (saveBtn) saveBtn.disabled = false;
          if (topSaveBtn) topSaveBtn.disabled = false;
        }
      } catch(err) {
        if (errorEl) {
          errorEl.textContent = i18n.networkError;
          errorEl.classList.add('visible');
        }
        if (saveBtn) saveBtn.disabled = false;
        if (topSaveBtn) topSaveBtn.disabled = false;
      }
    });
  }
})();
`;

  return layout(`${t.common.appName} — ${t.profile.editProfile}`, body, script, t, theme);
}
