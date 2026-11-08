/* =========================================================
   SelectAI — auth-guard.js  v20260702b
   Public marketing pages are open to guests; protected pages
   require sign-in. Load AFTER app-config.js and routes.js.
   ========================================================= */

(function () {
  'use strict';

  var TOKEN_KEY = 'selectai_token';
  var R = window.SelectAI_ROUTES || {
    home: '/',
    signIn: '/sign-in',
    admin: '/admin'
  };

  function _currentPage() {
    if (window.SelectAI_resolvePage) {
      return window.SelectAI_resolvePage(window.location.pathname);
    }
    var path = (window.location.pathname || '').replace(/\/+$/, '');
    var page = path.split('/').pop();
    if (!page || page === '') return 'index';
    page = page.toLowerCase();
    if (page.endsWith('.html')) page = page.slice(0, -5);
    return page;
  }

  var PAGE = _currentPage();

  var PUBLIC_PAGES = {
    index: true,
    tools: true,
    quotation: true,
    login: true,
    signin: true,
    practicalaiml: true,
    practicalAiMl: true,
    aiKits: true,
    'ai-kits': true
  };

  function _isAuthPage() {
    return PAGE === 'login' || PAGE === 'signin';
  }

  function _isPublicPage() {
    return !!PUBLIC_PAGES[PAGE];
  }

  function _getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function _revealPage() {
    document.documentElement.style.visibility = 'visible';
  }

  function _applyGuestNav() {
    var signInItem = document.getElementById('navSignInItem');
    var userItem   = document.getElementById('navUserItem');
    if (signInItem) signInItem.style.display = 'list-item';
    if (userItem) userItem.style.display = 'none';
  }

  function _runWhenDomReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  var token = _getToken();
  if (!token) {
    if (_isPublicPage()) {
      _applyGuestNav();
      _runWhenDomReady(_applyGuestNav);
      _revealPage();
    } else if (!_isAuthPage()) {
      window.location.replace(R.home);
    } else {
      _revealPage();
    }
    return;
  }

  function _fullName(u) {
    var name = ((u.firstName || '') + ' ' + (u.lastName || '')).trim();
    return name || u.displayName || u.email || '';
  }

  fetch('/api/auth/me', {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'application/json'
    }
  })
    .then(function (res) {
      if (res.status === 401 || res.status === 403) {
        try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
        if (_isPublicPage()) {
          _runWhenDomReady(_applyGuestNav);
          _revealPage();
          return null;
        }
        window.location.replace(R.signIn);
        return null;
      }
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      var profile = data.user || {};
      var role    = profile.role || 'user';

      window.SELECTAI_USER = {
        uid:         profile.uid         || '',
        displayName: _fullName(profile),
        firstName:   profile.firstName   || '',
        lastName:    profile.lastName    || '',
        email:       profile.email       || '',
        phone:       profile.phone       || '',
        photoURL:    profile.photoURL    || '',
        role:        role,
        verified:    profile.verified    || false
      };

      if (PAGE === 'admin' && role !== 'admin') {
        window.location.replace(R.home);
        return;
      }

      _ping();
      setInterval(_ping, 2 * 60 * 1000);

      _revealPage();
      document.addEventListener('DOMContentLoaded', function () {
        _applyUserToUI(window.SELECTAI_USER);
      });
      if (document.readyState !== 'loading') {
        _applyUserToUI(window.SELECTAI_USER);
      }
    })
    .catch(function (err) {
      console.error('[SelectAI] Auth guard error:', err.message);
      if (_isPublicPage()) {
        _runWhenDomReady(_applyGuestNav);
        _revealPage();
        return;
      }
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      if (!_isAuthPage()) {
        window.location.replace(R.signIn);
      } else {
        _revealPage();
      }
    });

  function _ping() {
    var t = _getToken();
    if (!t) return;
    fetch('/api/sessions/ping', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ displayName: _fullName(window.SELECTAI_USER || {}) })
    }).catch(function () {});
  }

  function _applyUserToUI(u) {
    var signInItem = document.getElementById('navSignInItem');
    var userItem   = document.getElementById('navUserItem');
    if (signInItem) signInItem.style.display = 'none';
    if (userItem) userItem.style.display = 'list-item';

    var adminLink = document.getElementById('adminNavItem');
    if (adminLink) adminLink.style.display = (u.role === 'admin') ? '' : 'none';

    var nameEl = document.getElementById('navUserDropdownName');
    if (nameEl) nameEl.textContent = _fullName(u);

    var avatarEl = document.getElementById('navUserAvatar');
    var iconEl   = document.getElementById('navUserIcon');
    if (avatarEl && u.photoURL) {
      avatarEl.src = u.photoURL;
      avatarEl.alt = _fullName(u) || 'Profile';
      avatarEl.style.display = 'block';
      if (iconEl) iconEl.style.display = 'none';
    } else {
      if (avatarEl) avatarEl.style.display = 'none';
      if (iconEl) iconEl.style.display = 'block';
    }
  }

}());
