/* SR Staff Interface - v2.0.0 */
(function($) {
  'use strict';

  // Vérifications initiales
  if (!window.sr_staff_vars || !window.sr_staff_vars.ajax_url) {
    console.error('SR-STAFF: sr_staff_vars not properly localized');
    return;
  }

  // Configuration
  const config = {
    refreshInterval: 30000, // 30 secondes
    maxRetries: 3,
    retryDelay: 1000
  };

  // Utilitaires
  const utils = {
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
                       type === 'success' ? '#28a745' : 
                       type === 'warning' ? '#ffc107' : '#007bff'
          }
        }).showToast();
      } else {
        alert(`[${type.toUpperCase()}] ${message}`);
      }
    },

    formatDate: function(dateStr) {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        return dateStr;
      }
    },

    sanitizeHtml: function(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    },

    debounce: function(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  };

  // Gestionnaire principal des onglets
  const TabManager = {
    currentTab: 'req',
    loadedTabs: new Set(),
    refreshTimers: {},

    switchTab: function(tab) {
      // UI updates
      $('.sr-tabs button').removeClass('active');
      $(`.sr-tabs button[data-tab="${tab}"]`).addClass('active');
      $('.sr-tab-panel').removeClass('active').hide();
      $(`#sr-tab-${tab}`).addClass('active').show();

      this.currentTab = tab;

      // Charger le contenu si nécessaire
      if (!this.loadedTabs.has(tab)) {
        this.loadTabContent(tab);
      }

      // Gérer le refresh automatique
      this.manageAutoRefresh(tab);
    },

    loadTabContent: function(tab) {
      const $panel = $(`#sr-tab-${tab}`);
      $panel.html('<div class="sr-loading"><span class="sr-spinner"></span> Chargement...</div>');

      try {
        switch (tab) {
          case 'req':
            this.loadRequests($panel);
            break;
          case 'aff':
            this.loadAssignments($panel);
            break;
          case 'hrs':
            this.loadHours($panel);
            break;
          case 'allusers':
            this.loadAllUsers($panel);
            break;
          case 'addfam':
            this.loadAddFamilyForm($panel);
            break;
          case 'addprof':
            this.loadAddProfForm($panel);
            break;
          default:
            $panel.html('<div class="sr-error">Onglet non reconnu</div>');
        }
      } catch (error) {
        console.error(`Error loading tab ${tab}:`, error);
        $panel.html('<div class="sr-error">Erreur de chargement</div>');
      }
    },

    manageAutoRefresh: function(tab) {
      // Arrêter tous les timers
      Object.values(this.refreshTimers).forEach(timer => clearInterval(timer));
      this.refreshTimers = {};

      // Démarrer le refresh pour les onglets dynamiques
      if (['req', 'aff', 'hrs'].includes(tab)) {
        this.refreshTimers[tab] = setInterval(() => {
          if (this.currentTab === tab) {
            this.loadTabContent(tab);
          }
        }, config.refreshInterval);
      }
    },

    // === CHARGEMENT DES DEMANDES ===
    loadRequests: function($panel) {
      $.post(sr_staff_vars.ajax_url, {
        action: 'sr_staff_list_requests',
        nonce: sr_staff_vars.nonce
      })
      .done(res => {
        if (!res || !res.success) {
          $panel.html('<div class="sr-error">Erreur de chargement des demandes.</div>');
          return;
        }

        const requests = res.data || [];
        if (!requests.length) {
          $panel.html('<div class="sr-empty">📭 Aucune demande en attente.</div>');
          this.loadedTabs.add('req');
          return;
        }

        const tableHtml = `
          <div class="sr-table-header">
            <h3>Demandes en attente (${requests.length})</h3>
            <div class="sr-table-actions">
              <button class="sr-btn sr-btn-refresh" data-tab="req">🔄 Actualiser</button>
            </div>
          </div>
          <div class="sr-table-container">
            <table class="sr-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Famille</th>
                  <th>Professeur</th>
                  <th>Localisation</th>
                  <th>Matière</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${requests.map(req => `
                  <tr data-id="${req.id}">
                    <td>${utils.formatDate(req.date)}</td>
                    <td><strong>${utils.sanitizeHtml(req.family)}</strong></td>
                    <td>${utils.sanitizeHtml(req.prof || '—')}</td>
                    <td>${utils.sanitizeHtml(req.city)}</td>
                    <td>${utils.sanitizeHtml(req.subject)}</td>
                    <td class="sr-actions">
                      <button class="sr-btn sr-btn-success sr-approve" data-id="${req.id}">
                        ✓ Approuver
                      </button>
                      <button class="sr-btn sr-btn-danger sr-reject" data-id="${req.id}">
                        ✗ Rejeter
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;

        $panel.html(tableHtml);
        this.loadedTabs.add('req');
      })
      .fail(() => {
        $panel.html('<div class="sr-error">Erreur réseau lors du chargement des demandes.</div>');
      });
    },

    // === CHARGEMENT DES AFFECTATIONS ===
    loadAssignments: function($panel) {
      $.post(sr_staff_vars.ajax_url, {
        action: 'sr_staff_list_assignments',
        nonce: sr_staff_vars.nonce
      })
      .done(res => {
        if (!res || !res.success) {
          $panel.html('<div class="sr-error">Erreur de chargement des affectations.</div>');
          return;
        }

        const assignments = res.data || [];
        if (!assignments.length) {
          $panel.html('<div class="sr-empty">📋 Aucune affectation active.</div>');
          this.loadedTabs.add('aff');
          return;
        }

        const tableHtml = `
          <div class="sr-table-header">
            <h3>Affectations actives (${assignments.length})</h3>
            <div class="sr-table-actions">
              <button class="sr-btn sr-btn-refresh" data-tab="aff">🔄 Actualiser</button>
            </div>
          </div>
          <div class="sr-table-container">
            <table class="sr-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Professeur</th>
                  <th>Famille</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${assignments.map(aff => `
                  <tr data-id="${aff.request_id}">
                    <td>${utils.formatDate(aff.date)}</td>
                    <td><strong>${utils.sanitizeHtml(aff.prof)}</strong></td>
                    <td><strong>${utils.sanitizeHtml(aff.family)}</strong></td>
                    <td><span class="sr-status sr-status-active">Actif</span></td>
                    <td class="sr-actions">
                      <button class="sr-btn sr-btn-warning sr-break" data-id="${aff.request_id}">
                        ⚠️ Rompre
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;

        $panel.html(tableHtml);
        this.loadedTabs.add('aff');
      })
      .fail(() => {
        $panel.html('<div class="sr-error">Erreur réseau lors du chargement des affectations.</div>');
      });
    },

    // === CHARGEMENT DES HEURES ===
    loadHours: function($panel) {
      $.post(sr_staff_vars.ajax_url, {
        action: 'sr_staff_list_hours',
        nonce: sr_staff_vars.nonce
      })
      .done(res => {
        if (!res || !res.success) {
          $panel.html('<div class="sr-error">Erreur de chargement des heures.</div>');
          return;
        }

        const hours = res.data || [];
        if (!hours.length) {
          $panel.html('<div class="sr-empty">⏰ Aucune déclaration d\'heures.</div>');
          this.loadedTabs.add('hrs');
          return;
        }

        const tableHtml = `
          <div class="sr-table-header">
            <h3>Heures déclarées (${hours.length})</h3>
            <div class="sr-table-actions">
              <button class="sr-btn sr-btn-refresh" data-tab="hrs">🔄 Actualiser</button>
            </div>
          </div>
          <div class="sr-table-container">
            <table class="sr-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Professeur</th>
                  <th>Famille</th>
                  <th>Heures</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${hours.map(hour => {
                  const statusClass = hour.status === 'paid' ? 'success' : 
                                     hour.status === 'pending' ? 'warning' : 'info';
                  return `
                    <tr data-id="${hour.course_id}">
                      <td>${utils.formatDate(hour.date)}</td>
                      <td><strong>${utils.sanitizeHtml(hour.prof)}</strong></td>
                      <td><strong>${utils.sanitizeHtml(hour.family)}</strong></td>
                      <td class="sr-hours">${hour.hours}h</td>
                      <td><span class="sr-status sr-status-${statusClass}">${hour.status}</span></td>
                      <td class="sr-actions">
                        ${hour.status === 'pending' ? `
                          <button class="sr-btn sr-btn-success sr-mark-paid" data-id="${hour.course_id}">
                            💰 Marquer payé
                          </button>
                        ` : `
                          <span class="sr-text-muted">Traité</span>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;

        $panel.html(tableHtml);
        this.loadedTabs.add('hrs');
      })
      .fail(() => {
        $panel.html('<div class="sr-error">Erreur réseau lors du chargement des heures.</div>');
      });
    },

    // === CHARGEMENT DE TOUS LES UTILISATEURS ===
    loadAllUsers: function($panel) {
      $.post(sr_staff_vars.ajax_url, {
        action: 'sr_staff_list_all_users',
        nonce: sr_staff_vars.nonce
      })
      .done(res => {
        if (!res || !res.success) {
          $panel.html('<div class="sr-error">Erreur de chargement des utilisateurs.</div>');
          return;
        }

        const users = res.data || [];
        if (!users.length) {
          $panel.html('<div class="sr-empty">👥 Aucun utilisateur trouvé.</div>');
          this.loadedTabs.add('allusers');
          return;
        }

        const searchHtml = `
          <div class="sr-search-container">
            <input type="search" id="sr-user-search" placeholder="Rechercher un utilisateur..." class="sr-search-input">
            <select id="sr-role-filter" class="sr-filter-select">
              <option value="">Tous les rôles</option>
              <option value="um_famille">Familles</option>
              <option value="um_professeur">Professeurs</option>
              <option value="sr_staff">Staff</option>
            </select>
          </div>
        `;

        const tableHtml = `
          <div class="sr-table-header">
            <h3>Tous les utilisateurs (${users.length})</h3>
            <div class="sr-table-actions">
              <button class="sr-btn sr-btn-refresh" data-tab="allusers">🔄 Actualiser</button>
            </div>
          </div>
          ${searchHtml}
          <div class="sr-table-container">
            <table class="sr-data-table" id="sr-users-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Ville</th>
                  <th>Matière</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(user => `
                  <tr data-id="${user.id}" data-role="${user.roles}">
                    <td><strong>${utils.sanitizeHtml(user.name)}</strong></td>
                    <td><a href="mailto:${user.email}">${utils.sanitizeHtml(user.email)}</a></td>
                    <td><span class="sr-role-badge">${utils.sanitizeHtml(user.roles)}</span></td>
                    <td>${utils.sanitizeHtml(user.city)}</td>
                    <td>${utils.sanitizeHtml(user.subject || '—')}</td>
                    <td class="sr-actions">
                      <button class="sr-btn sr-btn-edit-user" data-id="${user.id}">
                        ✏️ Modifier
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;

        $panel.html(tableHtml);
        this.initUserSearch();
        this.loadedTabs.add('allusers');
      })
      .fail(() => {
        $panel.html('<div class="sr-error">Erreur réseau lors du chargement des utilisateurs.</div>');
      });
    },

    // === FORMULAIRE AJOUT FAMILLE ===
    loadAddFamilyForm: function($panel) {
      const formHtml = `
        <div class="sr-form-container">
          <h3>Ajouter une famille</h3>
          <form id="sr-add-family-form" class="sr-form">
            <div class="sr-form-grid">
              <div class="sr-form-section">
                <h4>Représentant légal</h4>
                <div class="sr-form-row">
                  <input type="text" name="rep_first" placeholder="Prénom" required>
                  <input type="text" name="rep_last" placeholder="Nom" required>
                </div>
                <input type="email" name="email" placeholder="Email" required>
                <input type="tel" name="phone" placeholder="Téléphone">
              </div>
              
              <div class="sr-form-section">
                <h4>Adresse</h4>
                <input type="text" name="addr1" placeholder="Adresse" required>
                <input type="text" name="addr2" placeholder="Complément d'adresse">
                <div class="sr-form-row">
                  <input type="text" name="postcode" placeholder="Code postal" required pattern="[0-9]{5}">
                  <input type="text" name="city" placeholder="Ville" required>
                </div>
              </div>
              
              <div class="sr-form-section">
                <h4>Informations cours</h4>
                <div class="sr-form-row">
                  <input type="text" name="student_name" placeholder="Nom de l'élève">
                  <select name="level">
                    <option value="">Niveau...</option>
                    <option value="6ème">6ème</option>
                    <option value="5ème">5ème</option>
                    <option value="4ème">4ème</option>
                    <option value="3ème">3ème</option>
                    <option value="2nde">2nde</option>
                    <option value="1ère">1ère</option>
                    <option value="Terminale">Terminale</option>
                  </select>
                </div>
                <select name="subject">
                  <option value="">Matière...</option>
                  <option value="Mathématiques">Mathématiques</option>
                  <option value="Physique-Chimie">Physique-Chimie</option>
                  <option value="Français">Français</option>
                  <option value="Anglais">Anglais</option>
                </select>
              </div>
            </div>
            
            <div class="sr-form-actions">
              <button type="submit" class="sr-btn sr-btn-primary">Créer la famille</button>
              <button type="reset" class="sr-btn sr-btn-secondary">Réinitialiser</button>
            </div>
          </form>
        </div>
      `;

      $panel.html(formHtml);
      this.loadedTabs.add('addfam');
    },

    // === FORMULAIRE AJOUT PROFESSEUR ===
    loadAddProfForm: function($panel) {
      const formHtml = `
        <div class="sr-form-container">
          <h3>Ajouter un professeur</h3>
          <form id="sr-add-prof-form" class="sr-form">
            <div class="sr-form-grid">
              <div class="sr-form-section">
                <h4>Informations personnelles</h4>
                <div class="sr-form-row">
                  <input type="text" name="first" placeholder="Prénom" required>
                  <input type="text" name="last" placeholder="Nom" required>
                </div>
                <input type="email" name="email" placeholder="Email" required>
                <input type="tel" name="phone" placeholder="Téléphone">
              </div>
              
              <div class="sr-form-section">
                <h4>Compétences</h4>
                <select name="subject" required>
                  <option value="">Matière principale...</option>
                  <option value="Mathématiques">Mathématiques</option>
                  <option value="Physique-Chimie">Physique-Chimie</option>
                  <option value="Français">Français</option>
                  <option value="Anglais">Anglais</option>
                  <option value="Histoire-Géographie">Histoire-Géographie</option>
                </select>
              </div>
              
              <div class="sr-form-section">
                <h4>Adresse</h4>
                <input type="text" name="addr1" placeholder="Adresse" required>
                <div class="sr-form-row">
                  <input type="text" name="postcode" placeholder="Code postal" required pattern="[0-9]{5}">
                  <input type="text" name="city" placeholder="Ville" required>
                </div>
              </div>
            </div>
            
            <div class="sr-form-actions">
              <button type="submit" class="sr-btn sr-btn-primary">Créer le professeur</button>
              <button type="reset" class="sr-btn sr-btn-secondary">Réinitialiser</button>
            </div>
          </form>
        </div>
      `;

      $panel.html(formHtml);
      this.loadedTabs.add('addprof');
    },

    // === RECHERCHE UTILISATEURS ===
    initUserSearch: function() {
      const searchInput = document.getElementById('sr-user-search');
      const roleFilter = document.getElementById('sr-role-filter');
      
      if (!searchInput || !roleFilter) return;

      const filterUsers = utils.debounce(() => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedRole = roleFilter.value;
        const rows = document.querySelectorAll('#sr-users-table tbody tr');
        
        rows.forEach(row => {
          const name = row.querySelector('td:first-child').textContent.toLowerCase();
          const email = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
          const role = row.dataset.role;
          
          const matchesSearch = !searchTerm || name.includes(searchTerm) || email.includes(searchTerm);
          const matchesRole = !selectedRole || role.includes(selectedRole);
          
          row.style.display = matchesSearch && matchesRole ? '' : 'none';
        });
      }, 300);

      searchInput.addEventListener('input', filterUsers);
      roleFilter.addEventListener('change', filterUsers);
    }
  };

  // === GESTION DES ÉVÉNEMENTS ===
  $(document).ready(function() {
    // Navigation des onglets
    $(document).on('click', '.sr-tabs button', function() {
      const tab = $(this).data('tab');
      if (tab) {
        TabManager.switchTab(tab);
      }
    });

    // Boutons d'actualisation
    $(document).on('click', '.sr-btn-refresh', function() {
      const tab = $(this).data('tab');
      if (tab && TabManager.loadedTabs.has(tab)) {
        TabManager.loadedTabs.delete(tab);
        TabManager.loadTabContent(tab);
      }
    });

    // Actions sur les demandes
    $(document).on('click', '.sr-approve', function() {
      const id = $(this).data('id');
      const $btn = $(this).prop('disabled', true).text('Traitement...');
      
      $.post(sr_staff_vars.ajax_url, {
        action: 'sr_staff_approve_request',
        nonce: sr_staff_vars.nonce,
        request_id: id
      })
      .done(res => {
        if (res.success) {
          utils.showNotification('Demande approuvée avec succès', 'success');
          TabManager.loadedTabs.delete('req');
          TabManager.loadTabContent('req');
        } else {
          utils.showNotification('Erreur lors de l\'approbation', 'error');
          $btn.prop('disabled', false).text('✓ Approuver');
        }
      })
      .fail(() => {
        utils.showNotification('Erreur réseau', 'error');
        $btn.prop('disabled', false).text('✓ Approuver');
      });
    });

    $(document).on('click', '.sr-reject', function() {
      const id = $(this).data('id');
      if (!confirm('Êtes-vous sûr de vouloir rejeter cette demande ?')) return;
      
      const $btn = $(this).prop('disabled', true).text('Traitement...');
      
      $.post(sr_staff_vars.ajax_url, {
        action: 'sr_staff_reject_request',
        nonce: sr_staff_vars.nonce,
        request_id: id
      })
      .done(res => {
        if (res.success) {
          utils.showNotification('Demande rejetée', 'warning');
          TabManager.loadedTabs.delete('req');
          TabManager.loadTabContent('req');
        } else {
          utils.showNotification('Erreur lors du rejet', 'error');
          $btn.prop('disabled', false).text('✗ Rejeter');
        }
      })
      .fail(() => {
        utils.showNotification('Erreur réseau', 'error');
        $btn.prop('disabled', false).text('✗ Rejeter');
      });
    });

    // Actions sur les affectations
    $(document).on('click', '.sr-break', function() {
      const id = $(this).data('id');
      if (!confirm('Êtes-vous sûr de vouloir rompre cette affectation ?')) return;
      
      $.post(sr_staff_vars.ajax_url, {
        action: 'sr_staff_break_assignment',
        nonce: sr_staff_vars.nonce,
        request_id: id
      })
      .done(() => {
        utils.showNotification('Affectation rompue', 'warning');
        TabManager.loadedTabs.delete('aff');
        TabManager.loadTabContent('aff');
      });
    });

    // Actions sur les heures
    $(document).on('click', '.sr-mark-paid', function() {
      const id = $(this).data('id');
      $.post(sr_staff_vars.ajax_url, {
        action: 'sr_staff_mark_paid',
        nonce: sr_staff_vars.nonce,
        course_id: id
      })
      .done(() => {
        utils.showNotification('Heures marquées comme payées', 'success');
        TabManager.loadedTabs.delete('hrs');
        TabManager.loadTabContent('hrs');
      });
    });

    // Soumission formulaires
    $(document).on('submit', '#sr-add-family-form', function(e) {
      e.preventDefault();
      const formData = new FormData(this);
      formData.append('action', 'sr_staff_add_family');
      formData.append('nonce', sr_staff_vars.nonce);
      
      $.post(sr_staff_vars.ajax_url, Object.fromEntries(formData))
        .done(res => {
          if (res.success) {
            utils.showNotification('Famille créée avec succès', 'success');
            this.reset();
          } else {
            utils.showNotification('Erreur lors de la création', 'error');
          }
        });
    });

    $(document).on('submit', '#sr-add-prof-form', function(e) {
      e.preventDefault();
      const formData = new FormData(this);
      formData.append('action', 'sr_staff_add_prof');
      formData.append('nonce', sr_staff_vars.nonce);
      
      $.post(sr_staff_vars.ajax_url, Object.fromEntries(formData))
        .done(res => {
          if (res.success) {
            utils.showNotification('Professeur créé avec succès', 'success');
            this.reset();
          } else {
            utils.showNotification('Erreur lors de la création', 'error');
          }
        });
    });

    // Initialisation - onglet par défaut
    TabManager.switchTab('req');
    
    console.log('SR-STAFF initialized');
  });

})(jQuery);