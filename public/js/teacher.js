(async () => {
  await loadMeta();
  const user = await renderNav($('#nav'));
  const slug = decodeURIComponent(location.pathname.replace(/^\/|\/$/g, '')).toLowerCase();

  let data;
  try { data = await api('/public/teachers/' + encodeURIComponent(slug)); }
  catch (_) {
    $('#root').innerHTML = '<section class="section"><div class="container"><div class="empty">المدرس ده مش موجود. <a href="/">ارجع للرئيسية</a></div></div></section>';
    return;
  }
  const { teacher: t, packages } = data;
  setTitle(t.name);
  $('#name').textContent = t.name;
  $('#subject').textContent = t.subject;
  $('#bio').textContent = t.bio || '';
  $('#avatar').innerHTML = t.photoUrl ? `<img src="${esc(t.photoUrl)}" alt="">` : esc(initial(t.name));

  const order = META.grades.map((g) => g.key);
  const grades = [...new Set([...(t.grades || []), ...packages.map((p) => p.grade)])].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  let current = user?.role === 'student' && grades.includes(user.grade) ? user.grade : grades[0];

  const cta = (p) => {
    if (!user) return `<a class="btn block" href="/login?next=${encodeURIComponent('/' + slug)}">سجّل دخولك للاشتراك</a>`;
    if (user.role !== 'student') return '';
    if (user.grade !== p.grade) return '<p class="muted small">الباقة دي لسنة تانية غير سنتك.</p>';
    if (!META.whatsapp) return '<p class="muted small">للاشتراك تواصل مع الإدارة لتفعيل الباقة.</p>';
    const msg = `عايز أشترك في باقة "${p.title}" مع ${t.name} (${gradeLabel(p.grade)}). رقمي: ${user.phone}`;
    return `<a class="btn block" target="_blank" rel="noopener" href="https://wa.me/${esc(META.whatsapp)}?text=${encodeURIComponent(msg)}">اطلب الاشتراك على واتساب</a>`;
  };

  const draw = () => {
    $('#grades').innerHTML = grades.map((g) => `<button class="chip" type="button" data-g="${esc(g)}" aria-pressed="${g === current}">${esc(gradeLabel(g))}</button>`).join('');
    const list = packages.filter((p) => p.grade === current);
    $('#packages').innerHTML = list.length ? list.map((p) => `
      <article class="card pkg">
        <h3>${esc(p.title)}</h3>
        <div class="price">${Number(p.price).toLocaleString('en-US')} <small>جنيه</small></div>
        ${p.description ? `<p class="muted">${esc(p.description)}</p>` : ''}
        <div class="chips">
          <span class="badge">${p.durationDays ? esc(p.durationDays) + ' يوم' : 'بدون انتهاء'}</span>
          <span class="badge">${esc(p.lectures)} محاضرة</span>
          ${p.courses.map((c) => `<span class="badge">${esc(c)}</span>`).join('')}
        </div>
        <div style="margin-top:auto">${cta(p)}</div>
      </article>`).join('') : '<div class="empty" style="grid-column:1/-1">مفيش باقات للسنة دي لسه.</div>';
  };
  $('#grades').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b) { current = b.dataset.g; draw(); } });
  draw();
})();
