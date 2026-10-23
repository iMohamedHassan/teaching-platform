(async () => {
  await loadMeta();
  const ME = await requireUser(['super_admin', 'teacher', 'assistant']);
  setTitle('لوحة التحكم');

  const ROLE = { super_admin: 'سوبر أدمن', teacher: 'مدرس', assistant: 'مساعد', student: 'طالب', parent: 'ولي أمر' };
  const ACT = { create: 'إضافة', update: 'تعديل', delete: 'حذف', grant: 'تفعيل اشتراك', revoke: 'إلغاء اشتراك', 'reset-password': 'تغيير كلمة سر', 'reset-devices': 'تصفير أجهزة', unlock: 'فك قفل' };
  const ENT = { teacher: 'مدرس', course: 'كورس', lecture: 'محاضرة', homework: 'واجب', package: 'باقة', user: 'مستخدم', subscription: 'اشتراك' };
  const METHOD = { cash: 'كاش', vodafone_cash: 'فودافون كاش', instapay: 'إنستا باي', code: 'كود', online: 'أونلاين', free: 'مجاني', other: 'أخرى' };

  const SUP = () => ME.role === 'super_admin';
  const ALWAYS = () => true;
  const CAN_DEL = () => ME.role !== 'assistant';
  const S = { cache: {}, items: [], users: { q: '', role: '', grade: '', page: 1 } };
  const view = $('#view');

  // ---------- أدوات ----------
  const idOf = (v) => (v && typeof v === 'object' ? v._id : v);
  const nm = (v) => (v && typeof v === 'object' ? v.name || v.title || '' : '');
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach((k) => { c = c[k] = c[k] || {}; }); c[ks[ks.length - 1]] = v; };
  const empty = (m) => `<div class="empty">${m}</div>`;
  const ltr = (v) => `<span class="ltr">${esc(v || '—')}</span>`;
  const badge = (t, c = '') => `<span class="badge ${c}">${esc(t)}</span>`;
  const shown = (v) => (v ? badge('ظاهر', 'ok') : badge('مخفي', 'off'));
  const shortUA = (ua) => String(ua || '').replace(/^Mozilla\/5\.0 \(([^)]+)\).*$/, '$1').slice(0, 60);

  // ---------- خيارات القوائم (بتتحمل مرة وتتخزن) ----------
  const loaders = {
    grades: async () => META.grades.map((g) => ({ v: g.key, l: g.label })),
    teachers: async () => (await api('/admin/teachers')).items.map((t) => ({ v: t._id, l: t.name })),
    courses: async () => (await api('/admin/courses')).items.map((c) => ({ v: c._id, l: `${c.title} — ${nm(c.teacher)} (${gradeLabel(c.grade)})`, teacher: idOf(c.teacher), grade: c.grade })),
    lectures: async () => (await api('/admin/lectures')).items.map((l) => ({ v: l._id, l: l.title, course: idOf(l.course) })),
    packages: async () => (await api('/admin/packages')).items.map((p) => ({ v: p._id, l: `${p.title} — ${nm(p.teacher)} (${gradeLabel(p.grade)})`, grade: p.grade })),
  };
  const opts = (k) => (S.cache[k] = S.cache[k] || loaders[k]());
  const getOptions = (f) => (Array.isArray(f.options) ? f.options : opts(f.options));
  const USER_ROLES = [{ v: 'assistant', l: 'مساعد' }, { v: 'student', l: 'طالب' }, { v: 'parent', l: 'ولي أمر' }];
  const PAY_METHODS = ['cash', 'vodafone_cash', 'instapay', 'free', 'other'].map((v) => ({ v, l: METHOD[v] }));

  // ---------- تعريف الأقسام ----------
  // cols: [المفتاح، العنوان، دالة العرض، 'sup' = للسوبر أدمن بس]
  const RES = {
    teachers: {
      title: 'المدرسين', path: '/admin/teachers', add: 'إضافة مدرس',
      can: { add: SUP, edit: SUP, del: SUP }, typedDelete: (it) => it.slug,
      cols: [['name', 'الاسم'], ['slug', 'الرابط', (v) => `<code>/${esc(v)}</code>`], ['subject', 'المادة'],
        ['grades', 'السنين', (v) => esc((v || []).map(gradeLabel).join('، ') || '—')], ['accountPhone', 'موبايل الدخول', ltr],
        ['revenueShare', 'نسبته', (v) => esc(v || 0) + '%'], ['isActive', 'الحالة', shown]],
      fields: [
        { k: 'name', t: 'اسم المدرس', req: 1 },
        { k: 'slug', t: 'الرابط', req: 1, ltr: 1, hint: 'بالإنجليزي، مثال: mohamed-saad ← الرابط يبقى domain.com/mohamed-saad' },
        { k: 'subject', t: 'المادة', req: 1 },
        { k: 'bio', t: 'نبذة عن المدرس', type: 'textarea' },
        { k: 'photoUrl', t: 'رابط الصورة (https)', ltr: 1 },
        { k: 'grades', t: 'السنين اللي بيدرّسها', type: 'checks', options: 'grades' },
        { k: 'revenueShare', t: 'نسبة المدرس من الإيراد %', type: 'number', hint: 'بتتستخدم في تسويات المرحلة 3' },
        { k: 'order', t: 'الترتيب في الصفحة الرئيسية', type: 'number' },
        { k: 'isActive', t: 'ظاهر للطلاب', type: 'checkbox', def: true },
        { k: 'account.phone', t: 'موبايل دخول المدرس', req: 1, ltr: 1, createOnly: 1 },
        { k: 'account.password', t: 'كلمة سر المدرس (8 أحرف على الأقل)', req: 1, ltr: 1, createOnly: 1 },
      ],
    },
    courses: {
      title: 'الكورسات (الشهور)', path: '/admin/courses', add: 'إضافة كورس', hasTeacher: 1, hasGrade: 1,
      can: { add: ALWAYS, edit: ALWAYS, del: CAN_DEL },
      cols: [['title', 'العنوان'], ['teacher', 'المدرس', (v) => esc(nm(v)), 'sup'], ['grade', 'السنة', (v) => esc(gradeLabel(v))], ['order', 'الترتيب'], ['isPublished', 'الحالة', shown]],
      fields: [
        { k: 'teacher', t: 'المدرس', type: 'select', options: 'teachers', req: 1, superOnly: 1, createOnly: 1 },
        { k: 'grade', t: 'السنة الدراسية', type: 'select', options: 'grades', req: 1 },
        { k: 'title', t: 'عنوان الكورس', req: 1, hint: 'مثال: محاضرات شهر أكتوبر 2026/2027' },
        { k: 'description', t: 'وصف', type: 'textarea' },
        { k: 'order', t: 'الترتيب', type: 'number' },
        { k: 'isPublished', t: 'منشور للطلاب', type: 'checkbox', def: true },
      ],
    },
    lectures: {
      title: 'المحاضرات', path: '/admin/lectures', add: 'إضافة محاضرة', hasTeacher: 1, hasCourse: 1,
      can: { add: ALWAYS, edit: ALWAYS, del: CAN_DEL },
      prefill: (it) => ({ ...it, videoUrl: it.youtubeId ? `https://youtu.be/${it.youtubeId}` : '' }),
      cols: [['title', 'العنوان'], ['course', 'الكورس', (v) => esc(nm(v))], ['teacher', 'المدرس', (v) => esc(nm(v)), 'sup'],
        ['isFree', 'مجانية', (v) => (v ? badge('مجانية', 'gold') : '')], ['isPublished', 'الحالة', shown], ['order', 'الترتيب'],
        ['youtubeId', 'الفيديو', (v) => `<a href="https://youtu.be/${esc(v)}" target="_blank" rel="noopener noreferrer">فتح</a>`]],
      fields: [
        { k: 'course', t: 'الكورس', type: 'select', options: 'courses', req: 1 },
        { k: 'title', t: 'عنوان المحاضرة', req: 1 },
        { k: 'videoUrl', t: 'رابط فيديو يوتيوب (Unlisted)', req: 1, ltr: 1, hint: 'الصق الرابط كما هو، والنظام يستخرج الـ ID' },
        { k: 'description', t: 'وصف / ملاحظات', type: 'textarea' },
        { k: 'durationMin', t: 'المدة بالدقايق', type: 'number', nullable: 1 },
        { k: 'order', t: 'الترتيب داخل الكورس', type: 'number' },
        { k: 'isFree', t: 'حصة مجانية (تظهر لأي طالب في نفس السنة)', type: 'checkbox' },
        { k: 'isPublished', t: 'منشورة للطلاب', type: 'checkbox', def: true },
      ],
    },
    homework: {
      title: 'الواجبات', path: '/admin/homework', add: 'إضافة واجب', hasTeacher: 1, hasCourse: 1,
      can: { add: ALWAYS, edit: ALWAYS, del: CAN_DEL },
      cols: [['title', 'العنوان'], ['course', 'الكورس', (v) => esc(nm(v))], ['lecture', 'المحاضرة', (v) => esc(nm(v) || '—')], ['teacher', 'المدرس', (v) => esc(nm(v)), 'sup'],
        ['dueDate', 'آخر ميعاد', (v) => esc(v ? fmtDate(v) : '—')], ['isPublished', 'الحالة', shown]],
      fields: [
        { k: 'course', t: 'الكورس', type: 'select', options: 'courses', req: 1 },
        { k: 'lecture', t: 'المحاضرة (اختياري)', type: 'select', options: 'lectures', filterBy: ['course'] },
        { k: 'title', t: 'عنوان الواجب', req: 1 },
        { k: 'description', t: 'وصف الواجب', type: 'textarea' },
        { k: 'fileUrl', t: 'رابط ملف الواجب (https)', ltr: 1, hint: 'PDF على Drive أو أي رابط. رفع الملفات مباشرة في المرحلة 2.' },
        { k: 'dueDate', t: 'آخر ميعاد', type: 'date' },
        { k: 'isPublished', t: 'منشور للطلاب', type: 'checkbox', def: true },
      ],
    },
    packages: {
      title: 'الباقات', path: '/admin/packages', add: 'إضافة باقة', hasTeacher: 1, hasGrade: 1,
      can: { add: SUP, edit: SUP, del: SUP },
      cols: [['title', 'الباقة'], ['teacher', 'المدرس', (v) => esc(nm(v)), 'sup'], ['grade', 'السنة', (v) => esc(gradeLabel(v))],
        ['price', 'السعر', (v) => esc(money(v))], ['durationDays', 'المدة', (v) => esc(v ? v + ' يوم' : 'بدون انتهاء')],
        ['courses', 'الكورسات', (v) => esc((v || []).length + ' كورس')], ['isActive', 'الحالة', shown]],
      fields: [
        { k: 'teacher', t: 'المدرس', type: 'select', options: 'teachers', req: 1, superOnly: 1, createOnly: 1 },
        { k: 'grade', t: 'السنة الدراسية', type: 'select', options: 'grades', req: 1 },
        { k: 'title', t: 'اسم الباقة', req: 1, hint: 'مثال: باقة الترم كامل ماث - مستر محمد سعد' },
        { k: 'description', t: 'وصف الباقة', type: 'textarea' },
        { k: 'price', t: 'السعر (جنيه)', type: 'number', req: 1 },
        { k: 'durationDays', t: 'مدة الاشتراك بالأيام', type: 'number', nullable: 1, hint: 'سيبه فاضي = بدون انتهاء' },
        { k: 'courses', t: 'الكورسات اللي في الباقة', type: 'checks', options: 'courses', filterBy: ['teacher', 'grade'], hint: 'بتظهر كورسات نفس المدرس والسنة بس' },
        { k: 'order', t: 'الترتيب', type: 'number' },
        { k: 'isActive', t: 'متاحة للاشتراك', type: 'checkbox', def: true },
      ],
    },
    subscriptions: {
      title: 'الاشتراكات', path: '/admin/subscriptions', add: 'تفعيل اشتراك لطالب', hasTeacher: 1, delLabel: 'إلغاء',
      can: { add: SUP, edit: () => false, del: SUP },
      cols: [['user', 'الطالب', (v) => `${esc(v?.name)}<br><span class="muted small ltr">${esc(v?.phone)}</span>`], ['package', 'الباقة', (v) => esc(nm(v))],
        ['teacher', 'المدرس', (v) => esc(nm(v)), 'sup'], ['method', 'طريقة الدفع', (v) => esc(METHOD[v] || v)], ['amountPaid', 'المبلغ', (v) => esc(money(v))],
        ['startsAt', 'بدأ', (v) => esc(fmtDate(v))], ['expiresAt', 'بينتهي', (v) => esc(v ? fmtDate(v) : 'بدون انتهاء')],
        ['active', 'الحالة', (v) => (v ? badge('فعّال', 'ok') : badge('منتهي', 'off'))]],
      fields: [
        { k: 'phone', t: 'موبايل الطالب', req: 1, ltr: 1 },
        { k: 'package', t: 'الباقة', type: 'select', options: 'packages', req: 1 },
        { k: 'method', t: 'طريقة الدفع', type: 'select', options: PAY_METHODS, req: 1 },
        { k: 'amountPaid', t: 'المبلغ المدفوع', type: 'number', hint: 'سيبه فاضي = سعر الباقة (ومجاني = صفر)' },
        { k: 'days', t: 'مدة الاشتراك بالأيام', type: 'number', nullable: 1, hint: 'سيبه فاضي = مدة الباقة' },
        { k: 'note', t: 'ملاحظة', type: 'textarea' },
      ],
    },
    users: {
      title: 'المستخدمين', path: '/admin/users', add: 'إضافة مستخدم',
      createFields: [
        { k: 'role', t: 'نوع الحساب', type: 'select', options: USER_ROLES, req: 1 },
        { k: 'name', t: 'الاسم', req: 1 },
        { k: 'phone', t: 'رقم الموبايل', req: 1, ltr: 1 },
        { k: 'password', t: 'كلمة السر (8 أحرف على الأقل)', req: 1, ltr: 1 },
        { k: 'teacher', t: 'المدرس', type: 'select', options: 'teachers', hint: 'للمساعد فقط' },
        { k: 'grade', t: 'السنة الدراسية', type: 'select', options: 'grades', hint: 'للطالب فقط' },
        { k: 'parentPhone', t: 'موبايل ولي الأمر', ltr: 1, hint: 'للطالب' },
      ],
      editFields: [
        { k: 'name', t: 'الاسم', req: 1 },
        { k: 'phone', t: 'رقم الموبايل', req: 1, ltr: 1 },
        { k: 'grade', t: 'السنة الدراسية', type: 'select', options: 'grades', req: 1, when: (u) => u.role === 'student' },
        { k: 'parentPhone', t: 'موبايل ولي الأمر', ltr: 1, when: (u) => u.role === 'student' || u.role === 'parent' },
        { k: 'teacher', t: 'المدرس', type: 'select', options: 'teachers', req: 1, when: (u) => u.role === 'assistant' },
        { k: 'maxDevices', t: 'أقصى عدد أجهزة', type: 'number', req: 1 },
        { k: 'isActive', t: 'الحساب مفعّل', type: 'checkbox', def: true },
      ],
    },
  };

  // ---------- النماذج ----------
  const dataAttrs = (x) => ['teacher', 'grade', 'course'].filter((k) => x[k]).map((k) => `data-${k}="${esc(x[k])}"`).join(' ');

  async function fieldHtml(f, val) {
    val = Array.isArray(val) ? val.map(idOf) : idOf(val);
    if (f.type === 'date' && val) val = String(val).slice(0, 10);
    const name = esc(f.k);
    const label = `<span>${esc(f.t)}${f.req ? ' *' : ''}</span>`;
    const hint = f.hint ? `<small>${esc(f.hint)}</small>` : '';
    const dir = f.ltr ? ' dir="ltr"' : '';
    const req = f.req ? ' required' : '';
    if (f.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${name}" ${(val ?? f.def) ? 'checked' : ''}> ${esc(f.t)}</label>`;
    if (f.type === 'select') {
      const o = await getOptions(f);
      return `<label class="field">${label}<select name="${name}"${req}><option value="">${f.req ? 'اختار…' : '— بدون —'}</option>${o.map((x) => `<option value="${esc(x.v)}" ${dataAttrs(x)} ${val != null && String(val) === String(x.v) ? 'selected' : ''}>${esc(x.l)}</option>`).join('')}</select>${hint}</label>`;
    }
    if (f.type === 'checks') {
      const o = await getOptions(f);
      const set = new Set((val || []).map(String));
      return `<div class="field">${label}<div class="checks" data-checks="${name}">${o.map((x) => `<label class="check" ${dataAttrs(x)}><input type="checkbox" name="${name}" value="${esc(x.v)}" ${set.has(String(x.v)) ? 'checked' : ''}> ${esc(x.l)}</label>`).join('') || '<span class="muted small">مفيش اختيارات متاحة</span>'}</div>${hint}</div>`;
    }
    if (f.type === 'textarea') return `<label class="field">${label}<textarea name="${name}"${dir}>${esc(val ?? '')}</textarea>${hint}</label>`;
    const type = f.type === 'number' ? 'number" step="any' : (f.type || 'text');
    return `<label class="field">${label}<input type="${type}" name="${name}" value="${esc(val ?? '')}"${dir}${req}>${hint}</label>`;
  }

  function collect(form, fields, editing) {
    const out = {};
    for (const f of fields) {
      let v;
      if (f.type === 'checkbox') v = form.elements[f.k].checked;
      else if (f.type === 'checks') v = $$(`input[name="${f.k}"]:checked`, form).map((i) => i.value);
      else {
        v = form.elements[f.k].value.trim();
        if (v === '') v = editing && !f.req && !(f.type === 'number' && !f.nullable) ? null : undefined;
        else if (f.type === 'number') v = Number(v);
      }
      if (v !== undefined) setPath(out, f.k, v);
    }
    return out;
  }

  function modal(title, bodyHtml, footerHtml) {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    dlg.innerHTML = `<div class="modal-h"><h3>${esc(title)}</h3><button class="icon-btn" type="button" data-close aria-label="إغلاق">×</button></div>
      <div class="modal-b">${bodyHtml}</div>${footerHtml ? `<div class="modal-f">${footerHtml}</div>` : ''}`;
    dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
    return dlg;
  }

  async function openForm(key, item, preset = {}) {
    const r = RES[key];
    const editing = !!item;
    const src = editing ? (r.prefill ? r.prefill(item) : item) : preset;
    const fields = (editing ? r.editFields || r.fields : r.createFields || r.fields)
      .filter((f) => !(editing && f.createOnly) && !(f.superOnly && !SUP()) && !(f.when && !f.when(item)));
    const html = (await Promise.all(fields.map((f) => fieldHtml(f, getPath(src, f.k))))).join('');
    const dlg = modal(editing ? 'تعديل' : r.add, `<form id="mf">${html}<div class="form-error" role="alert"></div></form>`,
      '<button class="btn" type="submit" form="mf">حفظ</button><button class="btn ghost" type="button" data-close>إلغاء</button>');
    const form = $('#mf', dlg);

    // فلترة الاختيارات المعتمدة على بعضها (كورسات المدرس والسنة، محاضرات الكورس)
    const apply = () => {
      const cur = { teacher: form.elements.teacher?.value || ME.teacher, grade: form.elements.grade?.value, course: form.elements.course?.value };
      fields.filter((f) => f.filterBy).forEach((f) => {
        const els = f.type === 'checks' ? $$(`[data-checks="${f.k}"] label`, form) : $$(`select[name="${f.k}"] option[value]:not([value=""])`, form);
        els.forEach((el) => {
          const ok = f.filterBy.every((k) => !cur[k] || el.dataset[k] === cur[k]);
          el.hidden = !ok;
          if (el.tagName === 'OPTION') { el.disabled = !ok; if (!ok && el.selected) el.parentElement.value = ''; }
          else if (!ok) { const i = $('input', el); if (i) i.checked = false; }
        });
      });
    };
    form.addEventListener('change', apply);
    apply();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('.form-error', form); err.textContent = '';
      const btn = $('button[type=submit]', dlg); btn.disabled = true;
      try {
        await api(editing ? `${r.path}/${item._id}` : r.path, { method: editing ? 'PATCH' : 'POST', body: collect(form, fields, editing) });
        S.cache = {};
        dlg.close();
        toast(editing ? 'تم الحفظ' : 'تمت الإضافة');
        await route();
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    });
  }

  async function removeItem(key, id) {
    const r = RES[key];
    const it = S.items.find((x) => x._id === id);
    if (r.typedDelete) {
      const word = r.typedDelete(it);
      if (prompt(`حذف نهائي لـ "${it.name}" وكل محتواه وباقاته واشتراكات طلابه.\nاكتب "${word}" للتأكيد:`) !== word) return toast('اتلغى الحذف', 'err');
    } else if (!confirm(r.delLabel ? 'متأكد من الإلغاء؟' : 'متأكد من الحذف؟')) return;
    try { await api(`${r.path}/${id}`, { method: 'DELETE' }); S.cache = {}; toast(r.delLabel ? 'تم الإلغاء' : 'تم الحذف'); await route(); }
    catch (e) { toast(e.message, 'err'); }
  }

  // ---------- عرض قائمة عامة ----------
  async function listView(key) {
    const r = RES[key];
    const sup = SUP();
    const [data, teachers, courses] = await Promise.all([api(r.path), sup && r.hasTeacher ? opts('teachers') : [], r.hasCourse ? opts('courses') : []]);
    S.items = data.items;
    const cols = r.cols.filter((c) => c[3] !== 'sup' || sup);
    const canAdd = r.can.add(), canEdit = r.can.edit(), canDel = r.can.del();
    const sel = (id, all, list) => `<select id="${id}"><option value="">${all}</option>${list.map((x) => `<option value="${esc(x.v)}">${esc(x.l)}</option>`).join('')}</select>`;

    view.innerHTML = `
      <div class="toolbar">
        <input type="search" id="q" placeholder="بحث…" aria-label="بحث">
        ${teachers.length ? sel('fTeacher', 'كل المدرسين', teachers) : ''}
        ${r.hasGrade ? sel('fGrade', 'كل السنين', META.grades.map((g) => ({ v: g.key, l: g.label }))) : ''}
        ${courses.length ? sel('fCourse', 'كل الكورسات', courses) : ''}
        ${canAdd ? `<button class="btn" type="button" data-act="add">${esc(r.add)}</button>` : ''}
      </div>
      ${data.items.length ? `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${esc(c[1])}</th>`).join('')}<th></th></tr></thead><tbody>
        ${data.items.map((it) => `<tr data-id="${esc(it._id)}" data-teacher="${esc(idOf(it.teacher) || '')}" data-grade="${esc(it.grade || it.course?.grade || '')}" data-course="${esc(idOf(it.course) || '')}">
          ${cols.map((c) => `<td>${c[2] ? c[2](it[c[0]], it) : esc(it[c[0]] ?? '—')}</td>`).join('')}
          <td class="act">${canEdit ? `<button class="btn sm ghost" type="button" data-act="edit" data-id="${esc(it._id)}">تعديل</button> ` : ''}${canDel ? `<button class="btn sm danger" type="button" data-act="del" data-id="${esc(it._id)}">${esc(r.delLabel || 'حذف')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>`
        : empty(`مفيش بيانات في "${esc(r.title)}" لسه.${canAdd ? ` اضغط "${esc(r.add)}" عشان تبدأ.` : ''}`)}`;

    const filter = () => {
      const q = $('#q').value.trim().toLowerCase(), t = $('#fTeacher')?.value, g = $('#fGrade')?.value, c = $('#fCourse')?.value;
      $$('tbody tr', view).forEach((tr) => {
        tr.hidden = !((!q || tr.textContent.toLowerCase().includes(q)) && (!t || tr.dataset.teacher === t) && (!g || tr.dataset.grade === g) && (!c || tr.dataset.course === c));
      });
    };
    $('.toolbar', view).addEventListener('input', filter);
    $('.toolbar', view).addEventListener('change', filter);
    view.onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'add') openForm(key);
      if (b.dataset.act === 'edit') openForm(key, S.items.find((x) => x._id === b.dataset.id));
      if (b.dataset.act === 'del') removeItem(key, b.dataset.id);
    };
  }

  // ---------- المستخدمين ----------
  async function usersView() {
    const sup = SUP(), st = S.users;
    view.innerHTML = `
      <div class="toolbar">
        <input type="search" id="uq" placeholder="بحث بالاسم أو الموبايل…" value="${esc(st.q)}" aria-label="بحث">
        ${sup ? `<select id="urole"><option value="">كل الأدوار</option>${Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${st.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}
        <select id="ugrade"><option value="">كل السنين</option>${META.grades.map((g) => `<option value="${esc(g.key)}" ${st.grade === g.key ? 'selected' : ''}>${esc(g.label)}</option>`).join('')}</select>
        ${sup ? '<button class="btn" type="button" id="uadd">إضافة مستخدم</button>' : ''}
      </div><div id="ulist"></div>`;

    const load = async () => {
      const p = new URLSearchParams({ page: st.page, limit: 25 });
      ['q', 'role', 'grade'].forEach((k) => { if (st[k]) p.set(k, st[k]); });
      const box = $('#ulist');
      try {
        const d = await api('/admin/users?' + p);
        box.innerHTML = d.items.length ? `
          <div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الموبايل</th><th>الدور</th><th>السنة</th><th>ولي الأمر</th>${sup ? '<th>الأجهزة</th>' : ''}<th>الحالة</th><th>سجّل في</th><th></th></tr></thead><tbody>
          ${d.items.map((u) => `<tr><td>${esc(u.name)}</td><td>${ltr(u.phone)}</td><td>${badge(ROLE[u.role] || u.role)}</td><td>${esc(u.grade ? gradeLabel(u.grade) : '—')}</td><td>${ltr(u.parentPhone)}</td>
            ${sup ? `<td>${esc(u.devicesCount)}/${esc(u.maxDevices)}</td>` : ''}<td>${u.isActive ? badge('مفعّل', 'ok') : badge('موقوف', 'off')}</td><td>${esc(fmtDate(u.createdAt))}</td>
            <td class="act"><button class="btn sm ghost" type="button" data-open="${esc(u._id)}">تفاصيل</button></td></tr>`).join('')}
          </tbody></table></div>
          <div class="row" style="margin-top:1rem;justify-content:space-between"><span class="muted small">الإجمالي: ${esc(d.total)}</span>
            <span class="row"><button class="btn sm ghost" type="button" id="prev" ${d.page <= 1 ? 'disabled' : ''}>السابق</button><span>${esc(d.page)} / ${esc(d.pages)}</span><button class="btn sm ghost" type="button" id="next" ${d.page >= d.pages ? 'disabled' : ''}>التالي</button></span></div>`
          : empty('مفيش مستخدمين مطابقين.');
        $('#prev')?.addEventListener('click', () => { st.page--; load(); });
        $('#next')?.addEventListener('click', () => { st.page++; load(); });
      } catch (e) { box.innerHTML = empty(esc(e.message)); }
    };
    let timer;
    $('#uq').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { st.q = e.target.value.trim(); st.page = 1; load(); }, 300); });
    $('#urole')?.addEventListener('change', (e) => { st.role = e.target.value; st.page = 1; load(); });
    $('#ugrade').addEventListener('change', (e) => { st.grade = e.target.value; st.page = 1; load(); });
    $('#uadd')?.addEventListener('click', () => openForm('users'));
    view.onclick = (e) => { const b = e.target.closest('[data-open]'); if (b) openUser(b.dataset.open); };
    await load();
  }

  async function openUser(id) {
    let d;
    try { d = await api(`/admin/users/${encodeURIComponent(id)}`); } catch (e) { return toast(e.message, 'err'); }
    const u = d.user, sup = SUP();
    const locked = u.lockUntil && new Date(u.lockUntil) > new Date();
    const body = `
      <dl class="kv">
        <dt>الاسم</dt><dd>${esc(u.name)}</dd><dt>الموبايل</dt><dd>${ltr(u.phone)}</dd>
        <dt>الدور</dt><dd>${badge(ROLE[u.role] || u.role)} ${u.isActive ? badge('مفعّل', 'ok') : badge('موقوف', 'off')} ${locked ? badge('مقفول مؤقتاً', 'off') : ''}</dd>
        ${u.grade ? `<dt>السنة</dt><dd>${esc(gradeLabel(u.grade))}</dd>` : ''}
        ${u.parentPhone ? `<dt>ولي الأمر</dt><dd>${ltr(u.parentPhone)}</dd>` : ''}
        ${u.teacher ? `<dt>المدرس</dt><dd>${esc(nm(u.teacher))}</dd>` : ''}
        <dt>سجّل في</dt><dd>${esc(fmtDateTime(u.createdAt))}</dd><dt>آخر دخول</dt><dd>${esc(fmtDateTime(u.lastLoginAt))}</dd>
        ${sup ? `<dt>الأجهزة</dt><dd>${esc((u.devices || []).length)} / ${esc(u.maxDevices)}${(u.devices || []).length ? `<ul class="small muted" style="margin:.3rem 0 0;padding-inline-start:1.1rem">${u.devices.map((x) => `<li>${esc(shortUA(x.userAgent))} — ${esc(fmtDateTime(x.lastSeen))} <span class="ltr">${esc(x.ip)}</span></li>`).join('')}</ul>` : ''}</dd>
          <dt>جلسات شغالة</dt><dd>${esc(d.sessions)}</dd>` : ''}
      </dl>
      <h3 style="margin:1.5rem 0 .75rem">الاشتراكات</h3>
      ${d.subscriptions.length ? `<div class="table-wrap"><table><thead><tr><th>الباقة</th><th>المدرس</th><th>المبلغ</th><th>بينتهي</th><th>الحالة</th>${sup ? '<th></th>' : ''}</tr></thead><tbody>
        ${d.subscriptions.map((s) => `<tr><td>${esc(nm(s.package))}</td><td>${esc(nm(s.teacher))}</td><td>${esc(money(s.amountPaid))}<br><span class="muted small">${esc(METHOD[s.method] || '')}</span></td>
          <td>${esc(s.expiresAt ? fmtDate(s.expiresAt) : 'بدون انتهاء')}</td><td>${s.active ? badge('فعّال', 'ok') : badge('منتهي', 'off')}</td>
          ${sup ? `<td class="act"><button class="btn sm danger" type="button" data-uact="revoke" data-sid="${esc(s._id)}">إلغاء</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : empty('مفيش اشتراكات.')}`;

    const foot = sup ? `
      <button class="btn ghost sm" type="button" data-uact="edit">تعديل البيانات</button>
      ${u.role === 'student' ? '<button class="btn sm" type="button" data-uact="grant">تفعيل باقة</button>' : ''}
      <button class="btn ghost sm" type="button" data-uact="toggle">${u.isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}</button>
      <button class="btn ghost sm" type="button" data-uact="pw">كلمة سر جديدة</button>
      <button class="btn ghost sm" type="button" data-uact="devices">تصفير الأجهزة</button>
      ${locked ? '<button class="btn ghost sm" type="button" data-uact="unlock">فك القفل</button>' : ''}
      ${u.role === 'teacher' ? '' : '<button class="btn danger sm" type="button" data-uact="del">حذف</button>'}` : '';
    const dlg = modal(u.name, body, foot);

    dlg.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-uact]');
      if (!b) return;
      const act = b.dataset.uact, base = `/admin/users/${u._id}`;
      try {
        if (act === 'edit') { dlg.close(); return openForm('users', u); }
        if (act === 'grant') { dlg.close(); return openForm('subscriptions', null, { phone: u.phone }); }
        if (act === 'toggle') await api(base, { method: 'PATCH', body: { isActive: !u.isActive } });
        else if (act === 'pw') {
          const pw = prompt('كلمة السر الجديدة (8 أحرف على الأقل):');
          if (!pw) return;
          await api(`${base}/reset-password`, { method: 'POST', body: { password: pw } });
        } else if (act === 'devices') { if (!confirm('هيتصفّر الأجهزة والطالب هيخرج من كل الأجهزة. متأكد؟')) return; await api(`${base}/reset-devices`, { method: 'POST' }); }
        else if (act === 'unlock') await api(`${base}/unlock`, { method: 'POST' });
        else if (act === 'revoke') { if (!confirm('إلغاء الاشتراك ده؟')) return; await api(`/admin/subscriptions/${b.dataset.sid}`, { method: 'DELETE' }); }
        else if (act === 'del') {
          if (prompt(`حذف نهائي لـ "${u.name}" واشتراكاته. اكتب "حذف" للتأكيد:`) !== 'حذف') return;
          await api(base, { method: 'DELETE' }); dlg.close(); toast('تم الحذف'); return route();
        }
        toast('تم');
        dlg.close();
        await route();
        openUser(id);
      } catch (ex) { toast(ex.message, 'err'); }
    });
  }

  // ---------- الرئيسية (إحصائيات) ----------
  async function homeView() {
    const { stats: s } = await api('/admin/stats');
    const cards = SUP()
      ? [['students', 'الطلاب'], ['newStudents7d', 'طلاب جدد (7 أيام)'], ['teachers', 'المدرسين'], ['courses', 'الكورسات'], ['lectures', 'المحاضرات'], ['homework', 'الواجبات'], ['packages', 'الباقات'], ['activeSubs', 'اشتراكات فعّالة'], ['revenue', 'الإيراد المسجّل']]
      : [['students', 'طلابي'], ['courses', 'الكورسات'], ['lectures', 'المحاضرات'], ['homework', 'الواجبات'], ['packages', 'الباقات'], ['activeSubs', 'اشتراكات فعّالة'], ['revenue', 'الإيراد المسجّل']];
    view.innerHTML = `
      <div class="welcome"><h2>أهلاً ${esc(ME.name)}</h2><p>${esc(ROLE[ME.role])}</p></div>
      <div class="stats">${cards.map(([k, t]) => `<div class="stat"><b>${k === 'revenue' ? esc(money(s[k])) : esc(Number(s[k] || 0).toLocaleString('en-US'))}</b>${esc(t)}</div>`).join('')}</div>
      ${SUP() && !s.teachers ? `<div class="card" style="margin-top:1.5rem"><h3>ابدأ من هنا</h3><ol class="muted">
        <li>أضف مدرس من قسم "المدرسين".</li><li>أضف كورس (شهر أو وحدة) لكل سنة.</li><li>أضف المحاضرات بروابط يوتيوب Unlisted.</li>
        <li>اعمل باقة بالسعر والسنة واختار الكورسات اللي فيها.</li><li>فعّل الباقة للطالب من "الاشتراكات" بعد ما يدفع.</li></ol></div>` : ''}`;
  }

  // ---------- سجل العمليات ----------
  async function auditView() {
    const { items } = await api('/admin/audit');
    view.innerHTML = items.length ? `<div class="table-wrap"><table><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>القسم</th><th>تفاصيل</th></tr></thead><tbody>
      ${items.map((a) => `<tr><td>${esc(fmtDateTime(a.createdAt))}</td><td>${esc(a.actorName)} ${badge(ROLE[a.role] || a.role || '')}</td><td>${esc(ACT[a.action] || a.action)}</td><td>${esc(ENT[a.entity] || a.entity)}</td>
        <td class="small muted">${esc(Object.values(a.meta || {}).filter((v) => typeof v !== 'object' && v !== '' && v != null).slice(0, 3).join(' • '))}</td></tr>`).join('')}</tbody></table></div>`
      : empty('مفيش عمليات مسجّلة لسه.');
  }

  // ---------- القائمة والتوجيه ----------
  const MENU = [
    ['home', 'الرئيسية', ALWAYS], ['teachers', 'المدرسين', SUP], ['courses', 'الكورسات', ALWAYS], ['lectures', 'المحاضرات', ALWAYS],
    ['homework', 'الواجبات', ALWAYS], ['packages', 'الباقات', ALWAYS], ['users', SUP() ? 'المستخدمين' : 'طلابي', ALWAYS],
    ['subscriptions', 'الاشتراكات', ALWAYS], ['audit', 'سجل العمليات', SUP],
  ].filter((m) => m[2]());
  $('#menu').innerHTML = MENU.map(([k, t]) => `<a href="#${k}" data-k="${k}">${esc(t)}</a>`).join('');
  $('#who').textContent = `${ME.name} • ${ROLE[ME.role]}`;
  $('#logout').onclick = logout;
  $('#menuBtn').onclick = () => $('#side').classList.toggle('open');

  async function route() {
    let key = location.hash.slice(1) || 'home';
    if (!MENU.some((m) => m[0] === key)) key = 'home';
    $$('#menu a').forEach((a) => (a.dataset.k === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    $('#side').classList.remove('open');
    $('#pageTitle').textContent = MENU.find((m) => m[0] === key)[1];
    view.onclick = null;
    try {
      if (key === 'home') await homeView();
      else if (key === 'users') await usersView();
      else if (key === 'audit') await auditView();
      else await listView(key);
    } catch (e) {
      if (e.status === 401) { location.replace('/login?next=/admin'); return; }
      view.innerHTML = empty(esc(e.message));
    }
  }
  window.addEventListener('hashchange', route);
  route();
})();
