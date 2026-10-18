export function getStyles(): string {
  return `
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #FFFFFF;
  color: #1A1A1A;
  line-height: 1.5;
  min-height: 100dvh;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  overscroll-behavior: none;
}

::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

img,
.feed-card-photo,
.feed-card-img,
.explore-item,
.pics-image,
.pics-slide,
.post-view-image,
.avatar-box,
.avatar-circle {
  -webkit-touch-callout: none !important;
  -webkit-user-drag: none !important;
  user-drag: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

.terms-modal-body {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  line-height: 1.6;
}

.terms-modal-body .legal-card {
  box-shadow: none;
  margin-bottom: 12px;
  padding: 14px 16px;
}

input,
textarea {
  -webkit-user-select: text;
  user-select: text;
}


a {
  text-decoration: none;
  color: inherit;
}

.auth-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 24px 16px;
  padding-top: max(24px, env(safe-area-inset-top));
  padding-bottom: max(24px, env(safe-area-inset-bottom));
}

.auth-card {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.auth-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.auth-logo-icon {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: linear-gradient(135deg, #2196F3, #F48FB1, #FFD54F);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-logo-icon svg {
  width: 36px;
  height: 36px;
}

.auth-logo h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1A1A1A;
  letter-spacing: -0.5px;
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-field {
  position: relative;
  width: 100%;
}

.input-field input {
  width: 100%;
  height: 56px;
  padding: 24px 16px 8px;
  border: 1.5px solid #E0E0E0;
  border-radius: 12px;
  font-size: 16px;
  font-family: inherit;
  color: #1A1A1A;
  background: #FAFAFA;
  outline: none;
  transition: border-color 0.2s, background-color 0.2s;
}

.input-field input:focus {
  border-color: #2196F3;
  background: #FFFFFF;
}

.input-field label {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: #757575;
  pointer-events: none;
  transition: top 0.2s, transform 0.2s, font-size 0.2s, color 0.2s;
}

.input-field input:focus + label,
.input-field input:not(:placeholder-shown) + label,
.input-field input:-webkit-autofill + label,
.input-field input:autofill + label,
.input-field.has-value label {
  top: 8px;
  transform: translateY(0);
  font-size: 12px;
  color: #757575;
}

.input-field input:focus + label {
  color: #2196F3;
}

.input-field input:-webkit-autofill,
.input-field input:-webkit-autofill:hover,
.input-field input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #FAFAFA inset;
  -webkit-text-fill-color: #1A1A1A;
}

.input-field input:focus:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px #FFFFFF inset;
  border-color: #2196F3;
}

.field-hint {
  font-size: 12px;
  color: #757575;
  margin-top: -8px;
  margin-bottom: 2px;
  padding: 0 4px;
  line-height: 1.4;
}

.field-hint.warning {
  color: #E65100;
  font-weight: 500;
}

.btn {

  width: 100%;
  height: 52px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  margin-top: 4px;
}

.btn:active {
  transform: scale(0.98);
}

.btn:disabled {
  cursor: not-allowed;
  transform: none;
}

.btn-primary {
  background: #2196F3;
  color: #FFFFFF;
}

.btn-primary:disabled {
  background: #E0E0E0;
  color: #9E9E9E;
  cursor: not-allowed;
  transform: none;
  opacity: 1;
}

.auth-error {
  width: 100%;
  padding: 12px 16px;
  background: #FFEBEE;
  border-radius: 12px;
  color: #EF5350;
  font-size: 14px;
  text-align: center;
  display: none;
}

.auth-error.visible {
  display: block;
}

.auth-footer {
  font-size: 14px;
  color: #757575;
}

.auth-footer a {
  color: #2196F3;
  font-weight: 600;
}

.terms-checkbox-wrap {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  line-height: 1.45;
  color: #555555;
  margin: 4px 0 8px;
  text-align: left;
}

.terms-checkbox-wrap input[type="checkbox"] {
  width: 20px;
  height: 20px;
  min-width: 20px;
  margin-top: 1px;
  cursor: pointer;
  accent-color: #2196F3;
}

.terms-checkbox-text a {
  color: #2196F3;
  text-decoration: underline;
  font-weight: 500;
}

.legal-container {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 16px 60px;
  line-height: 1.6;
  color: #262626;
}

.legal-header {
  margin-bottom: 24px;
}

.legal-title {
  font-size: 22px;
  font-weight: 700;
  color: #1A1A1A;
  margin-bottom: 6px;
}

.legal-date {
  font-size: 13px;
  color: #8E8E8E;
}

.legal-card {
  background: #FFFFFF;
  border: 1px solid #EBEBEB;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 16px;
}

.legal-card h2 {
  font-size: 16px;
  font-weight: 700;
  color: #111111;
  margin-bottom: 10px;
}

.legal-card p {
  font-size: 14px;
  color: #333333;
  margin-bottom: 10px;
}

.legal-card p:last-child {
  margin-bottom: 0;
}

.legal-card ul {
  padding-left: 20px;
  margin: 8px 0;
  font-size: 14px;
  color: #333333;
}

.legal-card li {
  margin-bottom: 6px;
}

.legal-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #2196F3;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.legal-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.legal-translate-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #F8F9FA;
  border: 1px solid #EBEBEB;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 16px;
}

.legal-translate-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #424242;
}


.legal-translate-widget {
  min-height: 32px;
  display: flex;
  align-items: center;
}

.lang-switcher-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #F0F2F5;
  padding: 3px;
  border-radius: 9px;
}

.lang-switch-btn {
  background: transparent;
  border: none;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #737373;
  padding: 4px 8px;
  border-radius: 7px;
  cursor: pointer;
  min-height: 28px;
  min-width: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.lang-switch-btn:hover {
  color: #1A1A1A;
}

.lang-switch-btn.active {
  background: #FFFFFF;
  color: #0095F6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.goog-te-gadget {
  font-family: inherit !important;
  font-size: 13px !important;
  color: #757575 !important;
}

.goog-te-gadget .goog-te-combo {
  padding: 5px 8px;
  border: 1.5px solid #E0E0E0;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  color: #1A1A1A;
  background: #FFFFFF;
  outline: none;
  cursor: pointer;
}

.goog-te-banner-frame,
.goog-te-banner-frame.skiptranslate {
  display: none !important;
}

body {
  top: 0px !important;
}

.temp-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 24px 16px;
  gap: 16px;
  text-align: center;
}

.temp-page h2 {
  font-size: 24px;
  font-weight: 700;
}

.temp-page p {
  font-size: 16px;
  color: #757575;
}

.temp-page .btn {
  max-width: 200px;
}

.app-layout {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(56px + env(safe-area-inset-bottom));
}

.top-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top);
  background: #FFFFFF;
  border-bottom: 1px solid #EEEEEE;
}

.top-bar-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.top-bar-action {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: #1A1A1A;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 24px;
}

.profile-avatar-wrap {
  position: relative;
  width: 86px;
  height: 86px;
  flex-shrink: 0;
}

.profile-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: #FAFAFA;
  border: 2px solid #2196F3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: #2196F3;
  overflow: hidden;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-avatar-edit-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #2196F3;
  color: #FFFFFF;
  border: 2px solid #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.profile-avatar-edit-badge svg {
  width: 14px;
  height: 14px;
}

.profile-header-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-header-username {
  font-size: 16px;
  font-weight: 700;
  color: #1A1A1A;
  text-align: left;
  letter-spacing: -0.2px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.follows-you-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  color: #8E8E8E;
  background: #EFEFEF;
  padding: 2px 8px;
  border-radius: 10px;
  line-height: 1.4;
}


.profile-stats {
  width: 100%;
  display: flex;
  justify-content: space-around;
  text-align: center;
}


.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-number {
  font-size: 17px;
  font-weight: 700;
  color: #1A1A1A;
}

.stat-label {
  font-size: 13px;
  color: #757575;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-display-name {
  font-size: 15px;
  font-weight: 700;
  color: #1A1A1A;
}

.profile-bio {
  font-size: 14px;
  color: #1A1A1A;
  white-space: pre-wrap;
  word-break: break-word;
}

.profile-actions {
  display: flex;
  gap: 8px;
}

.profile-actions .btn {
  flex: 1;
}

.btn-secondary {
  background: #FAFAFA;
  color: #1A1A1A;
  border: 1px solid #E0E0E0;
}

.btn-secondary:active {
  background: #EEEEEE;
}

.btn-danger {
  background: #EF5350;
  color: #FFFFFF;
}

.btn-danger:active {
  background: #E53935;
}


.btn-sm {
  height: 38px;
  font-size: 14px;
  border-radius: 10px;
  margin-top: 0;
}

.menu-action-btn {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 16px;
  background: #FAFAFA;
  border: 1px solid #EEEEEE;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}

.menu-action-btn:active {
  background: #F0F0F0;
}

.menu-action-danger {
  color: #EF5350;
}

.menu-action-danger:active {
  background: #FFEBEE;
}


.profile-empty {
  padding: 48px 16px;
  text-align: center;
  color: #757575;
  font-size: 14px;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(54px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: #FFFFFF;
  border-top: 1px solid #EEEEEE;
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 20;
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  color: #757575;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.bottom-nav-item.active {
  color: #2196F3;
}

.bottom-nav-item svg {
  width: 24px;
  height: 24px;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  margin-top: 16px;
  width: 100%;
}

.profile-grid-item {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #EEEEEE;
  overflow: hidden;
  cursor: pointer;
  display: block;
  border: none;
  padding: 0;
}

.profile-grid-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.2s;
}

.profile-grid-item:active img {
  opacity: 0.85;
}

.explore-mosaic-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  grid-auto-flow: dense;
  width: 100%;
}

.explore-grid-item {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #EEEEEE;
  overflow: hidden;
  cursor: pointer;
  display: block;
  border: none;
  padding: 0;
}

.explore-mosaic-grid .explore-grid-item:nth-child(10n + 2) {
  grid-column: span 2;
  grid-row: span 2;
}

.explore-grid-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.explore-grid-item:hover img {
  transform: scale(1.02);
}

.explore-grid-item:active img {
  opacity: 0.85;
}

.explore-item-likes-badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  pointer-events: none;
  opacity: 0.9;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.explore-grid-item:hover .explore-item-likes-badge {
  opacity: 1;
  background: rgba(0, 0, 0, 0.75);
}

.explore-badge-part {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.post-upload-dropzone {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 2px dashed #E0E0E0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #FAFAFA;
  cursor: pointer;
  color: #757575;
  font-size: 14px;
  font-weight: 500;
  padding: 16px;
  text-align: center;
}

.post-upload-dropzone:active {
  background: #EEEEEE;
}

.post-caption-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.post-caption-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.post-caption-label {
  font-size: 13px;
  font-weight: 600;
  color: #111111;
}

.post-caption-counter {
  font-size: 12px;
  color: #666666;
}

.post-caption-textarea {
  width: 100%;
  height: 80px;
  padding: 10px 12px;
  border: 1px solid #DBDBDB;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  color: #111111;
  background: #FFFFFF;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.post-caption-textarea::placeholder {
  color: #666666;
}

.post-caption-textarea:focus {
  border-color: #2196F3;
}

.post-crop-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.crop-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #000000;
  border-radius: 14px;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}

.crop-viewport:active {
  cursor: grabbing;
}

.crop-viewport img {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  display: block;
  max-width: none;
  max-height: none;
  will-change: transform;
}

.crop-grid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
  transition: opacity 0.18s ease;
  opacity: 0.45;
}

.crop-grid line {
  stroke: rgba(33, 150, 243, 0.45);
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
  transition: stroke 0.18s ease, stroke-width 0.18s ease;
}

.crop-grid rect {
  fill: none;
  stroke: rgba(33, 150, 243, 0.65);
  stroke-width: 1.5px;
  vector-effect: non-scaling-stroke;
  transition: stroke 0.18s ease, stroke-width 0.18s ease;
}

.crop-grid.active {
  opacity: 1;
}

.crop-grid.active line {
  stroke: rgba(33, 150, 243, 0.95);
  stroke-width: 1.5px;
}

.crop-grid.active rect {
  stroke: #2196F3;
  stroke-width: 2px;
}

.crop-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
}

.crop-zoom-icon {
  display: flex;
  align-items: center;
  color: #757575;
  flex-shrink: 0;
}

.crop-zoom-slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  accent-color: #2196F3;
  cursor: pointer;
}

.post-view-modal-content {
  width: 100%;
  max-width: 560px;
  background: #FFFFFF;
  border-radius: 20px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(90dvh, 760px);
  overflow: hidden;
}

.post-view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.post-view-back-btn {
  background: #F5F5F5;
  border: 1px solid #E0E0E0;
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #1A1A1A;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.post-view-back-btn:hover,
.post-view-back-btn:active {
  background: #E0E0E0;
  color: #000000;
}

.post-view-header-author {
  font-weight: 700;
  font-size: 15px;
  color: #262626;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-view-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.post-view-scroll-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 2px;
}


.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 10050;
}

.modal-backdrop.visible {
  display: flex;
}

.modal-content {
  width: 100%;
  max-width: 500px;
  background: #FFFFFF;
  border-radius: 20px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: min(90dvh, 760px);
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
}

.modal-close,
.modal-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #757575;
  padding: 0;
}

.modal-close svg,
.modal-icon-btn svg {
  display: block;
  flex-shrink: 0;
}

.modal-close:active,
.modal-icon-btn:active {
  background: #F0F0F0;
}

.modal-icon-danger {
  color: #EF5350;
}


.post-view-image-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #000000;
  border-radius: 12px;
  overflow: hidden;
  user-select: none;
  cursor: pointer;
}

.post-view-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.post-like-burst {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.22s ease;
  z-index: 10;
}

.post-like-burst.active {
  transform: translate(-50%, -50%) scale(1.15);
  opacity: 1;
}

.post-view-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 2px;
}

.post-like-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #262626;
  border-radius: 50%;
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.post-like-btn:hover {
  opacity: 0.85;
}

.post-like-btn.animating {
  transform: scale(1.25);
}

.post-like-btn svg {
  transition: fill 0.15s ease, stroke 0.15s ease;
}

.post-like-btn.liked svg {
  fill: #ED4956;
  stroke: #ED4956;
}

.post-likes-count {
  font-size: 14px;
  font-weight: 600;
  color: #262626;
}

.post-view-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 2px;
}

.post-view-caption {
  font-size: 14px;
  line-height: 1.45;
  color: #262626;
  word-break: break-word;
}

.post-view-date {
  font-size: 12px;
  color: #8E8E8E;
}

/* Explore & Search */
.explore-search-wrap {
  position: sticky;
  top: 0;
  z-index: 50;
  background: #FFFFFF;
  padding: 12px 16px;
  border-bottom: 1px solid #EFEFEF;
}

.search-input-box {
  display: flex;
  align-items: center;
  background: #EFEFEF;
  border-radius: 10px;
  padding: 8px 12px;
  gap: 8px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.search-icon {
  display: flex;
  align-items: center;
  color: #8E8E8E;
  flex-shrink: 0;
}

.search-input {
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
  flex: 1;
  color: #262626;
  font-family: inherit;
  padding: 0;
}

.search-input::placeholder {
  color: #8E8E8E;
}

.search-clear-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: #C7C7C7;
  border-radius: 50%;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.search-clear-btn svg {
  width: 12px;
  height: 12px;
}

.search-results {
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
  gap: 4px;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.search-user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 10px;
  text-decoration: none;
  transition: background 0.15s;
}

.search-user-item:hover,
.search-user-item:active {
  background: #F8F9FA;
}

.search-user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: #EEEEEE;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: #2196F3;
  flex-shrink: 0;
}

.search-user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.search-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.search-user-name {
  font-size: 14px;
  font-weight: 600;
  color: #262626;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-user-username {
  font-size: 13px;
  color: #8E8E8E;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-empty {
  padding: 32px 16px;
  text-align: center;
  color: #8E8E8E;
  font-size: 14px;
}

.explore-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.explore-section {
  display: flex;
  flex-direction: column;
}

.explore-section-header {
  padding: 12px 16px 8px;
}

.explore-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #8E8E8E;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.explore-users-list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 16px 12px;
  scrollbar-width: none;
}

.explore-users-list::-webkit-scrollbar {
  display: none;
}

.explore-user-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 12px 14px;
  background: #FFFFFF;
  border: 1px solid #EBEBEB;
  border-radius: 12px;
  text-decoration: none;
  min-width: 110px;
  max-width: 130px;
  flex-shrink: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.explore-user-card:active {
  transform: scale(0.98);
}

.explore-user-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  overflow: hidden;
  background: #E3F2FD;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  font-size: 20px;
  font-weight: 700;
  color: #2196F3;
}

.explore-user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.explore-user-name {
  font-size: 13px;
  font-weight: 600;
  color: #262626;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.explore-user-username {
  font-size: 12px;
  color: #8E8E8E;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.post-view-author {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}

.post-view-author-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: #E3F2FD;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #2196F3;
  flex-shrink: 0;
}

.post-view-author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-view-author-meta {
  display: flex;
  flex-direction: column;
}

/* Fullscreen Pics Swipe Viewer */
.pics-modal {
  position: fixed;
  inset: 0;
  background: #000000;
  z-index: 9999;
  display: none;
  flex-direction: column;
  overflow: hidden;
  height: 100dvh;
}

.pics-modal.visible {
  display: flex;
}

.pics-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  padding-top: max(14px, env(safe-area-inset-top, 14px));
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 100%);
  z-index: 100;
  pointer-events: none;
}

.pics-title {
  color: #FFFFFF;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  user-select: none;
}

.pics-close-btn {
  background: rgba(0, 0, 0, 0.45);
  border: none;
  color: #FFFFFF;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: transform 0.15s ease, background 0.15s ease;
  padding: 0;
  flex-shrink: 0;
}

.pics-close-btn:active {
  transform: scale(0.92);
  background: rgba(255, 255, 255, 0.3);
}

.pics-feed {
  width: 100%;
  height: 100dvh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.pics-feed::-webkit-scrollbar {
  display: none;
}

.pics-slide {
  position: relative;
  width: 100%;
  height: 100dvh;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000000;
  overflow: hidden;
}

.pics-image-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.pics-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-select: none;
}

.pics-gradient-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0.35) 0%,
    transparent 18%,
    transparent 60%,
    rgba(0,0,0,0.85) 100%
  );
  pointer-events: none;
}

.pics-bottom-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 76px;
  padding: 16px;
  padding-bottom: max(20px, env(safe-area-inset-bottom, 20px));
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #FFFFFF;
  pointer-events: none;
}

.pics-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #FFFFFF;
  width: fit-content;
  pointer-events: auto;
}

.pics-author-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid #FFFFFF;
  background: #2196F3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: #FFFFFF;
  flex-shrink: 0;
}

.pics-author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pics-author-name {
  font-size: 15px;
  font-weight: 700;
  color: #FFFFFF;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}

.pics-caption {
  font-size: 14px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
}

.pics-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}

.pics-side-bar {
  position: absolute;
  right: 12px;
  bottom: max(24px, env(safe-area-inset-bottom, 24px));
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.pics-action-btn {
  background: transparent;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 6px;
  color: #FFFFFF;
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.pics-action-btn:active {
  transform: scale(0.85);
}

.pics-action-btn.animating {
  transform: scale(1.3);
}

.pics-action-btn svg {
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));
  transition: fill 0.15s ease, stroke 0.15s ease;
}

.pics-action-btn.liked svg {
  fill: #ED4956;
  stroke: #ED4956;
}

.pics-action-count {
  font-size: 12px;
  font-weight: 700;
  color: #FFFFFF;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}



.pics-action-label {
  font-size: 11px;
  font-weight: 600;
  color: #FFFFFF;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

/* Feed Layout & Cards */
.feed-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 470px;
  margin: 0 auto;
  width: 100%;
  padding: 12px 0 40px;
}

.feed-card {
  background: #FFFFFF;
  border: 1px solid #EFEFEF;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.feed-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
}

.feed-card-author {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}

.feed-card-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: #E3F2FD;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: #2196F3;
  flex-shrink: 0;
}

.feed-card-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-card-author-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.feed-card-username {
  font-size: 14px;
  font-weight: 700;
  color: #262626;
  text-decoration: none;
}

.feed-card-username:hover {
  text-decoration: underline;
}

.feed-card-dot {
  font-size: 12px;
  color: #8E8E8E;
}

.feed-card-time {
  font-size: 12px;
  color: #8E8E8E;
}

.feed-card-image-wrap {
  width: 100%;
  position: relative;
  background: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  aspect-ratio: 1 / 1;
  max-height: 580px;
  overflow: hidden;
}

.feed-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.feed-card-actions {
  display: flex;
  align-items: center;
  padding: 10px 14px 6px;
  gap: 12px;
}

.feed-like-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: #262626;
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.feed-like-btn:active {
  transform: scale(0.85);
}

.feed-like-btn.animating {
  transform: scale(1.3);
}

.feed-like-btn svg {
  transition: fill 0.15s ease, stroke 0.15s ease;
}

.feed-like-btn.liked svg {
  fill: #ED4956;
  stroke: #ED4956;
}

.feed-card-likes-count {
  font-size: 14px;
  font-weight: 700;
  color: #262626;
  padding: 0 14px 6px;
}

.feed-card-caption {
  font-size: 14px;
  line-height: 1.45;
  color: #262626;
  padding: 0 14px 6px;
  word-break: break-word;
}

.feed-caption-user {
  font-weight: 700;
  color: #262626;
  text-decoration: none;
  margin-right: 4px;
}

.feed-caption-user:hover {
  text-decoration: underline;
}

.feed-card-date {
  font-size: 11px;
  text-transform: uppercase;
  color: #8E8E8E;
  letter-spacing: 0.2px;
  padding: 0 14px 12px;
}

.feed-empty-card {
  padding: 48px 24px;
  text-align: center;
  background: #FFFFFF;
  border: 1px solid #EFEFEF;
  border-radius: 16px;
  margin: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.feed-empty-card h3 {
  font-size: 18px;
  font-weight: 700;
  color: #262626;
  margin: 0;
}

.feed-empty-card p {
  font-size: 14px;
  color: #8E8E8E;
  margin: 0;
  max-width: 280px;
}

@media (max-width: 480px) {
  .feed-card {
    border-left: none;
    border-right: none;
    border-radius: 0;
  }
}


/* Grid Hover & Overlay */
.profile-grid-item {
  position: relative;
}

.profile-grid-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  opacity: 0;
  transition: opacity 0.15s ease;
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 700;
  pointer-events: none;
}

.profile-grid-item:hover .profile-grid-overlay {
  opacity: 1;
}

.profile-grid-stat {
  display: flex;
  align-items: center;
  gap: 5px;
}

.profile-grid-stat svg {
  width: 18px;
  height: 18px;
  fill: #FFFFFF;
  stroke: #FFFFFF;
}

/* Comments section inside View Post Modal */
.post-view-comments-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid #EFEFEF;
  padding-top: 12px;
  margin-top: 6px;
}

.post-comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: #262626;
}

.post-comments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 220px;
  overflow-y: auto;
  padding-right: 4px;
  overscroll-behavior: contain;
}

.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}

.comment-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #E3F2FD;
  color: #2196F3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
  overflow: hidden;
  text-decoration: none;
}

.comment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.comment-content-wrap {
  flex: 1;
  min-width: 0;
}

.comment-author-name {
  font-weight: 700;
  color: #262626;
  text-decoration: none;
  margin-right: 6px;
}

.comment-author-name:hover {
  text-decoration: underline;
}

.comment-text {
  color: #262626;
}

.mention-link {
  color: #0095F6;
  font-weight: 600;
  text-decoration: none;
}

.mention-link:hover {
  text-decoration: underline;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 3px;
  font-size: 11px;
  color: #8E8E8E;
}

.comment-delete-btn {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 11px;
  color: #ED4956;
  cursor: pointer;
  opacity: 0.8;
}

.comment-delete-btn:hover {
  opacity: 1;
  text-decoration: underline;
}

.comment-empty-text {
  font-size: 13px;
  color: #8E8E8E;
  text-align: center;
  padding: 16px 0;
}

.comment-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 0;
  color: #8E8E8E;
  font-size: 13px;
}

.comment-input-form {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid #EFEFEF;
  padding-top: 10px;
  margin-top: 4px;
}

.comment-input {
  flex: 1;
  border: 1px solid #DBDBDB;
  border-radius: 20px;
  padding: 8px 14px;
  font-size: 13px;
  outline: none;
  background: #FAFAFA;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.comment-input:focus {
  border-color: #A8A8A8;
  background: #FFFFFF;
}

.comment-submit-btn {
  background: transparent;
  border: none;
  color: #0095F6;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 4px;
  opacity: 0.4;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.comment-submit-btn.active {
  opacity: 1;
  pointer-events: auto;
}

.post-comments-count-btn {
  background: transparent;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #262626;
  padding: 0;
  cursor: pointer;
}

/* App Alert & Confirm Modal */
.app-alert-backdrop {
  z-index: 20000;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.app-alert-content {
  max-width: 360px;
  text-align: center;
  align-items: center;
  gap: 16px;
  padding: 24px;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  animation: appAlertPop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes appAlertPop {
  0% { transform: scale(0.92); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.app-alert-icon-box {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.app-alert-icon-box.auth {
  background: #EBF5FF;
  color: #0095F6;
}

.app-alert-icon-box.error {
  background: #FEF2F2;
  color: #EF4444;
}

.app-alert-icon-box.info {
  background: #F3F4F6;
  color: #374151;
}

.app-alert-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.app-alert-text h3 {
  font-size: 17px;
  font-weight: 700;
  color: #262626;
  margin: 0;
}

.app-alert-text p {
  font-size: 14px;
  color: #737373;
  margin: 0;
  line-height: 1.45;
  word-break: break-word;
}

.app-alert-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 4px;
}

.app-alert-actions button {
  flex: 1;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Universal Comments Sheet / Drawer */
.comments-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 15000;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.comments-sheet-backdrop.visible {
  opacity: 1;
  pointer-events: auto;
}

.comments-sheet-panel {
  width: 100%;
  max-width: 500px;
  height: 70vh;
  max-height: 75vh;
  background: #FFFFFF;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.comments-sheet-backdrop.visible .comments-sheet-panel {
  transform: translateY(0);
}

.comments-sheet-header {
  position: relative;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #EFEFEF;
  flex-shrink: 0;
}

.comments-sheet-grabber {
  width: 36px;
  height: 4px;
  background: #DBDBDB;
  border-radius: 2px;
  position: absolute;
  top: 6px;
}

.comments-sheet-title {
  font-size: 15px;
  font-weight: 700;
  color: #262626;
}

.comments-sheet-close-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: #737373;
  border-radius: 50%;
  padding: 0;
}

.comments-sheet-close-btn:hover {
  background: #F5F5F5;
  color: #262626;
}

.comments-sheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  -webkit-overflow-scrolling: touch;
}

.comments-sheet-form {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid #EFEFEF;
  background: #FFFFFF;
  flex-shrink: 0;
  min-height: 56px;
}

@media (min-width: 601px) {
  .comments-sheet-backdrop {
    align-items: center;
  }

  .comments-sheet-panel {
    border-radius: 20px;
    height: 560px;
    max-height: 85vh;
    transform: scale(0.94);
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .comments-sheet-backdrop.visible .comments-sheet-panel {
    transform: scale(1);
  }

  .comments-sheet-grabber {
    display: none;
  }
}

/* Feed Comment Buttons */
.feed-comment-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: #262626;
  transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.feed-comment-btn:active {
  transform: scale(0.85);
}

.feed-card-comments-link {
  font-size: 14px;
  color: #737373;
  padding: 0 14px 6px;
  cursor: pointer;
  user-select: none;
}

.feed-card-comments-link:hover {
  color: #262626;
}

@media (max-width: 640px) {
  #viewPostModal {
    padding: 0 !important;
    background: #000000;
  }

  #viewPostModal .post-view-modal-content {
    width: 100% !important;
    max-width: 100% !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    border-radius: 0 !important;
    padding: 0 !important;
    gap: 0 !important;
    background: #FFFFFF;
  }

  #viewPostModal .post-view-header {
    height: 52px;
    padding: env(safe-area-inset-top, 0) 12px 0 12px;
    background: #FFFFFF;
    border-bottom: 1px solid #EFEFEF;
    box-sizing: content-box;
    z-index: 30;
  }

  #viewPostModal .post-view-scroll-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    gap: 0;
    padding-right: 0;
  }

  #viewPostModal .post-view-image-wrap {
    border-radius: 0 !important;
    aspect-ratio: 1 / 1;
    width: 100%;
    background: #000000;
  }

  #viewPostModal .post-view-actions {
    padding: 10px 14px 4px 14px;
  }

  #viewPostModal .post-view-meta {
    padding: 0 14px 10px 14px;
  }

  #viewPostModal .post-view-comments-section {
    padding: 12px 14px 0 14px;
    margin-top: 0;
    border-top: 1px solid #EFEFEF;
  }

  #viewPostModal .post-comments-list {
    max-height: none;
    overflow: visible;
  }

  #viewPostModal .comment-input-form {
    position: sticky;
    bottom: 0;
    background: #FFFFFF;
    border-top: 1px solid #EFEFEF;
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px)) 12px;
    margin-top: 0;
    z-index: 30;
  }
}

.feed-caught-up-banner {
  background: #FFFFFF;
  border: 1px solid #DBDBDB;
  border-radius: 8px;
  padding: 24px 16px;
  margin: 16px 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.feed-caught-up-icon {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feed-caught-up-title {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 4px;
}

.feed-caught-up-sub {
  font-size: 13px;
  color: #737373;
}

.feed-recommended-section {
  margin: 16px 0;
  padding: 12px 0;
  border-top: 1px solid #EFEFEF;
  border-bottom: 1px solid #EFEFEF;
}

.feed-section-header {
  font-size: 14px;
  font-weight: 600;
  color: #737373;
  margin-bottom: 12px;
  padding: 0 4px;
}

.feed-recommended-carousel, .profile-similar-carousel {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 4px 2px 10px 2px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.feed-recommended-carousel::-webkit-scrollbar, .profile-similar-carousel::-webkit-scrollbar {
  display: none;
}

.feed-rec-user-card {
  flex: 0 0 140px;
  min-width: 140px;
  background: #FFFFFF;
  border: 1px solid #DBDBDB;
  border-radius: 8px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  scroll-snap-align: start;
}

.feed-rec-avatar-link {
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.feed-rec-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  overflow: hidden;
  background: #EFEFEF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 20px;
  color: #262626;
  margin-bottom: 8px;
}

.feed-rec-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-rec-name {
  font-size: 13px;
  font-weight: 600;
  color: #262626;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-rec-username {
  font-size: 12px;
  color: #737373;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 10px;
}

.feed-follow-btn {
  width: 100%;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  border: none;
  background: #0095F6;
  color: #FFFFFF;
  cursor: pointer;
  transition: background 0.15s ease;
}

.feed-follow-btn:hover {
  background: #1877F2;
}

.feed-follow-btn.following {
  background: #EFEFEF;
  color: #262626;
}

.feed-card-follow-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: #0095F6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
}

.feed-card-follow-btn.following {
  color: #737373;
}

.caption-hashtag {
  color: #00376B;
  font-weight: 500;
  text-decoration: none;
}

.caption-hashtag:hover {
  text-decoration: underline;
}

.explore-tags-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 16px;
  background: #FFFFFF;
  border-bottom: 1px solid #EFEFEF;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.explore-tags-bar::-webkit-scrollbar {
  display: none;
}

.explore-tag-pill {
  flex: 0 0 auto;
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid #DBDBDB;
  background: #FAFAFA;
  color: #262626;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.explore-tag-pill:hover {
  background: #EAEAEA;
}

.explore-tag-pill.active {
  background: #262626;
  color: #FFFFFF;
  border-color: #262626;
}

.post-view-hide-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #737373;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
}

.post-view-hide-btn:hover {
  background: #F5F5F5;
  color: #ED4956;
}

.post-view-related-section {
  padding: 16px 0;
  border-top: 1px solid #EFEFEF;
  margin-top: 16px;
}

.post-related-header {
  font-size: 14px;
  font-weight: 600;
  color: #737373;
  margin-bottom: 10px;
}

.post-related-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.post-related-item {
  aspect-ratio: 1 / 1;
  position: relative;
  border: none;
  padding: 0;
  margin: 0;
  overflow: hidden;
  background: #EFEFEF;
  cursor: pointer;
  border-radius: 2px;
}

.post-related-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-similar-section {
  margin: 12px 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 1px solid #EFEFEF;
}

.profile-similar-header {
  font-size: 13px;
  font-weight: 600;
  color: #737373;
  margin-bottom: 8px;
}
`;
}

