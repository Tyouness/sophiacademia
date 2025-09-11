/* Staff Registrar – front-end "offers" (v2.0.0) */
console.log('SR-OFFERS LOADED v2.0.0');

(function ($) {
  'use strict';

  // Vérifications initiales
  if (!window.srOffers || !$('#sr-offers-app').length) {
    console.warn('SR-OFFERS: Missing data or container');
    return;
  }

  if (!window.sr_front || !window.sr_front.ajax_url) {
    console.error('SR-OFFERS: sr_front not properly localized');
    return;
  }

  /* 🧑‍🎓 Configuration et constantes ----------------------------- */
  const GENDER = {
    'garçon': { e: '♂️', label: 'Garçon' },
    'garcon': { e: '♂️', label: 'Garçon' },
    'fille': { e: '♀️', label: 'Fille' },
    'fille ': { e: '♀️', label: 'Fille' }
  };
  
  const PER_IC = { 
    'semaine': 'SE', 
    'we': 'WE', 
    'weekend': 'WE', 
    'vacances': 'VA' 
  };

  const RATE_LIMIT = {
    lastRequest: 0,
    minDelay: 500 // 500ms entre requêtes
  };

  /* ---------- Utilitaires ---------------------------------------- */
  const utils = {
    formatGender: function(gender) {
      const g = GENDER[(gender || '').trim().toLowerCase()];
      return g ? `${g.e} ${g.label}` : '';
    },
    
    formatPeriods: function(period) {
      return (period || '')
        .split(',')
        .map(p => PER_IC[p.trim().toLowerCase()] || '')
        .filter(Boolean)
        .map(t => `<span class="badge">${t}</span>`)
        .join(' ');
    },
    
    checkRateLimit: function() {
      const now = Date.now();
      if (now - RATE_LIMIT.lastRequest < RATE_LIMIT.minDelay) {
        return false;
      }
      RATE_LIMIT.lastRequest = now;
      return true;
    },
    
    sanitizeHtml: function(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
    
    showNotification: function(message, type = 'info') {
      // Utiliser Toastify si disponible, sinon alert
      if (typeof Toastify !== 'undefined') {
        Toastify({
          text: message,
          duration: 3000,
          close: true,
          gravity: "top",
          position: "right",
          className: `sr-toast-${type}`
        }).showToast();
      } else {
        alert(message);
      }
    }
  };

  /* ---------- Templates avec échappement HTML ----------------- */
  const tplCard = (o, i) => `
    <div class="sr-offer-card" data-i="${i}" role="article" tabindex="0">
      <div class="sr-offer-header">
        <h3>${utils.sanitizeHtml(o.city || '').toUpperCase()}</h3>
        <span class="sr-distance">${o.dist} ${window.srDistance || 'km'}</span>
      </div>
      <div class="sr-offer-content">
        <p class="sr-subject">📚 ${utils.sanitizeHtml(o.subject || '')}</p>
        <p class="sr-level">${utils.sanitizeHtml(o.level || '')} ${utils.formatGender(o.gender)}</p>
        <p class="sr-extra">🔁 ${utils.sanitizeHtml(o.freq || '')} 🕒 ${utils.sanitizeHtml(o.duration || '')}</p>
        <div class="sr-period">${utils.formatPeriods(o.period)}</div>
      </div>
      <div class="sr-offer-actions">
        <button class="sr-consult button" aria-label="Consulter l'offre de ${utils.sanitizeHtml(o.city || '')}">
          CONSULTER
        </button>
      </div>
    </div>`;

  const tplOverlay = o => `
    <div class="sr-offer-detail" role="dialog" aria-labelledby="sr-detail-title">
      <div class="sr-detail-header">
        <button class="sr-close" aria-label="Fermer">&times;</button>
        <h2 id="sr-detail-title">${utils.sanitizeHtml((o.city || o.name || '').toUpperCase())} – ${o.dist} ${window.srDistance || 'km'}</h2>
      </div>
      
      <div class="sr-detail-content">
        <div class="sr-detail-info">
          <p><strong>📚 ${utils.sanitizeHtml(o.subject || '')}</strong></p>
          <p>Niveau : ${utils.sanitizeHtml(o.level || '')} ${utils.formatGender(o.gender)}</p>
          <p>🔁 ${utils.sanitizeHtml(o.freq || '')} – 🕒 ${utils.sanitizeHtml(o.duration || '')}</p>
          <p>Périodes : ${utils.sanitizeHtml((o.period || '').split(',').join(', '))}</p>
          ${o.start ? `<p>À partir du : ${utils.sanitizeHtml(o.start)}</p>` : ''}
        </div>
        
        <div id="sr-detail-map" class="sr-detail-map" style="height:250px;margin:20px 0;" aria-label="Carte de localisation"></div>
        
        <div class="sr-detail-actions">
          <button class="sr-option button button-primary">
            METTRE UNE OPTION
          </button>
        </div>
      </div>
    </div>`;

  /* ---------- Rendu initial ------------------------------------ */
  const $list = $('#sr-offers-list');
  const $map = $('#sr-offers-map');
  
  // Vérification que Leaflet est chargé
  if (typeof L === 'undefined') {
    console.error('SR-OFFERS: Leaflet not loaded');
    $('#sr-offers-app').html('<div class="sr-error">Erreur : Leaflet non chargé</div>');
    return;
  }

  // Rendu des cartes d'offres
  window.srOffers.forEach((o, i) => {
    $list.append(tplCard(o, i));
  });

  // Initialisation de la carte principale
  let map;
  try {
    map = L.map('sr-offers-map').setView(window.srCenter || [46.603354, 1.888334], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18
    }).addTo(map);

    // Ajout des marqueurs avec gestion d'erreurs
    window.srOffers.forEach((o, i) => {
      if (o.lat && o.lng && !isNaN(o.lat) && !isNaN(o.lng)) {
        L.marker([o.lat, o.lng])
          .addTo(map)
          .bindPopup(`<strong>${utils.sanitizeHtml(o.name || o.city || '')}</strong><br>${o.dist} ${window.srDistance || 'km'}`)
          .on('click', () => scrollToCard(i));
      }
    });
  } catch (error) {
    console.error('SR-OFFERS: Map initialization failed', error);
    $map.html('<div class="sr-map-error">Erreur de chargement de la carte</div>');
  }

  function scrollToCard(i) {
    const $card = $list.find(`[data-i="${i}"]`);
    if ($card.length) {
      $card[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      $card.addClass('sr-active');
      setTimeout(() => $card.removeClass('sr-active'), 2000);
    }
  }

  /* ---------- Gestion overlay avec accessibilité -------------- */
  const $overlay = $('<div id="sr-offer-overlay" class="sr-overlay" aria-hidden="true"></div>')
    .appendTo('body');

  $list.on('click', '.sr-consult', function () {
    const i = $(this).closest('.sr-offer-card').data('i');
    const offer = window.srOffers[i];
    
    if (!offer) {
      utils.showNotification('Offre non trouvée', 'error');
      return;
    }

    $overlay.html(tplOverlay(offer))
      .attr('aria-hidden', 'false')
      .fadeIn(150, function() {
        // Focus management pour l'accessibilité
        $overlay.find('.sr-close').focus();
      });

    // Initialisation carte détail
    setTimeout(() => initDetailMap(offer), 200);
    $overlay.data('family-id', offer.id);
  });

  function initDetailMap(offer) {
    if (!offer.lat || !offer.lng || isNaN(offer.lat) || isNaN(offer.lng)) {
      $('#sr-detail-map').html('<div class="sr-map-placeholder">Localisation non disponible</div>');
      return;
    }

    try {
      const detailMap = L.map('sr-detail-map', { 
        zoomControl: false,
        attributionControl: false 
      }).setView([offer.lat, offer.lng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMap);
      L.marker([offer.lat, offer.lng]).addTo(detailMap);

      // Lien vers itinéraire
      const address = encodeURIComponent(`${offer.city || ''}, France`);
      $('#sr-detail-map').after(`
        <p class="sr-itinerary">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${address}" 
             target="_blank" rel="noopener" class="button">
            📍 Itinéraire
          </a>
        </p>
      `);
    } catch (error) {
      console.error('SR-OFFERS: Detail map failed', error);
      $('#sr-detail-map').html('<div class="sr-map-error">Erreur de chargement de la carte détaillée</div>');
    }
  }

  // Fermeture overlay
  $overlay.on('click', '.sr-close', closeOverlay);
  $overlay.on('click', function(e) {
    if (e.target === this) closeOverlay();
  });

  $(document).on('keydown', function(e) {
    if (e.key === 'Escape' && $overlay.is(':visible')) {
      closeOverlay();
    }
  });

  function closeOverlay() {
    $overlay.fadeOut(150).attr('aria-hidden', 'true');
    // Retour focus sur le bouton qui a ouvert l'overlay
    $list.find('.sr-consult').first().focus();
  }

  /* ---------- Bouton "Mettre une option" avec rate limiting ---- */
  $overlay.on('click', '.sr-option', function () {
    const $btn = $(this);
    
    if ($btn.prop('disabled')) {
      return;
    }

    if (!utils.checkRateLimit()) {
      utils.showNotification('Veuillez patienter avant de refaire une demande', 'warning');
      return;
    }

    const familyId = $overlay.data('family-id');
    if (!familyId) {
      utils.showNotification('Erreur : ID famille manquant', 'error');
      return;
    }

    $btn.prop('disabled', true)
        .text('Envoi en cours...')
        .addClass('sr-loading');

    $.post(window.sr_front.ajax_url, {
      action: 'sr_send_request',
      family_id: familyId,
      prof_id: window.sr_front.prof_id,
      nonce: window.sr_front.nonce
    })
    .done(res => {
      if (res.success) {
        $btn.text('OPTION ENVOYÉE ✓')
            .removeClass('sr-loading')
            .addClass('sr-success');
        
        utils.showNotification('Option enregistrée avec succès !', 'success');
        
        // Retirer l'offre de la liste après 2 secondes
        setTimeout(() => {
          const $card = $list.find(`[data-i]:has(.sr-consult)`).filter(function() {
            return window.srOffers[$(this).data('i')]?.id === familyId;
          });
          $card.fadeOut(300, function() { $(this).remove(); });
          closeOverlay();
        }, 2000);
        
      } else {
        const errorMsg = res.data || 'Erreur lors de l\'envoi de l\'option';
        utils.showNotification(errorMsg, 'error');
        
        $btn.text('OPTION ENVOYÉE')
            .removeClass('sr-loading')
            .addClass('sr-disabled');
      }
    })
    .fail(xhr => {
      console.error('SR-OFFERS: Request failed', xhr);
      utils.showNotification(`Erreur réseau (${xhr.status}). Veuillez réessayer.`, 'error');
      
      $btn.prop('disabled', false)
          .text('METTRE UNE OPTION')
          .removeClass('sr-loading');
    });
  });

  /* ---------- Navigation clavier ---------------------------- */
  $list.on('keydown', '.sr-offer-card', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $(this).find('.sr-consult').click();
    }
  });

  /* ---------- Filtrage dynamique (optionnel) --------------- */
  window.srOffersFilter = {
    bySubject: function(subject) {
      $list.find('.sr-offer-card').each(function() {
        const cardSubject = $(this).find('.sr-subject').text().toLowerCase();
        const match = !subject || cardSubject.includes(subject.toLowerCase());
        $(this).toggle(match);
      });
    },
    
    byDistance: function(maxDistance) {
      $list.find('.sr-offer-card').each(function() {
        const distance = parseFloat($(this).find('.sr-distance').text());
        $(this).toggle(isNaN(distance) || distance <= maxDistance);
      });
    },
    
    reset: function() {
      $list.find('.sr-offer-card').show();
    }
  };

  console.log(`SR-OFFERS initialized: ${window.srOffers.length} offers loaded`);

})(jQuery);