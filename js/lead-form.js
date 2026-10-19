/* SelectAI lead form handler */
(function () {
  'use strict';

  var config = window.SELECTAI_CONFIG || {};
  var leadEndpoint = (config.leadEndpoint || '').trim();
  var leadMethod = (config.leadMethod || 'POST').toUpperCase();

  var leadForm = document.getElementById('leadForm');
  var leadFeedback = document.getElementById('leadFeedback');
  var copyLeadBtn = document.getElementById('copyLead');

  if (!leadForm) return;

  function getLeadPayload() {
    return {
      name: (document.getElementById('leadName') || {}).value || '',
      email: (document.getElementById('leadEmail') || {}).value || '',
      phone: (document.getElementById('leadPhone') || {}).value || '',
      company: (document.getElementById('leadCompany') || {}).value || '',
      message: (document.getElementById('leadMessage') || {}).value || ''
    };
  }

  function setFeedback(message, isError) {
    if (!leadFeedback) return;
    leadFeedback.textContent = message;
    leadFeedback.classList.remove('error', 'success');
    leadFeedback.classList.add(isError ? 'error' : 'success');
  }

  function validateLead(payload) {
    if (payload.name.trim().length < 2) return 'Please enter a valid name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) return 'Please enter a valid email.';
    if (payload.message.trim().length < 10) return 'Please add a short project message (min 10 chars).';
    return '';
  }

  function toLeadText(payload) {
    return [
      'New SelectAI Lead',
      'Name: ' + payload.name,
      'Email: ' + payload.email,
      'Phone: ' + payload.phone,
      'Company: ' + payload.company,
      'Message: ' + payload.message
    ].join('\n');
  }

  function toMailto(payload) {
    var subject = encodeURIComponent('New Lead Inquiry - ' + payload.company);
    var body = encodeURIComponent(toLeadText(payload));
    window.location.href = 'mailto:info@selectai.it.com?subject=' + subject + '&body=' + body;
  }

  async function sendToEndpoint(payload) {
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 8000);

    try {
      var res = await fetch(leadEndpoint, {
        method: leadMethod,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error('Request failed with status ' + res.status);
      }

      return true;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  if (copyLeadBtn) {
    copyLeadBtn.addEventListener('click', function () {
      var payload = getLeadPayload();
      navigator.clipboard.writeText(toLeadText(payload)).then(function () {
        setFeedback('Lead details copied to clipboard.', false);
      }).catch(function () {
        setFeedback('Unable to copy. Please submit using Send Inquiry.', true);
      });
    });
  }

  leadForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    var payload = getLeadPayload();
    var error = validateLead(payload);
    if (error) {
      setFeedback(error, true);
      return;
    }

    try {
      localStorage.setItem('selectai-last-lead', JSON.stringify(payload));
    } catch (storageError) {
      // Ignore storage failures.
    }

    /* Save to backend MongoDB (fire-and-forget) */
    saveEnquiryToApi(payload);

    if (!leadEndpoint) {
      toMailto(payload);
      setFeedback('Inquiry prepared. Your email app is opening to send it.', false);
      leadForm.reset();
      return;
    }

    setFeedback('Submitting your inquiry...', false);

    try {
      await sendToEndpoint(payload);
      setFeedback('Thanks. Your inquiry has been submitted successfully.', false);
      leadForm.reset();
    } catch (submitError) {
      toMailto(payload);
      setFeedback('Endpoint unavailable. Opening email fallback to complete submission.', true);
    }
  });

  /* ── Enquiry persistence via backend API ──────────────── */
  function saveEnquiryToApi(payload) {
    var uid = (window.SELECTAI_USER && window.SELECTAI_USER.uid) ? window.SELECTAI_USER.uid : '';

    if (window.SelectAI_API) {
      SelectAI_API.submitEnquiry(Object.assign({}, payload, { userId: uid }))
        .catch(function (err) {
          console.warn('[SelectAI] Enquiry API error:', err.message);
        });
    }
  }
}());
