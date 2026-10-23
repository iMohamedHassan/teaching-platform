(async () => {
  await loadMeta();
  const user = await requireUser(['student']);
  setTitle('لوحة الطالب');
  $('#who').textContent = `${user.name} • ${gradeLabel(user.grade)}`;
  const view = $('#view');
  let cleanup = null;

  const MENU = [['courses', 'محاضراتي'], ['homework', 'واجباتي'], ['packages', 'اشتراكاتي'], ['account', 'حسابي']];
  $('#menu').innerHTML = MENU.map(([k, t]) => `<a href="#${k}" data-k="${k}">${t}</a>`).join('');
  $('#logout').onclick = logout;
  $('#menuBtn').onclick = () => $('#side').classList.toggle('open');

  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const empty = (msg) => `<div class="empty">${msg}</div>`;

  // ---------- محاضراتي ----------
  async function viewCourses() {
    const { courses } = await api('/me/courses');
    const open = courses.filter((c) => c.unlocked).length;
    view.innerHTML = `
      <div class="welcome"><h2>مرحباً بك يا ${esc(user.name)}</h2>
        <p>${open ? 'اختار الكورس وكمّل مذاكرتك.' : 'لسه مفيش باقة مفعّلة عندك. اختار مدرسك واشترك في باقتك.'}</p></div>
      ${courses.length ? `<div class="grid">${courses.map((c) => `
        <a class="card course-card ${c.unlocked ? '' : 'locked'}" href="#course/${esc(c.id)}">
          <h3>${esc(c.title)}</h3>
          <p class="muted">${esc(c.teacher.name)} • ${esc(c.teacher.subject)}</p>
          <div class="chips">
            <span class="badge">${esc(c.lectures)} محاضرة</span>
            ${c.unlocked ? '<span class="badge ok">مفتوح</span>' : '<span class="badge">مقفول</span>'}
            ${!c.unlocked && c.freeLectures ? `<span class="badge gold">${esc(c.freeLectures)} مجانية</span>` : ''}
          </div></a>`).join('')}</div>`
        : empty('مفيش كورسات لسنتك لسه. <a href="/">شوف المدرسين</a>')}`;
  }

  // ---------- كورس واحد ----------
  async function viewCourse(id) {
    const { course, lectures } = await api(`/me/courses/${encodeURIComponent(id)}/lectures`);
    view.innerHTML = `
      <p><a href="#courses">رجوع للكورسات</a></p>
      <h2>${esc(course.title)}</h2><p class="muted">${esc(course.teacher)}</p>
      ${course.unlocked ? '' : `<div class="card" style="margin:1rem 0">الكورس ده محتاج اشتراك. <a href="/${esc(course.teacherSlug)}">شوف باقات ${esc(course.teacher)}</a></div>`}
      ${lectures.length ? `<div class="list">${lectures.map((l, i) => {
        const inner = `<span class="n">${i + 1}</span><div class="grow"><strong>${esc(l.title)}</strong>
          <div class="chips">${l.isFree ? '<span class="badge gold">مجانية</span>' : ''}${l.durationMin ? `<span class="badge">${esc(l.durationMin)} دقيقة</span>` : ''}${l.locked ? '<span class="badge">مقفولة</span>' : ''}</div></div>`;
        return l.locked ? `<div class="lec locked">${inner}</div>` : `<a class="lec" href="#lecture/${esc(l.id)}">${inner}</a>`;
      }).join('')}</div>` : empty('مفيش محاضرات في الكورس ده لسه.')}`;
  }

  // ---------- مشاهدة محاضرة (مع العلامة المائية) ----------
  async function viewLecture(id) {
    const { lecture: l } = await api(`/me/lectures/${encodeURIComponent(id)}`);
    view.innerHTML = `
      <p><a href="#course/${esc(l.courseId)}">رجوع لـ ${esc(l.courseTitle)}</a></p>
      <h2 style="margin-bottom:1rem">${esc(l.title)}</h2>
      <div class="player" id="player">
        <iframe src="${esc(l.embedUrl)}" title="${esc(l.title)}" allow="accelerometer; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>
        <div class="wm" id="wm"></div>
      </div>
      <div class="row" style="margin:.75rem 0"><button class="btn sm ghost" id="fs" type="button">ملء الشاشة</button></div>
      ${l.description ? `<div class="card"><p style="margin:0">${nl2br(l.description)}</p></div>` : ''}`;
    const wm = $('#wm');
    wm.textContent = `${user.name} • ${user.phone}`;
    const move = () => { wm.style.top = `${8 + Math.random() * 78}%`; wm.style.insetInlineStart = `${4 + Math.random() * 55}%`; };
    move();
    const t = setInterval(move, 6000);
    cleanup = () => clearInterval(t);
    // ملء الشاشة بتاعنا (مش بتاع يوتيوب) عشان العلامة المائية تفضل ظاهرة
    $('#fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : $('#player').requestFullscreen?.());
  }

  // ---------- واجباتي ----------
  async function viewHomework() {
    const { items } = await api('/me/homework');
    const now = Date.now();
    view.innerHTML = items.length ? `<div class="stack">${items.map((h) => {
      const late = h.dueDate && new Date(h.dueDate).getTime() < now;
      return `<article class="card"><div class="row"><h3 class="grow">${esc(h.title)}</h3>
          ${h.dueDate ? `<span class="badge ${late ? 'off' : 'gold'}">${late ? 'انتهى الميعاد' : 'آخر ميعاد'} ${esc(fmtDate(h.dueDate))}</span>` : ''}</div>
        <p class="muted small">${esc(h.course?.title)} • ${esc(h.teacher?.name)}${h.lecture ? ` • ${esc(h.lecture.title)}` : ''}</p>
        ${h.description ? `<p>${nl2br(h.description)}</p>` : ''}
        ${h.fileUrl ? `<a class="btn sm" href="${esc(h.fileUrl)}" target="_blank" rel="noopener noreferrer">فتح ملف الواجب</a>` : ''}</article>`;
    }).join('')}</div>` : empty('مفيش واجبات دلوقتي. الواجبات بتظهر هنا لما تشترك في باقة.');
  }

  // ---------- اشتراكاتي ----------
  async function viewPackages() {
    const [subs, pk] = await Promise.all([api('/me/subscriptions'), api('/me/packages')]);
    view.innerHTML = `
      <h2 class="section-title">اشتراكاتي</h2>
      ${subs.items.length ? `<div class="table-wrap"><table><thead><tr><th>الباقة</th><th>المدرس</th><th>بدأت</th><th>بتنتهي</th><th>الحالة</th></tr></thead><tbody>
        ${subs.items.map((s) => `<tr><td>${esc(s.package?.title)}</td><td>${esc(s.teacher?.name)}</td><td>${esc(fmtDate(s.startsAt))}</td>
          <td>${s.expiresAt ? esc(fmtDate(s.expiresAt)) : 'بدون انتهاء'}</td><td>${s.active ? '<span class="badge ok">فعّال</span>' : '<span class="badge off">منتهي</span>'}</td></tr>`).join('')}
        </tbody></table></div>` : empty('مفيش اشتراكات لسه.')}
      <h2 class="section-title" style="margin-top:2rem">باقات سنتك</h2>
      ${pk.items.length ? `<div class="grid">${pk.items.map((p) => `
        <article class="card pkg"><h3>${esc(p.title)}</h3><p class="muted">${esc(p.teacher.name)} • ${esc(p.teacher.subject)}</p>
          <div class="price">${Number(p.price).toLocaleString('en-US')} <small>جنيه</small></div>
          ${p.description ? `<p class="muted">${esc(p.description)}</p>` : ''}
          <div style="margin-top:auto">${p.owned ? '<span class="badge ok">مشترك</span>' : `<a class="btn block" href="/${esc(p.teacher.slug)}">تفاصيل واشتراك</a>`}</div></article>`).join('')}</div>`
        : empty('مفيش باقات متاحة لسنتك لسه.')}`;
  }

  // ---------- حسابي ----------
  async function viewAccount() {
    view.innerHTML = `
      <div class="card"><dl class="kv"><dt>الاسم</dt><dd>${esc(user.name)}</dd><dt>الموبايل</dt><dd class="ltr">${esc(user.phone)}</dd>
        <dt>ولي الأمر</dt><dd class="ltr">${esc(user.parentPhone || '—')}</dd><dt>السنة</dt><dd>${esc(gradeLabel(user.grade))}</dd></dl></div>
      <h2 class="section-title" style="margin-top:2rem">تغيير كلمة السر</h2>
      <form class="card" id="pwForm" style="max-width:420px">
        <label class="field"><span>كلمة السر الحالية</span><input type="password" name="current" autocomplete="current-password" required></label>
        <label class="field"><span>كلمة السر الجديدة</span><input type="password" name="password" autocomplete="new-password" minlength="8" required></label>
        <label class="field"><span>تأكيد كلمة السر الجديدة</span><input type="password" name="confirm" autocomplete="new-password" required></label>
        <div class="form-error" id="pwErr" role="alert"></div>
        <button class="btn" type="submit">حفظ</button>
      </form>
      <h2 class="section-title" style="margin-top:2rem">الأجهزة</h2>
      <div class="card"><p class="muted">لو حاسس إن حد تاني دخل على حسابك، اخرج من كل الأجهزة وغيّر كلمة السر.</p>
        <button class="btn danger" id="logoutAll" type="button">تسجيل الخروج من كل الأجهزة</button></div>`;
    $('#pwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target; $('#pwErr').textContent = '';
      if (f.password.value !== f.confirm.value) { $('#pwErr').textContent = 'كلمتي السر الجديدتين مش متطابقتين'; return; }
      try { await api('/auth/change-password', { method: 'POST', body: { current: f.current.value, password: f.password.value } }); f.reset(); toast('تم تغيير كلمة السر'); }
      catch (err) { $('#pwErr').textContent = err.message; }
    });
    $('#logoutAll').onclick = async () => {
      if (!confirm('هتخرج من كل الأجهزة. متأكد؟')) return;
      try { await api('/auth/logout-all', { method: 'POST' }); } catch (_) { /* ignore */ }
      location.href = '/login';
    };
  }

  const routes = {
    courses: ['محاضراتي', viewCourses], course: ['الكورس', viewCourse], lecture: ['المحاضرة', viewLecture],
    homework: ['واجباتي', viewHomework], packages: ['اشتراكاتي', viewPackages], account: ['حسابي', viewAccount],
  };
  async function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    const [name, arg] = location.hash.slice(1).split('/');
    const [title, fn] = routes[name] || routes.courses;
    const top = ['course', 'lecture'].includes(name) ? 'courses' : (routes[name] ? name : 'courses');
    $$('#menu a').forEach((a) => (a.dataset.k === top ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    $('#side').classList.remove('open');
    $('#pageTitle').textContent = title;
    view.innerHTML = '<p class="muted">جاري التحميل…</p>';
    try { await fn(arg); }
    catch (e) {
      if (e.status === 401) { location.replace('/login?next=/student'); return; }
      view.innerHTML = `<div class="empty">${esc(e.message)}${e.code === 'NO_SUBSCRIPTION' ? '<br><a href="#packages">شوف الباقات</a>' : ''}</div>`;
    }
  }
  window.addEventListener('hashchange', route);
  route();
})();
