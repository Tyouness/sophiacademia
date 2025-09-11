/* Staff Registrar – script admin (v2.0.0) */
console.log('SR-AJAX LOADED v2.0.0');

jQuery(function ($) {

  // Variables globales corrigées
  const vars = window.srAdmin || {};
  if (!vars.ajaxUrl) {
    console.error('srAdmin not properly localized');
    return;
  }

  // Utilitaires
  const utils = {
    showError: function(message) {
      alert('Erreur : ' + message);
    },
    
    showSuccess: function(message) {
      alert(message + ' ✅');
      location.reload();
    },
    
    validatePostcode: function(cp) {
      return /^\d{5}$/.test(cp.trim());
    }
  };

  /* ---------- ouvrir modale + charger metas ------------------------- */
  $('#sr-users-table').on('click', '.sr-edit', function () {
    const userId = $(this).closest('tr').data('user');
    if (!userId) {
      utils.showError('ID utilisateur manquant');
      return;
    }

    // Loading state
    const $modal = $('#sr-modal');
    $modal.find('.sr-modal-content').addClass('sr-loading');

    $.post(vars.ajaxUrl, {
      action: 'sr_get_user_meta',
      user_id: userId,
      _wpnonce: vars.nonce
    })
    .done(res => {
      if (!res.success) { 
        utils.showError(res.data || 'Erreur de chargement');
        return; 
      }

      const d = res.data || {};
      const f = $('#sr-edit-form');

      // Champs simples
      ['sr_addr1','sr_addr2','sr_postcode','sr_city','sr_country',
       'sr_subject','sr_level','sr_gender','sr_freq','sr_duration','sr_start']
        .forEach(k => {
          const $field = f.find(`[name="${k}"]`);
          if ($field.length) {
            $field.val(d[k] || '');
          }
        });

      // Téléphones (famille ET professeur)
      f.find('[name="sr_rep_phone"]').val(d.sr_rep_phone || '');
      f.find('[name="sr_prof_phone"]').val(d.sr_prof_phone || '');

      // Périodes : coche checkboxes
      f.find('[name="sr_period[]"]').prop('checked', false);
      if (d.sr_period) {
        const periods = typeof d.sr_period === 'string' 
          ? d.sr_period.split(',') 
          : [d.sr_period];
        
        periods.forEach(p => {
          const trimmed = p.trim();
          f.find(`[name="sr_period[]"][value="${trimmed}"]`).prop('checked', true);
        });
      }

      f.find('[name="user_id"]').val(userId);
      $modal.find('.sr-modal-content').removeClass('sr-loading');
      $modal.show();
    })
    .fail(xhr => {
      utils.showError(`Erreur AJAX ${xhr.status}`);
      $modal.find('.sr-modal-content').removeClass('sr-loading');
    });
  });

  /* ---------- fermer modale ---------------------------------------- */
  $('.sr-close, #sr-modal-backdrop').on('click', e => {
    e.preventDefault();
    $('#sr-modal').hide();
  });

  // Fermer avec Échap
  $(document).on('keydown', e => {
    if (e.key === 'Escape' && $('#sr-modal').is(':visible')) {
      $('#sr-modal').hide();
    }
  });

  /* ---------- géocode CP → Ville (nouveau système) --------------- */
  $('.sr-geocode').on('click', e => {
    e.preventDefault();
    
    const $btn = $(e.target).prop('disabled', true).text('Géocodage...');
    const cp = $('#sr-edit-form [name="sr_postcode"]').val().trim();
    const city = $('#sr-edit-form [name="sr_city"]').val().trim();
    
    if (!utils.validatePostcode(cp)) { 
      utils.showError('Code postal français invalide (5 chiffres)');
      $btn.prop('disabled', false).text('CP→Ville');
      return; 
    }

    // Utiliser le nouveau système multi-API
    $.post(vars.ajaxUrl, {
      action: 'sr_test_geocoding',
      postcode: cp,
      city: city,
      nonce: vars.nonce
    })
    .done(res => {
      if (res.success && res.data && res.data.result) {
        const result = res.data.result;
        
        // Mise à jour des champs
        if (result.city) {
          $('#sr-edit-form [name="sr_city"]').val(result.city);
        }
        
        // Feedback utilisateur
        const source = result.source || 'API';
        alert(`Ville trouvée via ${source} : ${result.city || cp}`);
        
      } else {
        utils.showError('Ville introuvable pour ce code postal');
      }
    })
    .fail(xhr => {
      utils.showError(`Erreur de géocodage (${xhr.status})`);
    })
    .always(() => {
      $btn.prop('disabled', false).text('CP→Ville');
    });
  });

  /* ---------- sauvegarde avec validation renforcée --------------- */
  $('#sr-edit-form').on('submit', function(e) {
    e.preventDefault();
    
    const $form = $(this);
    const $submitBtn = $form.find('[type="submit"]')
      .prop('disabled', true)
      .text('Enregistrement...');

    // Validation côté client
    const postcode = $form.find('[name="sr_postcode"]').val().trim();
    if (postcode && !utils.validatePostcode(postcode)) {
      utils.showError('Code postal invalide');
      $submitBtn.prop('disabled', false).text('Enregistrer');
      return;
    }

    // Sérialisation améliorée
    const data = $form.serializeArray().reduce((obj, item) => {
      if (item.name === 'sr_period[]') {
        (obj['sr_period'] = obj['sr_period'] || []).push(item.value);
      } else {
        obj[item.name] = item.value;
      }
      return obj;
    }, {});

    data.action = 'sr_save_user';

    $.post(vars.ajaxUrl, data)
      .done(res => {
        if (res.success) {
          const updateInfo = res.data || {};
          let message = 'Enregistré';
          
          if (updateInfo.geocoded) {
            message += ' et géolocalisé';
          }
          if (updateInfo.updated_fields) {
            message += ` (${updateInfo.updated_fields} champs modifiés)`;
          }
          
          utils.showSuccess(message);
        } else {
          utils.showError(res.data || 'Erreur de sauvegarde');
          $submitBtn.prop('disabled', false).text('Enregistrer');
        }
      })
      .fail(xhr => {
        utils.showError(`AJAX ${xhr.status}`);
        $submitBtn.prop('disabled', false).text('Enregistrer');
      });
  });

  /* ---------- Validation en temps réel --------------------------- */
  $('#sr-edit-form [name="sr_postcode"]').on('input', function() {
    const $field = $(this);
    const value = $field.val().trim();
    
    if (value && !utils.validatePostcode(value)) {
      $field.addClass('sr-invalid');
    } else {
      $field.removeClass('sr-invalid');
    }
  });

  // Auto-formatage du téléphone français
  $('#sr-edit-form [name$="_phone"]').on('input', function() {
    let value = $(this).val().replace(/\D/g, '');
    
    // Format français : 01 23 45 67 89
    if (value.length === 10 && value.startsWith('0')) {
      value = value.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
      $(this).val(value);
    }
  });

  /* ---------- Initialisation ------------------------------------ */
  console.log('SR-AJAX initialized with', Object.keys(vars).length, 'config vars');
});