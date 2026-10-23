(async () => {
  await loadMeta();
  setTitle('');
  renderNav($('#nav'));
  const box = $('#teachers');
  try {
    const { items } = await api('/public/teachers');
    if (!items.length) { box.innerHTML = '<div class="empty">المدرسين هيظهروا هنا قريباً.</div>'; return; }
    box.innerHTML = items.map((t) => `
      <a class="card teacher-card" href="/${esc(t.slug)}">
        <div class="avatar">${t.photoUrl ? `<img src="${esc(t.photoUrl)}" alt="" loading="lazy">` : esc(initial(t.name))}</div>
        <div>
          <h3>${esc(t.name)}</h3>
          <p class="muted">${esc(t.subject)}</p>
          <div class="chips">${(t.grades || []).map((g) => `<span class="badge">${esc(gradeLabel(g))}</span>`).join('')}</div>
        </div>
      </a>`).join('');
  } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
})();
