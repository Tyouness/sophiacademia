/* SR Families Consumptions - v2.0.0 */
(function($) {
  'use strict';

  // Configuration
  const config = {
    family_hourly_rate: 50,
    family_credit_rate: 0.50,
    chart_colors: {
      primary: '#007bff',
      secondary: '#6c757d',
      success: '#28a745',
      info: '#17a2b8'
    }
  };

  // Utilitaires
  const utils = {
    formatCurrency: function(amount) {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
      }).format(amount);
    },

    formatHours: function(hours) {
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(hours);
    },

    formatMonth: function(dateStr) {
      try {
        const date = new Date(dateStr + '-01');
        return date.toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric'
        });
      } catch (e) {
        return dateStr;
      }
    },

    showToast: function(message, type = 'info') {
      if (typeof Toastify !== 'undefined') {
        Toastify({
          text: message,
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
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
    },

    downloadFile: function(content, filename, type = 'text/csv') {
      const blob = new Blob([content], { type: type + ';charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    }
  };

  // Classe principale pour la gestion des consommations
  class FamilyConsumptions {
    constructor() {
      this.data = this.extractTableData();
      this.init();
    }

    extractTableData() {
      const data = [];
      const rows = document.querySelectorAll('.sr-conso-table tbody tr');
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
          data.push({
            month: cells[0].textContent.trim(),
            hours: parseFloat(cells[1].textContent.replace(',', '.')) || 0,
            grossAmount: parseFloat(cells[2].textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0,
            netAmount: parseFloat(cells[3].textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
          });
        }
      });
      
      return data;
    }

    init() {
      this.addControls();
      this.addChart();
      this.addSummaryCards();
      this.bindEvents();
      
      console.log('SR-FAMILIES-CONSOS initialized with', this.data.length, 'months of data');
    }

    addControls() {
      const header = document.querySelector('.sr-consumption-header') || 
                    document.querySelector('h2');
      
      if (!header) return;

      const controlsHtml = `
        <div class="sr-consos-controls">
          <div class="sr-control-group">
            <button class="sr-btn sr-btn-export" data-format="csv">
              📊 Export CSV
            </button>
            <button class="sr-btn sr-btn-export" data-format="pdf">
              📄 Export PDF
            </button>
          </div>
          <div class="sr-control-group">
            <button class="sr-btn sr-btn-chart-toggle">
              📈 Afficher/Masquer graphique
            </button>
            <select class="sr-period-filter">
              <option value="all">Toutes les périodes</option>
              <option value="6">6 derniers mois</option>
              <option value="12">12 derniers mois</option>
            </select>
          </div>
        </div>
      `;

      header.insertAdjacentHTML('afterend', controlsHtml);
    }

    addSummaryCards() {
      const totals = this.calculateTotals();
      const average = this.data.length > 0 ? totals.totalHours / this.data.length : 0;
      
      const summaryHtml = `
        <div class="sr-summary-cards">
          <div class="sr-summary-card">
            <div class="sr-card-icon">⏱️</div>
            <div class="sr-card-content">
              <div class="sr-card-number">${utils.formatHours(totals.totalHours)}h</div>
              <div class="sr-card-label">Total heures</div>
            </div>
          </div>
          <div class="sr-summary-card">
            <div class="sr-card-icon">💰</div>
            <div class="sr-card-content">
              <div class="sr-card-number">${utils.formatCurrency(totals.totalNet)}</div>
              <div class="sr-card-label">Total à charge</div>
            </div>
          </div>
          <div class="sr-summary-card">
            <div class="sr-card-icon">📊</div>
            <div class="sr-card-content">
              <div class="sr-card-number">${utils.formatHours(average)}h</div>
              <div class="sr-card-label">Moyenne/mois</div>
            </div>
          </div>
          <div class="sr-summary-card">
            <div class="sr-card-icon">📅</div>
            <div class="sr-card-content">
              <div class="sr-card-number">${this.data.length}</div>
              <div class="sr-card-label">Mois de cours</div>
            </div>
          </div>
        </div>
      `;

      const controls = document.querySelector('.sr-consos-controls');
      if (controls) {
        controls.insertAdjacentHTML('afterend', summaryHtml);
      }
    }

    addChart() {
      const chartContainer = `
        <div class="sr-chart-container" style="display: none;">
          <canvas id="sr-consumption-chart" width="400" height="200"></canvas>
        </div>
      `;

      const table = document.querySelector('.sr-conso-table');
      if (table) {
        table.insertAdjacentHTML('beforebegin', chartContainer);
      }
    }

    initChart() {
      if (typeof Chart === 'undefined') {
        utils.showToast('Chart.js non disponible pour les graphiques', 'warning');
        return;
      }

      const ctx = document.getElementById('sr-consumption-chart');
      if (!ctx) return;

      const labels = this.data.map(d => d.month).reverse();
      const hoursData = this.data.map(d => d.hours).reverse();
      const netAmountData = this.data.map(d => d.netAmount).reverse();

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Heures de cours',
              data: hoursData,
              borderColor: config.chart_colors.primary,
              backgroundColor: config.chart_colors.primary + '20',
              yAxisID: 'y',
              tension: 0.4
            },
            {
              label: 'Montant (€)',
              data: netAmountData,
              borderColor: config.chart_colors.success,
              backgroundColor: config.chart_colors.success + '20',
              yAxisID: 'y1',
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            title: {
              display: true,
              text: 'Évolution des consommations'
            },
            legend: {
              display: true,
              position: 'top'
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Mois'
              }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Heures'
              }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Montant (€)'
              },
              grid: {
                drawOnChartArea: false,
              }
            }
          }
        }
      });
    }

    calculateTotals() {
      return this.data.reduce((totals, item) => ({
        totalHours: totals.totalHours + item.hours,
        totalGross: totals.totalGross + item.grossAmount,
        totalNet: totals.totalNet + item.netAmount
      }), { totalHours: 0, totalGross: 0, totalNet: 0 });
    }

    bindEvents() {
      // Export buttons
      document.addEventListener('click', (e) => {
        if (e.target.matches('.sr-btn-export')) {
          const format = e.target.dataset.format;
          this.exportData(format);
        }
      });

      // Chart toggle
      document.addEventListener('click', (e) => {
        if (e.target.matches('.sr-btn-chart-toggle')) {
          this.toggleChart();
        }
      });

      // Period filter
      document.addEventListener('change', (e) => {
        if (e.target.matches('.sr-period-filter')) {
          this.filterByPeriod(parseInt(e.target.value));
        }
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key) {
            case 'e':
              e.preventDefault();
              this.exportData('csv');
              break;
            case 'g':
              e.preventDefault();
              this.toggleChart();
              break;
          }
        }
      });
    }

    exportData(format) {
      if (format === 'csv') {
        this.exportCSV();
      } else if (format === 'pdf') {
        this.exportPDF();
      }
    }

    exportCSV() {
      const headers = ['Mois', 'Heures', 'Montant brut (€)', 'Montant net (€)'];
      const rows = this.data.map(item => [
        item.month,
        item.hours.toString().replace('.', ','),
        item.grossAmount.toString().replace('.', ','),
        item.netAmount.toString().replace('.', ',')
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(';'))
        .join('\n');

      const filename = `consommations-${new Date().toISOString().slice(0, 7)}.csv`;
      utils.downloadFile(csvContent, filename, 'text/csv');
      utils.showToast('Export CSV téléchargé', 'success');
    }

    exportPDF() {
      // Simulation d'export PDF (nécessiterait une bibliothèque comme jsPDF)
      utils.showToast('Export PDF en cours de développement', 'info');
      
      // Alternative : redirection vers endpoint PHP pour génération PDF
      const familyId = document.body.dataset.familyId;
      if (familyId) {
        const url = new URL(window.location.origin + '/wp-admin/admin-ajax.php');
        url.searchParams.append('action', 'sr_export_consumption_pdf');
        url.searchParams.append('family_id', familyId);
        url.searchParams.append('nonce', window.srFamilyNonce || '');
        
        window.open(url.href, '_blank');
      }
    }

    toggleChart() {
      const container = document.querySelector('.sr-chart-container');
      if (!container) return;

      const isVisible = container.style.display !== 'none';
      
      if (isVisible) {
        container.style.display = 'none';
      } else {
        container.style.display = 'block';
        // Initialiser le graphique seulement si nécessaire
        if (!container.dataset.initialized) {
          this.initChart();
          container.dataset.initialized = 'true';
        }
      }
    }

    filterByPeriod(months) {
      const rows = document.querySelectorAll('.sr-conso-table tbody tr');
      
      if (months === 'all' || !months) {
        rows.forEach(row => row.style.display = '');
        return;
      }

      // Afficher seulement les X derniers mois
      rows.forEach((row, index) => {
        row.style.display = index < months ? '' : 'none';
      });

      utils.showToast(`Affichage des ${months} derniers mois`, 'info');
    }
  }

  // Initialisation
  $(document).ready(function() {
    // Vérifier si on est sur la page des consommations
    if (document.querySelector('.sr-conso-table')) {
      new FamilyConsumptions();
    }
  });

  // Export global pour l'utilisation externe
  window.FamilyConsumptions = FamilyConsumptions;

})(jQuery);