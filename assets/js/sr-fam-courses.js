/* SR Family Courses - v2.0.0 */
(function(){
  'use strict';

  // Helpers optimisés
  const $ = function(sel) { 
    return document.querySelector(sel); 
  };
  
  const $$ = function(sel) { 
    return document.querySelectorAll(sel); 
  };

  const utils = {
    formatMonth: function(ym) {
      try {
        const date = new Date(ym + '-01');
        return date.toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric'
        });
      } catch (e) {
        return ym;
      }
    },

    formatHours: function(x) {
      const n = parseFloat(x || 0);
      return (Math.round(n * 100) / 100).toString().replace(/\.0+$/, '');
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
    },

    showToast: function(msg, type = 'info') {
      if (typeof Toastify !== 'undefined') {
        Toastify({
          text: msg,
          duration: 3000,
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
        alert(msg);
      }
    }
  };

  // Validation et initialisation des données
  let courses = [];
  let profOptions = [];
  let monthOptions = [];

  if (typeof srFamCoursesData !== 'undefined') {
    courses = Array.isArray(srFamCoursesData.courses) ? srFamCoursesData.courses : [];
    profOptions = Array.isArray(srFamCoursesData.profOptions) ? srFamCoursesData.profOptions : [];
    monthOptions = Array.isArray(srFamCoursesData.monthOptions) ? srFamCoursesData.monthOptions : [];
  } else {
    console.warn('SR-FAM-COURSES: srFamCoursesData not found');
    utils.showToast('Erreur de chargement des données', 'error');
  }

  // État de l'application
  const state = {
    currentProf: 'all',
    currentMonth: 'all',
    filteredCourses: [],
    
    updateFilters: function(prof, month) {
      this.currentProf = prof || 'all';
      this.currentMonth = month || 'all';
      this.applyFilters();
    },
    
    applyFilters: function() {
      this.filteredCourses = courses.slice();
      
      if (this.currentProf !== 'all') {
        this.filteredCourses = this.filteredCourses.filter(c => 
          String(c.prof_id) === String(this.currentProf)
        );
      }
      
      if (this.currentMonth !== 'all') {
        this.filteredCourses = this.filteredCourses.filter(c => 
          c.month_key === this.currentMonth
        );
      }
    },
    
    getStats: function() {
      const totalHours = this.filteredCourses.reduce((sum, c) => 
        sum + parseFloat(c.nb_hours || 0), 0
      );
      
      const monthsCount = new Set(this.filteredCourses.map(c => c.month_key)).size;
      const profsCount = new Set(this.filteredCourses.map(c => c.prof_id)).size;
      
      return {
        totalCourses: this.filteredCourses.length,
        totalHours: utils.formatHours(totalHours),
        monthsCount,
        profsCount
      };
    }
  };

  // Éléments DOM
  const profSelect = $('#sr-filter-prof');
  const monthSelect = $('#sr-filter-month');
  const container = $('#sr-courses-wrapper');
  const statsContainer = $('#sr-courses-stats');

  // Vérification DOM
  if (!container) {
    console.error('SR-FAM-COURSES: Container #sr-courses-wrapper not found');
    return;
  }

  // Construction des options de select optimisée
  function buildSelectOptions(select, options, labelAll) {
    if (!select) return;
    
    const optionsHtml = options.map(option => 
      `<option value="${utils.sanitizeHtml(option.val)}">${utils.sanitizeHtml(option.label)}</option>`
    ).join('');
    
    select.innerHTML = `<option value="all">${labelAll}</option>${optionsHtml}`;
  }

  // Initialisation des selects
  buildSelectOptions(profSelect, profOptions, 'Tous les professeurs');
  buildSelectOptions(monthSelect, monthOptions, 'Toutes les périodes');

  // Gestion des événements avec debounce
  const debouncedRender = utils.debounce(() => {
    state.applyFilters();
    render();
    updateStats();
  }, 150);

  if (profSelect) {
    profSelect.addEventListener('change', function(e) {
      state.currentProf = e.target.value;
      debouncedRender();
    });
  }

  if (monthSelect) {
    monthSelect.addEventListener('change', function(e) {
      state.currentMonth = e.target.value;
      debouncedRender();
    });
  }

  // Fonction de rendu optimisée
  function render() {
    if (!container) return;

    const courses = state.filteredCourses;
    
    if (courses.length === 0) {
      container.innerHTML = '<div class="sr-no-courses"><p>Aucun cours trouvé avec ces critères.</p></div>';
      return;
    }

    // Groupement par mois optimisé
    const groups = courses.reduce((acc, course) => {
      const key = course.month_key || (course.date_iso ? course.date_iso.slice(0, 7) : '');
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(course);
      return acc;
    }, {});

    // Tri des mois (plus récent en premier)
    const sortedMonths = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    const html = sortedMonths.map(monthKey => {
      const monthCourses = groups[monthKey];
      const totalHours = monthCourses.reduce((sum, c) => 
        sum + parseFloat(c.nb_hours || 0), 0
      );
      const monthLabel = monthCourses[0]?.month_label || utils.formatMonth(monthKey);

      return `
        <details class="sr-month-group" ${state.currentMonth === 'all' ? 'open' : ''}>
          <summary class="sr-month-header">
            <span class="sr-month-label">${utils.sanitizeHtml(monthLabel)}</span>
            <span class="sr-month-stats">
              ${monthCourses.length} cours • ${utils.formatHours(totalHours)}h
            </span>
          </summary>
          <div class="sr-month-content">
            <div class="sr-scroll-x">
              <table class="sr-table">
                <colgroup>
                  <col style="width:15%">
                  <col style="width:auto">
                  <col style="width:10%">
                  <col style="width:25%">
                </colgroup>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Matière</th>
                    <th>Heures</th>
                    <th>Professeur</th>
                  </tr>
                </thead>
                <tbody>
                  ${monthCourses.map(course => `
                    <tr class="sr-course-row" data-course-id="${course.ID || ''}">
                      <td class="sr-col-date">${utils.sanitizeHtml(course.date || '')}</td>
                      <td class="sr-col-subject">${utils.sanitizeHtml(course.subject || '')}</td>
                      <td class="sr-col-hours">${utils.formatHours(course.nb_hours)}</td>
                      <td class="sr-col-prof">${utils.sanitizeHtml(course.prof_name || '')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      `;
    }).join('');

    container.innerHTML = html;

    // Animation d'apparition
    const details = container.querySelectorAll('details');
    details.forEach((detail, index) => {
      detail.style.opacity = '0';
      detail.style.transform = 'translateY(10px)';
      setTimeout(() => {
        detail.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        detail.style.opacity = '1';
        detail.style.transform = 'translateY(0)';
      }, index * 50);
    });
  }

  // Mise à jour des statistiques
  function updateStats() {
    if (!statsContainer) return;
    
    const stats = state.getStats();
    
    statsContainer.innerHTML = `
      <div class="sr-stats-grid">
        <div class="sr-stat-item">
          <span class="sr-stat-number">${stats.totalCourses}</span>
          <span class="sr-stat-label">Cours</span>
        </div>
        <div class="sr-stat-item">
          <span class="sr-stat-number">${stats.totalHours}h</span>
          <span class="sr-stat-label">Total heures</span>
        </div>
        ${stats.profsCount > 1 ? `
          <div class="sr-stat-item">
            <span class="sr-stat-number">${stats.profsCount}</span>
            <span class="sr-stat-label">Professeurs</span>
          </div>
        ` : ''}
        ${stats.monthsCount > 1 ? `
          <div class="sr-stat-item">
            <span class="sr-stat-number">${stats.monthsCount}</span>
            <span class="sr-stat-label">Mois</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Fonction utilitaire globale pour les toasts
  window.srToast = utils.showToast;

  // Neutralisation du "nice-select" du thème
  function disableNiceSelect() {
    ['sr-filter-prof', 'sr-filter-month'].forEach(function(id) {
      const select = document.getElementById(id);
      if (!select) return;
      
      const niceSelect = select.nextElementSibling;
      if (niceSelect && niceSelect.classList && niceSelect.classList.contains('nice-select')) {
        niceSelect.remove();
        select.style.display = '';
      }
    });
  }

  // Gestion des raccourcis clavier
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Ctrl/Cmd + F pour focus sur recherche
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && profSelect) {
        e.preventDefault();
        profSelect.focus();
      }
      
      // Échap pour réinitialiser les filtres
      if (e.key === 'Escape') {
        if (profSelect) profSelect.value = 'all';
        if (monthSelect) monthSelect.value = 'all';
        state.updateFilters('all', 'all');
        debouncedRender();
      }
    });
  }

  // Export des données (bonus)
  window.srExportCourses = function(format = 'csv') {
    const data = state.filteredCourses;
    
    if (format === 'csv') {
      const headers = ['Date', 'Matière', 'Heures', 'Professeur'];
      const rows = data.map(course => [
        course.date || '',
        course.subject || '',
        course.nb_hours || '',
        course.prof_name || ''
      ]);
      
      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `mes-cours-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      
      utils.showToast('Export CSV téléchargé', 'success');
    }
  };

  // Initialisation
  function init() {
    try {
      state.applyFilters();
      render();
      updateStats();
      disableNiceSelect();
      initKeyboardShortcuts();
      
      console.log(`SR-FAM-COURSES initialized: ${courses.length} courses total`);
      
      if (courses.length === 0) {
        utils.showToast('Aucun cours trouvé', 'info');
      }
    } catch (error) {
      console.error('SR-FAM-COURSES: Initialization failed', error);
      utils.showToast('Erreur d\'initialisation', 'error');
    }
  }

  // Démarrage
  init();

})();