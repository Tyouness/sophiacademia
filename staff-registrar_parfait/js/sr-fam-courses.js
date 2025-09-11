/* Staff Registrar – Famille : “Mes cours particuliers” */
console.log('SR-FAM-COURSES LOADED');

jQuery(async function ($) {

  const $root = $('#sr-fam-courses-app');
  if (!$root.length) return;

  /* appel AJAX ------------------------------------------------------ */
  const res = await $.post(sr_fam_vars.ajax_url, {
    action : 'sr_get_family_courses',
    fam_id : sr_fam_vars.fam_id,
    nonce  : sr_fam_vars.nonce
  });

  if (!res.success) {
    $root.html('<p>Erreur de chargement.</p>');
    return;
  }
  const rows = res.data;
  if (!rows.length) {
    $root.html('<p>Aucun cours enregistré.</p>');
    return;
  }

  /* rendu simple ---------------------------------------------------- */
  let html = '<table class="sr-fam-table"><thead><tr>' +
             '<th>Date</th><th>Professeur</th><th>Statut</th></tr></thead><tbody>';
  rows.forEach(r => {
    html += `<tr><td>${r.date}</td><td>${r.prof}</td><td>${r.status}</td></tr>`;
  });
  html += '</tbody></table>';
  $root.html(html);
});
