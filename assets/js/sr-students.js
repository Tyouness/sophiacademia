/* SR Students Management - v2.0.0 */
console.log('SR-STUDENTS LOADED v2.0.0');

jQuery(async function($) {
  'use strict';

  // Vérifications initiales
  if (!$('#sr-students-app').length) {
    console.warn('SR-STUDENTS: Container #sr-students-app not found');
    return;
  }

  if (!window.sr_students_vars || !window.sr_students_vars.ajax_url) {
    console.error('SR-STUDENTS: sr_students_vars not properly localized');
    $('#sr-students-app').html('<div class="sr-error">Configuration manquante</div>');
    return;
  }

  // Configuration
  const config = {
    maxHoursPerDeclaration: 10,
    minHoursPerDeclaration: 0.5,
    refreshInterval: 60000, // 1 minute
    retryAttempts: 3,
    retryDelay: 1000
  };

  // Utilitaires
  const utils = {
    formatPhone: function(phone) {
      if (!phone) return 'Non renseigné';
      // Format français
      return phone.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    },

    formatAddress: function(address) {
      return address || 'Adresse non disponible';
    },

    validateHours: function(hours) {
      const h = parseFloat(hours);
      return !isNaN(h) && h >= config.minHoursPerDeclaration && h <= config.maxHoursPerDeclaration;
    },

    showNotification: function(message, type = 'info') {
      if (typeof Toastify !== 'undefined') {
        Toastify({
          text: message,
          duration: type === 'error' ? 5000 : 3000,
          close: true,
          gravity: "top",
          position: "right",
          className: `sr-toast-${type}`,
          style: {
            background: type === 'error' ? '#dc3545' : 
                       type === 'success' ? '#28a745' : '#007bff'
          }
        }).showToast();
      } else {
        alert(`[${type.toUpperCase()}] ${message}`);
      }
    },

    sanitizeHtml: function(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    },

    retry: async function(fn, attempts = config.retryAttempts) {
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn();
        } catch (error) {
          if (i === attempts - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, config.retryDelay * (i + 1)));
        }
      }
    }
  };

  // Gestionnaire principal
  const StudentsManager = {
    students: [],
    currentStudent: null,
    refreshTimer: null,

    async init() {
      try {
        await this.loadStudents();
        this.render();
        this.bindEvents();
        this.startAutoRefresh();
        
        console.log(`SR-STUDENTS initialized with ${this.students.length} students`);
      } catch (error) {
        console.error('SR-STUDENTS: Initialization failed', error);
        this.showError('Erreur d\'initialisation');
      }
    },

    async loadStudents() {
      const $app = $('#sr-students-app');
      
      // Loading state
      $app.html(`
        <div class="sr-loading-state">
          <div class="sr-spinner"></div>
          <p>Chargement de vos élèves...</p>
        </div>
      `);

      try {
        const response = await utils.retry(() => 
          $.post(sr_students_vars.ajax_url, {
            action: 'sr_get_students',
            nonce: sr_students_vars.nonce,
            prof_id: sr_students_vars.prof_id
          })
        );

        if (!response.success) {
          throw new Error(response.data || 'Erreur de chargement');
        }

        this.students = response.data || [];
        
        if (this.students.length === 0) {
          $app.html(`
            <div class="sr-empty-state">
              <div class="sr-empty-icon">🎓</div>
              <h3>Aucun élève assigné</h3>
              <p>Vous n'avez pas encore d'élèves assignés. Les nouveaux élèves apparaîtront ici une fois les demandes approuvées.</p>
            </div>
          `);
          return;
        }

      } catch (error) {
        console.error('SR-STUDENTS: Load failed', error);
        throw error;
      }
    },

    render() {
      const $app = $('#sr-students-app');
      
      const headerHtml = `
        <div class="sr-students-header">
          <h2>Mes élèves (${this.students.length})</h2>
          <div class="sr-students-actions">
            <button class="sr-btn sr-btn-refresh" id="sr-refresh-students">
              🔄 Actualiser
            </button>
          </div>
        </div>
      `;

      const studentsGrid = this.students.map((student, index) => `
        <div class="sr-student-card" data-index="${index}">
          <div class="sr-student-avatar">
            ${student.name.substring(0, 2).toUpperCase()}
          </div>
          <div class="sr-student-info">
            <h3 class="sr-student-name">${utils.sanitizeHtml(student.name)}</h3>
            <div class="sr-student-details">
              <span class="sr-student-level">${utils.sanitizeHtml(student.class || '')}</span>
              <span class="sr-student-subject">${utils.sanitizeHtml(student.subject || '')}</span>
            </div>
            <div class="sr-student-meta">
              <span class="sr-student-freq">${utils.sanitizeHtml(student.freq || '')}</span>
              <span class="sr-student-duration">${utils.sanitizeHtml(student.duration || '')}</span>
            </div>
          </div>
          <div class="sr-student-actions">
            <button class="sr-btn sr-btn-primary sr-open-student" data-index="${index}">
              Voir détails
            </button>
          </div>
        </div>
      `).join('');

      $app.html(`
        ${headerHtml}
        <div class="sr-students-grid">
          ${studentsGrid}
        </div>
      `);
    },

    bindEvents() {
      const $app = $('#sr-students-app');

      // Actualisation
      $app.on('click', '#sr-refresh-students', () => {
        this.refresh();
      });

      // Ouverture détail élève
      $app.on('click', '.sr-open-student', (e) => {
        const index = parseInt($(e.target).data('index'));
        if (this.students[index]) {
          this.openStudentDetail(this.students[index]);
        }
      });

      // Navigation clavier
      $app.on('keydown', '.sr-student-card', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          $(e.currentTarget).find('.sr-open-student').click();
        }
      });
    },

    async refresh() {
      try {
        await this.loadStudents();
        this.render();
        this.bindEvents();
        utils.showNotification('Liste actualisée', 'success');
      } catch (error) {
        utils.showNotification('Erreur lors de l\'actualisation', 'error');
      }
    },

    startAutoRefresh() {
      this.refreshTimer = setInterval(() => {
        this.refresh();
      }, config.refreshInterval);
    },

    stopAutoRefresh() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    },

    openStudentDetail(student) {
      this.currentStudent = student;
      this.renderStudentOverlay(student);
    },

    renderStudentOverlay(student) {
      // Supprime overlay existant
      $('#sr-student-overlay').remove();

      const overlayHtml = `
        <div id="sr-student-overlay" class="sr-overlay" aria-hidden="false">
          <div class="sr-student-detail">
            <div class="sr-detail-header">
              <button class="sr-close" aria-label="Fermer">&times;</button>
              <h2>${utils.sanitizeHtml(student.name)}</h2>
            </div>
            
            <div class="sr-detail-content">
              <div class="sr-detail-section">
                <h3>Informations générales</h3>
                <div class="sr-info-grid">
                  <div class="sr-info-item">
                    <label>Classe :</label>
                    <span>${utils.sanitizeHtml(student.class || 'Non précisé')}</span>
                  </div>
                  <div class="sr-info-item">
                    <label>Matière :</label>
                    <span>${utils.sanitizeHtml(student.subject || 'Non précisé')}</span>
                  </div>
                  <div class="sr-info-item">
                    <label>Fréquence :</label>
                    <span>${utils.sanitizeHtml(student.freq || 'Non précisé')}</span>
                  </div>
                  <div class="sr-info-item">
                    <label>Durée :</label>
                    <span>${utils.sanitizeHtml(student.duration || 'Non précisé')}</span>
                  </div>
                  <div class="sr-info-item">
                    <label>Statut :</label>
                    <span class="sr-status sr-status-active">${utils.sanitizeHtml(student.status)}</span>
                  </div>
                </div>
              </div>

              <div class="sr-detail-section">
                <h3>Contact et localisation</h3>
                <div class="sr-info-grid">
                  <div class="sr-info-item">
                    <label>Adresse :</label>
                    <span>${utils.sanitizeHtml(utils.formatAddress(student.address))}</span>
                  </div>
                  <div class="sr-info-item">
                    <label>Téléphone :</label>
                    <span>
                      ${student.phone ? `<a href="tel:${student.phone}">${utils.formatPhone(student.phone)}</a>` : 'Non renseigné'}
                    </span>
                  </div>
                </div>
                
                ${student.address ? `
                  <div class="sr-action-buttons">
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(student.address)}" 
                       target="_blank" rel="noopener" class="sr-btn sr-btn-secondary">
                      📍 Itinéraire
                    </a>
                    ${student.phone ? `
                      <a href="tel:${student.phone}" class="sr-btn sr-btn-secondary">
                        📞 Appeler
                      </a>
                    ` : ''}
                  </div>
                ` : ''}
              </div>

              <div class="sr-detail-section">
                <h3>Déclaration d'heures</h3>
                <div class="sr-hours-form">
                  <div class="sr-form-row">
                    <input type="number" 
                           id="sr-hours-input" 
                           min="${config.minHoursPerDeclaration}" 
                           max="${config.maxHoursPerDeclaration}" 
                           step="0.5" 
                           placeholder="Nombre d'heures"
                           class="sr-hours-input">
                    <button class="sr-btn sr-btn-primary sr-declare-hours">
                      Déclarer
                    </button>
                  </div>
                  <small class="sr-form-help">
                    Entre ${config.minHoursPerDeclaration}h et ${config.maxHoursPerDeclaration}h par déclaration
                  </small>
                </div>
              </div>

              <div class="sr-detail-section">
                <h3>Synthèse des heures</h3>
                <div id="sr-hours-summary" class="sr-hours-summary">
                  <div class="sr-loading">Chargement...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      $('body').append(overlayHtml);
      
      // Chargement de la synthèse
      this.loadHoursSummary();
      this.bindOverlayEvents();

      // Focus management
      setTimeout(() => {
        $('#sr-student-overlay .sr-close').focus();
      }, 100);
    },

    bindOverlayEvents() {
      const $overlay = $('#sr-student-overlay');

      // Fermeture
      $overlay.on('click', '.sr-close', () => this.closeOverlay());
      $overlay.on('click', (e) => {
        if (e.target === $overlay[0]) this.closeOverlay();
      });

      $(document).on('keydown.sr-overlay', (e) => {
        if (e.key === 'Escape') this.closeOverlay();
      });

      // Déclaration d'heures
      $overlay.on('click', '.sr-declare-hours', () => this.declareHours());
      $overlay.on('keypress', '#sr-hours-input', (e) => {
        if (e.key === 'Enter') this.declareHours();
      });

      // Validation en temps réel
      $overlay.on('input', '#sr-hours-input', (e) => {
        const $input = $(e.target);
        const $button = $('.sr-declare-hours');
        const hours = $input.val();
        
        if (utils.validateHours(hours)) {
          $input.removeClass('sr-invalid');
          $button.prop('disabled', false);
        } else {
          $input.addClass('sr-invalid');
          $button.prop('disabled', true);
        }
      });
    },

    closeOverlay() {
      $('#sr-student-overlay').fadeOut(150, function() {
        $(this).remove();
      });
      $(document).off('keydown.sr-overlay');
      this.currentStudent = null;
    },

    async loadHoursSummary() {
      if (!this.currentStudent) return;

      const $summary = $('#sr-hours-summary');
      
      try {
        const response = await $.post(sr_students_vars.ajax_url, {
          action: 'sr_hours_summary',
          nonce: sr_students_vars.nonce,
          prof_id: sr_students_vars.prof_id,
          family_id: this.currentStudent.family_id
        });

        if (response.success) {
          const data = response.data;
          const total = (data.paid || 0) + (data.advance || 0) + (data.pending || 0);
          
          $summary.html(`
            <div class="sr-summary-grid">
              <div class="sr-summary-item sr-summary-paid">
                <span class="sr-summary-number">${data.paid || 0}h</span>
                <span class="sr-summary-label">Heures réglées</span>
              </div>
              <div class="sr-summary-item sr-summary-advance">
                <span class="sr-summary-number">${data.advance || 0}h</span>
                <span class="sr-summary-label">Réglées d'avance</span>
              </div>
              <div class="sr-summary-item sr-summary-pending">
                <span class="sr-summary-number">${data.pending || 0}h</span>
                <span class="sr-summary-label">En attente</span>
              </div>
              <div class="sr-summary-item sr-summary-total">
                <span class="sr-summary-number">${total}h</span>
                <span class="sr-summary-label">Total déclaré</span>
              </div>
            </div>
          `);
        } else {
          $summary.html('<div class="sr-error">Erreur de chargement</div>');
        }
      } catch (error) {
        console.error('SR-STUDENTS: Hours summary failed', error);
        $summary.html('<div class="sr-error">Erreur de chargement</div>');
      }
    },

    async declareHours() {
      if (!this.currentStudent) return;

      const $input = $('#sr-hours-input');
      const $button = $('.sr-declare-hours');
      const hours = parseFloat($input.val());

      if (!utils.validateHours(hours)) {
        utils.showNotification(`Veuillez saisir entre ${config.minHoursPerDeclaration}h et ${config.maxHoursPerDeclaration}h`, 'error');
        return;
      }

      // UI loading state
      $button.prop('disabled', true).text('Déclaration...');

      try {
        const response = await $.post(sr_students_vars.ajax_url, {
          action: 'sr_declare_hours',
          nonce: sr_students_vars.nonce,
          prof_id: sr_students_vars.prof_id,
          family_id: this.currentStudent.family_id,
          hours: hours
        });

        if (response.success) {
          utils.showNotification(`${hours}h déclarées avec succès`, 'success');
          $input.val('');
          this.loadHoursSummary(); // Actualiser la synthèse
        } else {
          utils.showNotification('Erreur lors de la déclaration : ' + (response.data || 'Erreur inconnue'), 'error');
        }
      } catch (error) {
        console.error('SR-STUDENTS: Declaration failed', error);
        utils.showNotification('Erreur réseau lors de la déclaration', 'error');
      } finally {
        $button.prop('disabled', false).text('Déclarer');
      }
    },

    showError(message) {
      $('#sr-students-app').html(`
        <div class="sr-error-state">
          <div class="sr-error-icon">⚠️</div>
          <h3>Erreur</h3>
          <p>${utils.sanitizeHtml(message)}</p>
          <button class="sr-btn sr-btn-primary" onclick="location.reload()">
            Recharger la page
          </button>
        </div>
      `);
    },

    destroy() {
      this.stopAutoRefresh();
      $(document).off('keydown.sr-overlay');
      $('#sr-student-overlay').remove();
    }
  };

  // Initialisation
  try {
    await StudentsManager.init();
  } catch (error) {
    console.error('SR-STUDENTS: Fatal error', error);
    StudentsManager.showError('Impossible de charger les élèves');
  }

  // Cleanup on page unload
  $(window).on('beforeunload', () => {
    StudentsManager.destroy();
  });

  // Export global pour débogage
  window.StudentsManager = StudentsManager;
});