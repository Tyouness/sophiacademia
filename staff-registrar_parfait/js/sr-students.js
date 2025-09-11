/* Staff Registrar – “Mes élèves” */
console.log('SR-STUDENTS LOADED');

jQuery(async function($){

  if(!$('#sr-students-app').length) return;

  /* ——— liste élèves ——— */
  const res = await $.post(sr_students_vars.ajax_url,{
      action : 'sr_get_students',
      nonce  : sr_students_vars.nonce,
      prof_id: sr_students_vars.prof_id
  });
  if(!res.success){ $('#sr-students-app').html('<p>Erreur AJAX.</p>'); return; }

  const students = res.data;
  const $app = $('#sr-students-app').empty();

  students.forEach((s,i)=>{
    $app.append(`<div class="sr-st-card" data-i="${i}">
      <h3>${s.name}</h3>
      <p>${s.class||''} • ${s.subject||''}</p>
      <button class="sr-open button">Voir détail</button>
    </div>`);
  });

  /* ——— overlay ——— */
  const $ov = $('<div id="sr-st-overlay"></div>').appendTo('body');

  $app.on('click','.sr-open',function(){
    const s = students[$(this).closest('.sr-st-card').data('i')];

    $ov.html(`<div class="sr-st-detail">
      <button class="sr-close">← retour</button>
      <h2>${s.name}</h2>
      <p>Classe : ${s.class||''}</p>
      <p>Matière : ${s.subject||''}</p>
      <p>Fréquence : ${s.freq||''} • Durée : ${s.duration||''}</p>
      <p>État du cours : ${s.status}</p>
      <p>Adresse : ${s.address}</p>
      <p><a class="button" target="_blank"
            href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}">Itinéraire</a></p>
      <p>Téléphone : <a href="tel:${s.phone}">${s.phone||'?'}</a></p>

      <h3>Déclarer des heures</h3>
      <input type="number" min="0.5" step="0.5" id="sr-hours" placeholder="Nb heures">
      <button class="sr-declare button button-primary">Déclarer</button>

      <h3>Synthèse des heures</h3>
      <ul id="sr-synth"><li>Chargement…</li></ul>
    </div>`).fadeIn(150);

    loadSynth();

    /* déclarer */
    $ov.off('click','.sr-declare').on('click','.sr-declare',async function(){
      const h = parseFloat($('#sr-hours').val()||0);
      if(h<=0){ alert('Saisir un nombre >0'); return; }
      const r = await $.post(sr_students_vars.ajax_url,{
        action:'sr_declare_hours',nonce:sr_students_vars.nonce,
        prof_id:sr_students_vars.prof_id,family_id:s.family_id,hours:h
      });
      if(r.success){ alert('Déclaré ✅'); $('#sr-hours').val(''); loadSynth(); }
      else alert('Erreur : '+r.data);
    });

    async function loadSynth(){
      const syn = await $.post(sr_students_vars.ajax_url,{
        action:'sr_hours_summary',nonce:sr_students_vars.nonce,
        prof_id:sr_students_vars.prof_id,family_id:s.family_id
      });
      if(!syn.success) return;
      $('#sr-synth').html(`
        <li>Heures réglées : ${syn.data.paid}</li>
        <li>Réglées d’avance : ${syn.data.advance}</li>
        <li>En attente : ${syn.data.pending}</li>
      `);
    }
  });

  $ov.on('click','.sr-close',()=>{$ov.fadeOut(150);});
});
