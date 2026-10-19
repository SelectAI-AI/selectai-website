/* SelectAI runtime configuration */
(function () {
  'use strict';

  window.SELECTAI_CONFIG = {
    /* ── Lead form ──────────────────────────────────────────
       Set leadEndpoint to your backend URL to POST leads.
       Leave empty to fall back to mailto: (default).        */
    leadEndpoint: '/api/enquiries',
    leadMethod:   'POST',

    /* ── KPI dashboard refresh (milliseconds) ──────────── */
    kpiRefreshMs: 60000
  };
}());
