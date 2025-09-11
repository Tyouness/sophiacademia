/* Staff Registrar – script admin (v1.3.2) */
console.log('SR-AJAX LOADED');

jQuery(function ($) {

  /* ---------- ouvrir modale + charger métas ------------------------- */
  $('#sr-users-table').on('click', '.sr-edit', function () {

    const userId = $(this).closest('tr').data('user');

    $.post(sr_vars.ajax_url, {
      action : 'sr_get_user_meta',
      user_id: userId,
      _wpnonce: sr_vars.sr_nonce
    }).done(res => {

      if (!res.success) { alert(res.data); return; }

      const d = res.data;
      const f = $('#sr-edit-form');

      /* champ simple */
      ['sr_addr1','sr_addr2','sr_postcode','sr_city','sr_country',
       'sr_subject','sr_level','sr_gender','sr_freq','sr_duration','sr_start']
        .forEach(k => f.find(`[name="${k}"]`).val(d[k]||''));

      /* périodes : coche check-box */
      f.find('[name="sr_period[]"]').prop('checked',false);
      if (d.sr_period){
        d.sr_period.split(',').forEach(p=>{
          f.find(`[name="sr_period[]"][value="${p.trim()}"]`).prop('checked',true);
        });
      }

      f.find('[name="user_id"]').val(userId);
      $('#sr-modal').show();
    });
  });

  /* ---------- fermer modale ---------------------------------------- */
  $('.sr-close').on('click', e => { e.preventDefault(); $('#sr-modal').hide(); });

  /* ---------- géocode CP → Ville ----------------------------------- */
  $('.sr-geocode').on('click', e => {

    e.preventDefault();
    const cp = $('#sr-edit-form [name="sr_postcode"]').val().trim();
    if (!/^\d{5}$/.test(cp)) { alert('Code postal invalide'); return; }

    const url = 'https://maps.googleapis.com/maps/api/geocode/json?address='+
                cp+',France&key='+sr_vars.geocode_key;

    fetch(url).then(r=>r.json()).then(j=>{
      const comp = (j.results && j.results[0]) ? j.results[0].address_components : [];
      let city = '';
      comp.forEach(c=>{
        if (c.types && (c.types.includes('locality') || c.types.includes('postal_town'))) {
          city = c.long_name;
        }
      });
      city ? $('#sr-edit-form [name="sr_city"]').val(city)
           : alert('Ville introuvable pour ce code postal');
    }).catch(()=>alert('Erreur API Google'));
  });

  /* ---------- sauvegarde ------------------------------------------- */
  $('#sr-edit-form').on('submit', function(e){

    e.preventDefault();
    const data = $(this).serializeArray().reduce((o,kv)=>{
      if(kv.name==='sr_period[]'){
        (o['sr_period']=o['sr_period']||[]).push(kv.value);
      }else{
        o[kv.name]=kv.value;
      }
      return o;
    },{});
    data.action = 'sr_save_user';

    $.post(sr_vars.ajax_url, data).done(res=>{
      res.success ? (alert('Enregistré ✅'), location.reload())
                  : alert('Erreur : '+res.data);
    }).fail(x=>alert('AJAX '+x.status));
  });
});