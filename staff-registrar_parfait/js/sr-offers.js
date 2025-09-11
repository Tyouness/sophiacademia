/* Staff Registrar – front-end “offers” (v1.3.3) */
console.log('SR-OFFERS LOADED');

(function ($) {
  if (!window.srOffers || !$('#sr-offers-app').length) return;

  /* 🧑‍🎓 Emojis + libellés ------------------------------------------ */
  const GENDER = {
    garçon : { e: '♂️', label: 'Garçon' },
    garcon : { e: '♂️', label: 'Garçon' },
    fille  : { e: '♀️', label: 'Fille'  },
    'fille ':{ e: '♀️', label: 'Fille'  }
  };
  const PER_IC = { semaine: 'SE', we: 'WE', weekend: 'WE', vacances: 'VA' };

  /* ---------- templates ------------------------------------------- */
  const tplCard = (o, i) => `
    <div class="sr-offer-card" data-i="${i}">
      <div class="sr-offer-header">
        <h3>${(o.city || '').toUpperCase()}</h3>
        <span class="sr-distance">${o.dist} ${window.srDistance}</span>
      </div>
      <p class="sr-subject">📚 ${o.subject || ''}</p>
      <p class="sr-level">${o.level || ''} ${
        GENDER[(o.gender || '').trim().toLowerCase()]
          ? GENDER[(o.gender || '').trim().toLowerCase()].e + ' ' +
            GENDER[(o.gender || '').trim().toLowerCase()].label
          : ''
      }</p>
      <p class="sr-extra">🔁 ${o.freq || ''}  🕒 ${o.duration || ''}</p>
      <p class="sr-period">${
        (o.period || '')
          .split(',')
          .map(p => PER_IC[p.trim().toLowerCase()] || '')
          .filter(Boolean)
          .map(t => `<span class="badge">${t}</span>`)
          .join(' ')
      }</p>
      <button class="sr-consult">CONSULTER</button>
    </div>`;

  const tplOverlay = o => `
    <div class="sr-offer-detail">
      <button class="sr-close">← RETOUR</button>
      <h2>${(o.city || o.name).toUpperCase()} – ${o.dist} ${window.srDistance}</h2>
      <p><strong>📚 ${o.subject || ''}</strong></p>
      <p>Niveau : ${o.level || ''} ${
        GENDER[(o.gender || '').trim().toLowerCase()]
          ? GENDER[(o.gender || '').trim().toLowerCase()].e + ' ' +
            GENDER[(o.gender || '').trim().toLowerCase()].label
          : ''
      }</p>
      <p>🔁 ${o.freq || ''} – 🕒 ${o.duration || ''}</p>
      <p>Périodes : ${(o.period || '').split(',').join(', ')}</p>
      <p>À partir du : ${o.start || ''}</p>
      <div id="sr-detail-map" style="height:250px;margin:12px 0;"></div>
      <button class="sr-option">METTRE UNE OPTION</button>
    </div>`;

  /* ---------- rendu liste + carte --------------------------------- */
  const $list = $('#sr-offers-list');
  window.srOffers.forEach((o, i) => $list.append(tplCard(o, i)));

  const map = L.map('sr-offers-map').setView(window.srCenter, 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
              { attribution: '© OpenStreetMap' }).addTo(map);

  window.srOffers.forEach((o, i) => {
    L.marker([o.lat, o.lng]).addTo(map)
      .bindPopup(`<strong>${o.name}</strong><br>${o.dist} ${window.srDistance}`)
      .on('click', () => scrollToCard(i));
  });

  function scrollToCard(i) {
    const $c = $list.find(`[data-i="${i}"]`);
    if ($c.length) {
      $c[0].scrollIntoView({ behavior: 'smooth' });
      $c.addClass('sr-active').delay(1000).queue(() => {
        $c.removeClass('sr-active').dequeue();
      });
    }
  }

  /* ---------- overlay --------------------------------------------- */
  const $ov = $('<div id="sr-offer-overlay"></div>').appendTo('body');

  $list.on('click', '.sr-consult', function () {
    const i = $(this).closest('.sr-offer-card').data('i'),
          d = window.srOffers[i];

    $ov.html(tplOverlay(d)).fadeIn(150);

    const m2 = L.map('sr-detail-map', { zoomControl: false,
                                        attributionControl: false })
                .setView([d.lat, d.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m2);
    L.marker([d.lat, d.lng]).addTo(m2);

    $ov.data('fam', d.id);
  });

  $ov.on('click', '.sr-close', () => { $ov.fadeOut(150); });

  /* ---------- bouton “Mettre une option” --------------------------- */
  $ov.on('click', '.sr-option', function () {
    const $btn = $(this).prop('disabled', true).text('Envoi…');

    $.post(sr_front.ajax_url, {
      action   : 'sr_send_request',
      family_id: $ov.data('fam'),
      prof_id  : sr_front.prof_id,
      nonce    : sr_front.nonce
    })
    .done(res => {
      if (res.success) {
        $btn
          .text('OPTION ENVOYÉE')
          .addClass('sr-btn-disabled')
          .prop('disabled', true);
        alert('Option enregistrée ✅');
      } else {    /* déjà optionné ou autre message serveur */
        $btn
          .text('OPTION ENVOYÉE')
          .addClass('sr-btn-disabled')
          .prop('disabled', true);
        alert(res.data);
      }
    })
    .fail(() => {
      $btn.prop('disabled', false).text('METTRE UNE OPTION');
      alert('Erreur réseau, réessayez.');
    });
  });

})(jQuery);
