/* SelectAI — clean URL routes (load before auth-guard.js) */
(function () {
  'use strict';

  var R = {
    home:              '/',
    tools:             '/tools',
    quotation:         '/quotation',
    signIn:            '/sign-in',
    welcome:           '/welcome',
    profile:           '/profile',
    admin:             '/admin',
    practicalAiMl:     '/practical-ai-ml-engineering',
    aiKits:            '/ai-kits',
    tests:             '/tests'
  };

  var SEGMENT_TO_PAGE = {
    '': 'index',
    index: 'index',
    tools: 'tools',
    quotation: 'quotation',
    'sign-in': 'signin',
    signin: 'signin',
    welcome: 'login',
    login: 'login',
    profile: 'profile',
    admin: 'admin',
    'practical-ai-ml-engineering': 'practicalAiMl',
    'ai-kits': 'aiKits',
    tests: 'tests'
  };

  function resolvePage(pathname) {
    var path = (pathname || window.location.pathname || '').replace(/\/+$/, '');
    var seg = path.split('/').pop() || '';
    seg = seg.toLowerCase();
    if (seg.endsWith('.html')) {
      seg = seg.slice(0, -5);
    }
    return SEGMENT_TO_PAGE[seg] || seg;
  }

  window.SelectAI_ROUTES = R;
  window.SelectAI_resolvePage = resolvePage;
}());
