const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function text(form, key, maximum = 5000) {
  return String(form.get(key) || '').trim().slice(0, maximum);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function messageRows(fields) {
  return Object.entries(fields)
    .filter(([, value]) => value)
    .map(([label, value]) => `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top">${escapeHtml(label)}</th><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`)
    .join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ ok: false, message: 'This form submission was not accepted.' }, 403);

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 256 * 1024) return json({ ok: false, message: 'The message is too large.' }, 413);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, message: 'The form data could not be read.' }, 400);
  }

  if (text(form, 'company_website', 200)) {
    return json({ ok: true, message: env.CONTACT_SUCCESS_MESSAGE || 'Thanks. Your project inquiry was sent successfully.' });
  }

  const name = text(form, 'name', 120);
  const email = text(form, 'email', 254);
  const message = text(form, 'message', 5000);
  if (name.length < 2) return json({ ok: false, message: 'Please enter your name.' }, 400);
  if (!validEmail(email)) return json({ ok: false, message: 'Please enter a valid email address.' }, 400);
  if (message.length < 12) return json({ ok: false, message: 'Please add a little more detail about your project.' }, 400);

  const requiredConfiguration = ['RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'CONTACT_FROM_EMAIL'];
  const missing = requiredConfiguration.filter(key => !String(env[key] || '').trim());
  if (missing.length) {
    console.error(`Contact delivery is not configured: ${missing.join(', ')}`);
    return json({ ok: false, message: 'Contact delivery is temporarily unavailable.' }, 503);
  }

  const fields = {
    Name: name,
    Email: email,
    Focus: text(form, 'focus', 160),
    Budget: text(form, 'budget', 160),
    Timeline: text(form, 'timeline', 160),
    Intent: text(form, 'inquiry_intent', 160),
    'Project references': text(form, 'project_references', 1000),
    Message: message
  };
  const safeSubjectName = name.replace(/[\r\n]+/g, ' ');
  const safeSubjectFocus = fields.Focus.replace(/[\r\n]+/g, ' ');
  const subjectFocus = safeSubjectFocus ? ` - ${safeSubjectFocus}` : '';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM_EMAIL,
      to: [env.CONTACT_TO_EMAIL],
      reply_to: email,
      subject: `Portfolio inquiry from ${safeSubjectName}${subjectFocus}`.slice(0, 180),
      html: `<div style="font-family:Arial,sans-serif;color:#111827"><h1 style="font-size:22px">New portfolio inquiry</h1><table style="border-collapse:collapse;width:100%;max-width:720px">${messageRows(fields)}</table></div>`
    })
  });

  if (!response.ok) {
    const failure = await response.text().catch(() => '');
    console.error(`Resend delivery failed (${response.status}): ${failure.slice(0, 500)}`);
    return json({ ok: false, message: 'The message could not be delivered right now.' }, 502);
  }

  return json({
    ok: true,
    message: env.CONTACT_SUCCESS_MESSAGE || 'Thanks. Your project inquiry was sent successfully.'
  });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      'Cache-Control': 'no-store'
    }
  });
}
