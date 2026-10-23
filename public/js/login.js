(async () => {
  const meta = await loadMeta();
  setTitle('تسجيل الدخول');
  const user = await me();
  const next = (() => { const n = new URLSearchParams(location.search).get('next'); return n && /^\/(?!\/)[\w\-/#?=&.]*$/.test(n) ? n : null; })();
  if (user) { location.replace(next || homeFor(user.role)); return; }

  const forms = { login: $('#loginForm'), reg: $('#regForm') };
  const tabs = { login: $('#tabLogin'), reg: $('#tabReg') };
  const show = (k) => {
    Object.keys(forms).forEach((x) => { forms[x].hidden = x !== k; tabs[x].setAttribute('aria-selected', x === k); });
    history.replaceState(null, '', k === 'reg' ? '#register' : location.pathname + location.search);
  };
  tabs.login.onclick = () => show('login');
  tabs.reg.onclick = () => show('reg');
  if (location.hash === '#register') show('reg');

  $('select[name=grade]', forms.reg).insertAdjacentHTML('beforeend', meta.grades.map((g) => `<option value="${esc(g.key)}">${esc(g.label)}</option>`).join(''));
  $$('[data-show]').forEach((b) => b.addEventListener('click', () => {
    const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'إظهار' : 'إخفاء';
  }));

  const val = (f, n) => f.elements[n].value.trim();
  const submit = (form, errEl, fn) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try { await fn(); } catch (err) { errEl.textContent = err.message; } finally { btn.disabled = false; }
  });

  submit(forms.login, $('#loginErr'), async () => {
    const f = forms.login;
    const { user: u } = await api('/auth/login', { method: 'POST', body: { phone: val(f, 'phone'), password: f.elements.password.value } });
    location.href = next || homeFor(u.role);
  });

  submit(forms.reg, $('#regErr'), async () => {
    const f = forms.reg;
    if (f.elements.password.value !== f.elements.confirm.value) throw new Error('كلمتي السر مش متطابقتين');
    const phone = val(f, 'phone');
    await api('/auth/register', { method: 'POST', body: { name: val(f, 'name'), phone, parentPhone: val(f, 'parentPhone'), grade: f.elements.grade.value, password: f.elements.password.value } });
    toast('تم إنشاء الحساب، سجّل دخولك دلوقتي');
    show('login');
    forms.login.elements.phone.value = phone;
    forms.login.elements.password.focus();
  });
})();
