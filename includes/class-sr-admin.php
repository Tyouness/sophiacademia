<?php
/**
 * includes/class-sr-admin.php
 * Interface d'administration complète pour Sophiacademia
 * 
 * @package Sophiacademia
 * @version 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class SR_Admin {
    
    /**
     * Configuration des pages admin
     */
    private $pages_config = [];
    
    /**
     * Messages d'administration
     */
    private $admin_notices = [];
    
    public function __construct() {
        $this->init_pages_config();
        $this->init_hooks();
    }
    
    /**
     * Configuration des pages d'administration
     */
    private function init_pages_config() {
        $this->pages_config = [
            'dashboard' => [
                'title' => 'Tableau de bord',
                'capability' => 'sr_view_dashboard',
                'callback' => 'render_dashboard',
                'icon' => 'dashicons-dashboard'
            ],
            'users' => [
                'title' => 'Utilisateurs',
                'capability' => 'sr_manage_users',
                'callback' => 'render_users_page',
                'icon' => 'dashicons-admin-users'
            ],
            'requests' => [
                'title' => 'Demandes',
                'capability' => 'sr_manage_requests',
                'callback' => 'render_requests_page',
                'icon' => 'dashicons-feedback'
            ],
            'assignments' => [
                'title' => 'Affectations',
                'capability' => 'sr_manage_assignments',
                'callback' => 'render_assignments_page',
                'icon' => 'dashicons-networking'
            ],
            'hours' => [
                'title' => 'Heures déclarées',
                'capability' => 'sr_view_hours',
                'callback' => 'render_hours_page',
                'icon' => 'dashicons-clock'
            ],
            'add_family' => [
                'title' => 'Ajouter famille',
                'capability' => 'sr_create_users',
                'callback' => 'render_add_family_form',
                'parent' => 'users'
            ],
            'add_professor' => [
                'title' => 'Ajouter professeur',
                'capability' => 'sr_create_users',
                'callback' => 'render_add_professor_form',
                'parent' => 'users'
            ],
            'settings' => [
                'title' => 'Configuration',
                'capability' => 'manage_options',
                'callback' => 'render_settings_page',
                'icon' => 'dashicons-admin-generic'
            ]
        ];
    }
    
    /**
     * Initialisation des hooks WordPress
     */
    private function init_hooks() {
        add_action('admin_menu', [$this, 'register_admin_menus']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        add_action('admin_init', [$this, 'handle_admin_actions']);
        add_action('admin_init', [$this, 'handle_admin_redirects']);
        add_action('admin_notices', [$this, 'display_admin_notices']);
        
        // Hooks pour les actions de formulaires
        add_action('admin_post_sr_create_family', [$this, 'handle_create_family']);
        add_action('admin_post_sr_create_professor', [$this, 'handle_create_professor']);
        add_action('admin_post_sr_update_settings', [$this, 'handle_update_settings']);
    }
    
    /**
     * ENREGISTREMENT DES MENUS
     * ================================================================
     */
    
    /**
     * Enregistrement des menus d'administration
     */
    public function register_admin_menus() {
        // Menu principal
        add_menu_page(
            'Sophiacademia',
            'Sophiacademia', 
            'sr_view_dashboard',
            'sophiacademia',
            [$this, 'render_dashboard'],
            'dashicons-academic-cap',
            25
        );
        
        // Sous-menus
        foreach ($this->pages_config as $slug => $config) {
            if (isset($config['parent'])) {
                continue; // Traité plus bas
            }
            
            if ($slug === 'dashboard') {
                // Renommer le premier sous-menu
                add_submenu_page(
                    'sophiacademia',
                    $config['title'],
                    $config['title'],
                    $config['capability'],
                    'sophiacademia',
                    [$this, $config['callback']]
                );
            } else {
                add_submenu_page(
                    'sophiacademia',
                    $config['title'],
                    $config['title'],
                    $config['capability'],
                    'sr-' . $slug,
                    [$this, $config['callback']]
                );
            }
        }
        
        // Sous-menus avec parent
        foreach ($this->pages_config as $slug => $config) {
            if (!isset($config['parent']) || !current_user_can($config['capability'])) {
                continue;
            }
            
            add_submenu_page(
                'sophiacademia',
                $config['title'],
                $config['title'],
                $config['capability'],
                'sr-' . $slug,
                [$this, $config['callback']]
            );
        }
    }
    
    /**
     * ASSETS ADMIN
     * ================================================================
     */
    
    /**
     * Chargement des assets d'administration
     */
    public function enqueue_admin_assets($hook) {
        // Chargement uniquement sur nos pages
        if (strpos($hook, 'sophiacademia') === false && strpos($hook, 'sr-') === false) {
            return;
        }
        
        // CSS principal admin
        wp_enqueue_style(
            'sr-admin',
            SR_PLUGIN_URL . 'assets/css/sr-admin.css',
            ['wp-admin'],
            SR_VERSION
        );
        
        // JavaScript principal admin
        wp_enqueue_script(
            'sr-admin',
            SR_PLUGIN_URL . 'assets/js/sr-admin.js',
            ['jquery', 'wp-util'],
            SR_VERSION,
            true
        );
        
        // Configuration JavaScript globale
        wp_localize_script('sr-admin', 'srAdmin', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('sr_admin_nonce'),
            'geocodeKey' => SR_GEOCODE_KEY,
            'i18n' => [
                'loading' => 'Chargement...',
                'error' => 'Une erreur est survenue',
                'success' => 'Opération réussie',
                'confirmDelete' => 'Êtes-vous sûr de vouloir supprimer ?',
                'confirmAction' => 'Confirmer cette action ?',
                'cancel' => 'Annuler',
                'save' => 'Enregistrer'
            ]
        ]);
        
        // Assets spécifiques par page
        $this->enqueue_page_specific_assets($hook);
    }
    
    /**
     * Assets spécifiques par page
     */
    private function enqueue_page_specific_assets($hook) {
        if (strpos($hook, 'sr-users') !== false) {
            wp_enqueue_script(
                'sr-user-management',
                SR_PLUGIN_URL . 'assets/js/sr-user-management.js',
                ['sr-admin'],
                SR_VERSION,
                true
            );
        }
        
        if (strpos($hook, 'sr-add-') !== false) {
            wp_enqueue_script(
                'sr-form-handler',
                SR_PLUGIN_URL . 'assets/js/sr-form-handler.js',
                ['sr-admin'],
                SR_VERSION,
                true
            );
        }
        
        if (strpos($hook, 'sr-settings') !== false) {
            wp_enqueue_script(
                'sr-settings',
                SR_PLUGIN_URL . 'assets/js/sr-settings.js',
                ['sr-admin'],
                SR_VERSION,
                true
            );
        }
    }
    
    /**
     * REDIRECTIONS ADMIN
     * ================================================================
     */
    
    /**
     * Gestion des redirections d'administration
     */
    public function handle_admin_redirects() {
        if (wp_doing_ajax() || !is_user_logged_in()) {
            return;
        }
        
        $user = wp_get_current_user();
        
        // Redirection staff vers extranet front-end
        if (in_array('sr_staff', $user->roles)) {
            $current_page = $_GET['page'] ?? '';
            
            // Pages autorisées pour le staff en admin
            $allowed_admin_pages = ['sophiacademia', 'sr-requests', 'sr-assignments', 'sr-hours'];
            
            if (!in_array($current_page, $allowed_admin_pages) && strpos($current_page, 'sr-') === 0) {
                wp_redirect(home_url('/extranet-staff/'));
                exit;
            }
        }
    }
    
    /**
     * TABLEAU DE BORD
     * ================================================================
     */
    
    /**
     * Rendu du tableau de bord principal
     */
    public function render_dashboard() {
        $stats = $this->get_dashboard_statistics();
        $recent_activity = $this->get_recent_activity();
        
        echo '<div class="wrap sr-dashboard">';
        echo '<h1>Tableau de bord Sophiacademia</h1>';
        
        // Métriques principales
        $this->render_dashboard_stats($stats);
        
        // Activité récente
        $this->render_recent_activity($recent_activity);
        
        // Actions rapides
        $this->render_quick_actions();
        
        // Outils de diagnostic
        $this->render_diagnostic_tools();
        
        echo '</div>';
    }
    
    /**
     * Rendu des statistiques du tableau de bord
     */
    private function render_dashboard_stats($stats) {
        echo '<div class="sr-stats-grid">';
        
        foreach ($stats as $stat) {
            $trend_class = '';
            $trend_text = '';
            
            if (isset($stat['trend'])) {
                $trend_class = $stat['trend'] > 0 ? 'trend-up' : ($stat['trend'] < 0 ? 'trend-down' : '');
                $trend_text = $stat['trend'] > 0 ? '+' . $stat['trend'] : $stat['trend'];
            }
            
            printf(
                '<div class="sr-stat-card %s">
                    <div class="sr-stat-number">%s</div>
                    <div class="sr-stat-label">%s</div>
                    %s
                </div>',
                esc_attr($trend_class),
                esc_html($stat['number']),
                esc_html($stat['label']),
                $trend_text ? '<div class="sr-stat-trend">' . esc_html($trend_text) . '</div>' : ''
            );
        }
        
        echo '</div>';
    }
    
    /**
     * Récupération des statistiques du tableau de bord
     */
    private function get_dashboard_statistics() {
        global $wpdb;
        
        $stats = [];
        
        // Nombre total d'utilisateurs actifs
        $total_users = $wpdb->get_var("
            SELECT COUNT(*) FROM {$wpdb->users} u 
            JOIN {$wpdb->usermeta} um ON u.ID = um.user_id 
            WHERE um.meta_key = '{$wpdb->prefix}capabilities' 
            AND (um.meta_value LIKE '%um_famille%' OR um.meta_value LIKE '%um_professeur%')
        ");
        
        $stats[] = [
            'number' => $total_users,
            'label' => 'Utilisateurs actifs',
            'trend' => $this->calculate_user_trend()
        ];
        
        // Demandes en attente
        $pending_requests = $wpdb->get_var("
            SELECT COUNT(*) FROM {$wpdb->posts} p 
            LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_sr_status'
            WHERE p.post_type = 'sr_request' 
            AND (pm.meta_value = 'pending' OR pm.meta_value IS NULL)
        ");
        
        $stats[] = [
            'number' => $pending_requests,
            'label' => 'Demandes en attente',
            'urgent' => $pending_requests > 10
        ];
        
        // Affectations actives
        $active_assignments = $wpdb->get_var("
            SELECT COUNT(*) FROM {$wpdb->posts} p 
            JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id 
            WHERE p.post_type = 'sr_request' 
            AND pm.meta_key = '_sr_status' 
            AND pm.meta_value = 'approved'
        ");
        
        $stats[] = [
            'number' => $active_assignments,
            'label' => 'Affectations actives'
        ];
        
        // Heures déclarées ce mois
        $monthly_hours = $wpdb->get_var($wpdb->prepare("
            SELECT SUM(CAST(pm_hours.meta_value AS DECIMAL(5,2)))
            FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm_hours ON p.ID = pm_hours.post_id AND pm_hours.meta_key = '_sr_hours'
            JOIN {$wpdb->postmeta} pm_date ON p.ID = pm_date.post_id AND pm_date.meta_key = '_sr_date'
            WHERE p.post_type = 'sr_course'
            AND pm_date.meta_value >= %s
        ", date('Y-m-01')));
        
        $stats[] = [
            'number' => number_format_i18n(floatval($monthly_hours), 1) . 'h',
            'label' => 'Heures ce mois'
        ];
        
        return $stats;
    }
    
    /**
     * GESTION DES UTILISATEURS
     * ================================================================
     */
    
    /**
     * Page de gestion des utilisateurs
     */
    public function render_users_page() {
        // Traitement des actions
        $this->handle_user_actions();
        
        echo '<div class="wrap sr-users-page">';
        echo '<h1>Gestion des utilisateurs';
        
        if (current_user_can('sr_create_users')) {
            echo ' <a href="' . admin_url('admin.php?page=sr-add_family') . '" class="page-title-action">Ajouter famille</a>';
            echo ' <a href="' . admin_url('admin.php?page=sr-add_professor') . '" class="page-title-action">Ajouter professeur</a>';
        }
        
        echo '</h1>';
        
        // Filtres de recherche
        $this->render_user_filters();
        
        // Tableau des utilisateurs
        $this->render_users_table();
        
        // Modale d'édition
        $this->render_user_edit_modal();
        
        echo '</div>';
    }
    
    /**
     * Filtres de recherche utilisateurs
     */
    private function render_user_filters() {
        $current_role = $_GET['role'] ?? 'all';
        $current_search = $_GET['s'] ?? '';
        $current_city = $_GET['city'] ?? '';
        
        echo '<div class="sr-filters-container">';
        echo '<form method="get" class="sr-filters">';
        echo '<input type="hidden" name="page" value="sr-users">';
        
        // Recherche textuelle
        printf(
            '<input type="search" name="s" value="%s" placeholder="Rechercher un nom..." class="sr-filter-search">',
            esc_attr($current_search)
        );
        
        // Filtre par rôle
        $roles = [
            'all' => 'Tous les rôles',
            'um_famille' => 'Familles',
            'um_professeur' => 'Professeurs',
            'sr_staff' => 'Staff'
        ];
        
        echo '<select name="role" class="sr-filter-select">';
        foreach ($roles as $value => $label) {
            printf(
                '<option value="%s"%s>%s</option>',
                esc_attr($value),
                selected($current_role, $value, false),
                esc_html($label)
            );
        }
        echo '</select>';
        
        // Filtre par ville
        $cities = $this->get_popular_cities();
        if (!empty($cities)) {
            echo '<select name="city" class="sr-filter-select">';
            echo '<option value="">Toutes les villes</option>';
            foreach ($cities as $city) {
                printf(
                    '<option value="%s"%s>%s</option>',
                    esc_attr($city),
                    selected($current_city, $city, false),
                    esc_html($city)
                );
            }
            echo '</select>';
        }
        
        echo '<button type="submit" class="button">Filtrer</button>';
        echo '<a href="' . admin_url('admin.php?page=sr-users') . '" class="button">Réinitialiser</a>';
        echo '</form>';
        echo '</div>';
    }
    
    /**
     * Tableau des utilisateurs avec pagination
     */
    private function render_users_table() {
        $users_data = $this->get_filtered_users();
        
        if (empty($users_data['users'])) {
            echo '<div class="sr-no-results">Aucun utilisateur trouvé avec ces critères.</div>';
            return;
        }
        
        echo '<div class="sr-table-container">';
        echo '<table class="wp-list-table widefat fixed striped sr-users-table">';
        echo '<thead>';
        echo '<tr>';
        echo '<th class="column-name">Nom</th>';
        echo '<th class="column-email">Email</th>';
        echo '<th class="column-role">Rôle</th>';
        echo '<th class="column-location">Localisation</th>';
        echo '<th class="column-subject">Matière</th>';
        echo '<th class="column-status">Statut</th>';
        echo '<th class="column-actions">Actions</th>';
        echo '</tr>';
        echo '</thead>';
        echo '<tbody>';
        
        foreach ($users_data['users'] as $user) {
            $this->render_user_row($user);
        }
        
        echo '</tbody>';
        echo '</table>';
        echo '</div>';
        
        // Pagination
        if ($users_data['total_pages'] > 1) {
            $this->render_pagination($users_data);
        }
    }
    
    /**
     * Rendu d'une ligne utilisateur
     */
    private function render_user_row($user) {
        $status = $this->get_user_status($user);
        $location = $this->format_user_location($user);
        $subject = $this->get_user_subject($user);
        
        printf(
            '<tr data-user-id="%d" class="user-row">
                <td class="column-name">
                    <strong>%s</strong>
                    <div class="user-meta">ID: %d</div>
                </td>
                <td class="column-email">
                    <a href="mailto:%s">%s</a>
                </td>
                <td class="column-role">
                    <span class="role-badge role-%s">%s</span>
                </td>
                <td class="column-location">%s</td>
                <td class="column-subject">%s</td>
                <td class="column-status">
                    <span class="status-indicator status-%s">%s</span>
                </td>
                <td class="column-actions">
                    <button class="button button-small sr-edit-user" data-user-id="%d">Modifier</button>
                    <button class="button button-small button-link-delete sr-delete-user" data-user-id="%d">Supprimer</button>
                </td>
            </tr>',
            $user->ID,
            esc_html($user->display_name),
            $user->ID,
            esc_attr($user->user_email),
            esc_html($user->user_email),
            esc_attr($this->get_primary_role($user)),
            esc_html($this->format_user_roles($user)),
            esc_html($location),
            esc_html($subject),
            esc_attr($status['class']),
            esc_html($status['label']),
            $user->ID,
            $user->ID
        );
    }
    
    /**
     * FORMULAIRES D'AJOUT
     * ================================================================
     */
    
    /**
     * Formulaire d'ajout de famille
     */
    public function render_add_family_form() {
        echo '<div class="wrap sr-form-page">';
        echo '<h1>Ajouter une famille</h1>';
        
        // Affichage des messages
        $this->display_form_messages();
        
        echo '<form method="post" action="' . admin_url('admin-post.php') . '" class="sr-form sr-family-form">';
        echo '<input type="hidden" name="action" value="sr_create_family">';
        wp_nonce_field('sr_create_family', 'sr_family_nonce');
        
        echo '<div class="sr-form-sections">';
        
        // Section Représentant
        echo '<div class="sr-form-section">';
        echo '<h2>Informations représentant</h2>';
        echo '<table class="form-table">';
        
        $this->render_form_field('rep_first', 'Prénom représentant', 'text', true);
        $this->render_form_field('rep_last', 'Nom représentant', 'text', true);
        $this->render_form_field('rep_email', 'Email', 'email', true);
        $this->render_form_field('rep_phone', 'Téléphone', 'tel', false);
        
        echo '</table>';
        echo '</div>';
        
        // Section Adresse
        echo '<div class="sr-form-section">';
        echo '<h2>Adresse</h2>';
        echo '<table class="form-table">';
        
        $this->render_form_field('addr1', 'Adresse', 'text', true);
        $this->render_form_field('addr2', 'Complément d\'adresse', 'text', false);
        $this->render_form_field('postcode', 'Code postal', 'text', true, ['data-geocode' => 'postcode']);
        $this->render_form_field('city', 'Ville', 'text', true, ['data-geocode' => 'city', 'readonly' => true]);
        $this->render_form_field('country', 'Pays', 'text', false, [], 'France');
        
        echo '</table>';
        echo '</div>';
        
        // Section Élève
        echo '<div class="sr-form-section">';
        echo '<h2>Informations élève</h2>';
        echo '<table class="form-table">';
        
        $this->render_form_field('stu_first', 'Prénom élève', 'text', true);
        $this->render_form_field('stu_last', 'Nom élève', 'text', true);
        $this->render_form_field('level', 'Niveau', 'select', true, [], '', [
            '' => 'Choisir le niveau...',
            '6ème' => '6ème', '5ème' => '5ème', '4ème' => '4ème', '3ème' => '3ème',
            '2nde' => '2nde', '1ère' => '1ère', 'Terminale' => 'Terminale',
            'BTS' => 'BTS', 'Licence' => 'Licence', 'Master' => 'Master'
        ]);
        $this->render_form_field('subject', 'Matière', 'select', true, [], '', [
            '' => 'Choisir la matière...',
            'Mathématiques' => 'Mathématiques', 'Physique-Chimie' => 'Physique-Chimie',
            'SVT' => 'SVT', 'Français' => 'Français', 'Histoire-Géographie' => 'Histoire-Géographie',
            'Anglais' => 'Anglais', 'Espagnol' => 'Espagnol', 'Allemand' => 'Allemand',
            'Philosophie' => 'Philosophie', 'Économie' => 'Économie'
        ]);
        $this->render_form_field('gender', 'Sexe', 'select', true, [], '', [
            '' => 'Choisir...',
            'garçon' => 'Garçon',
            'fille' => 'Fille'
        ]);
        
        echo '</table>';
        echo '</div>';
        
        // Section Cours
        echo '<div class="sr-form-section">';
        echo '<h2>Modalités de cours</h2>';
        echo '<table class="form-table">';
        
        $this->render_form_field('freq', 'Fréquence', 'select', true, [], '', [
            '' => 'Choisir...',
            '1/semaine' => '1 fois par semaine',
            '2/semaine' => '2 fois par semaine',
            '1/15jours' => '1 fois tous les 15 jours'
        ]);
        $this->render_form_field('duration', 'Durée séance', 'select', true, [], '', [
            '' => 'Choisir...',
            '1h00' => '1 heure',
            '1h30' => '1h30',
            '2h00' => '2 heures'
        ]);
        $this->render_form_field('start', 'Date de début souhaitée', 'date', false);
        
        echo '</table>';
        echo '</div>';
        
        echo '</div>'; // fin sr-form-sections
        
        echo '<p class="submit">';
        echo '<input type="submit" name="submit" class="button button-primary button-large" value="Créer la famille">';
        echo ' <a href="' . admin_url('admin.php?page=sr-users') . '" class="button button-large">Annuler</a>';
        echo '</p>';
        
        echo '</form>';
        echo '</div>';
    }
    
    /**
     * Formulaire d'ajout de professeur
     */
    public function render_add_professor_form() {
        echo '<div class="wrap sr-form-page">';
        echo '<h1>Ajouter un professeur</h1>';
        
        $this->display_form_messages();
        
        echo '<form method="post" action="' . admin_url('admin-post.php') . '" class="sr-form sr-professor-form">';
        echo '<input type="hidden" name="action" value="sr_create_professor">';
        wp_nonce_field('sr_create_professor', 'sr_professor_nonce');
        
        echo '<div class="sr-form-sections">';
        
        // Section Informations personnelles
        echo '<div class="sr-form-section">';
        echo '<h2>Informations personnelles</h2>';
        echo '<table class="form-table">';
        
        $this->render_form_field('prof_first', 'Prénom', 'text', true);
        $this->render_form_field('prof_last', 'Nom', 'text', true);
        $this->render_form_field('prof_email', 'Email', 'email', true);
        $this->render_form_field('prof_phone', 'Téléphone', 'tel', false);
        
        echo '</table>';
        echo '</div>';
        
        // Section Compétences
        echo '<div class="sr-form-section">';
        echo '<h2>Compétences</h2>';
        echo '<table class="form-table">';
        
        $this->render_form_field('prof_subject', 'Matière principale', 'select', true, [], '', [
            '' => 'Choisir...',
            'Mathématiques' => 'Mathématiques', 'Physique-Chimie' => 'Physique-Chimie',
            'SVT' => 'SVT', 'Français' => 'Français', 'Histoire-Géographie' => 'Histoire-Géographie',
            'Anglais' => 'Anglais', 'Espagnol' => 'Espagnol', 'Allemand' => 'Allemand',
            'Philosophie' => 'Philosophie', 'Économie' => 'Économie'
        ]);
        
        echo '</table>';
        echo '</div>';
        
        // Section Adresse
        echo '<div class="sr-form-section">';
        echo '<h2>Adresse</h2>';
        echo '<table class="form-table">';
        
        $this->render_form_field('addr1', 'Adresse', 'text', true);
        $this->render_form_field('addr2', 'Complément d\'adresse', 'text', false);
        $this->render_form_field('postcode', 'Code postal', 'text', true, ['data-geocode' => 'postcode']);
        $this->render_form_field('city', 'Ville', 'text', true, ['data-geocode' => 'city', 'readonly' => true]);
        $this->render_form_field('country', 'Pays', 'text', false, [], 'France');
        
        echo '</table>';
        echo '</div>';
        
        echo '</div>';
        
        echo '<p class="submit">';
        echo '<input type="submit" name="submit" class="button button-primary button-large" value="Créer le professeur">';
        echo ' <a href="' . admin_url('admin.php?page=sr-users') . '" class="button button-large">Annuler</a>';
        echo '</p>';
        
        echo '</form>';
        echo '</div>';
    }
    
    /**
     * Helper pour rendre un champ de formulaire
     */
    private function render_form_field($name, $label, $type = 'text', $required = false, $attrs = [], $default = '', $options = []) {
        $req_attr = $required ? 'required' : '';
        $req_mark = $required ? ' <span class="required">*</span>' : '';
        
        $attrs_str = '';
        foreach ($attrs as $key => $value) {
            $attrs_str .= sprintf(' %s="%s"', esc_attr($key), esc_attr($value));
        }
        
        echo '<tr>';
        printf(
            '<th scope="row"><label for="%s">%s%s</label></th>',
            esc_attr($name),
            esc_html($label),
            $req_mark
        );
        echo '<td>';
        
        if ($type === 'select') {
            printf(
                '<select id="%s" name="%s" class="regular-text" %s %s>',
                esc_attr($name),
                esc_attr($name),
                $req_attr,
                $attrs_str
            );
            
            foreach ($options as $value => $text) {
                printf(
                    '<option value="%s"%s>%s</option>',
                    esc_attr($value),
                    selected($default, $value, false),
                    esc_html($text)
                );
            }
            
            echo '</select>';
        } else {
            printf(
                '<input type="%s" id="%s" name="%s" value="%s" class="regular-text" %s %s>',
                esc_attr($type),
                esc_attr($name),
                esc_attr($name),
                esc_attr($default),
                $req_attr,
                $attrs_str
            );
        }
        
        echo '</td>';
        echo '</tr>';
    }
    
    /**
     * HANDLERS D'ACTIONS
     * ================================================================
     */
    
    /**
     * Gestionnaire de création de famille
     */
    public function handle_create_family() {
        if (!check_admin_referer('sr_create_family', 'sr_family_nonce')) {
            wp_die('Action non autorisée');
        }
        
        if (!current_user_can('sr_create_users')) {
            wp_die('Permissions insuffisantes');
        }
        
        $users_module = SR_Core::get_module('users');
        $result = $users_module->create_family($_POST);
        
        if ($result['success']) {
            $this->add_admin_notice('Famille créée avec succès (ID: ' . $result['user_id'] . ')', 'success');
            wp_redirect(admin_url('admin.php?page=sr-add_family&created=1'));
        } else {
            $this->add_admin_notice('Erreur: ' . $result['message'], 'error');
            wp_redirect(admin_url('admin.php?page=sr-add_family&error=1'));
        }
        exit;
    }
    
    /**
     * Gestionnaire de création de professeur
     */
    public function handle_create_professor() {
        if (!check_admin_referer('sr_create_professor', 'sr_professor_nonce')) {
            wp_die('Action non autorisée');
        }
        
        if (!current_user_can('sr_create_users')) {
            wp_die('Permissions insuffisantes');
        }
        
        $users_module = SR_Core::get_module('users');
        $result = $users_module->create_professor($_POST);
        
        if ($result['success']) {
            $this->add_admin_notice('Professeur créé avec succès (ID: ' . $result['user_id'] . ')', 'success');
            wp_redirect(admin_url('admin.php?page=sr-add_professor&created=1'));
        } else {
            $this->add_admin_notice('Erreur: ' . $result['message'], 'error');
            wp_redirect(admin_url('admin.php?page=sr-add_professor&error=1'));
        }
        exit;
    }
    
    /**
     * UTILITAIRES
     * ================================================================
     */
    
    /**
     * Ajout d'un message d'administration
     */
    private function add_admin_notice($message, $type = 'info') {
        $this->admin_notices[] = [
            'message' => $message,
            'type' => $type
        ];
        
        // Stockage temporaire pour les redirections
        set_transient('sr_admin_notices_' . get_current_user_id(), $this->admin_notices, 30);
    }
    
    /**
     * Affichage des messages d'administration
     */
    public function display_admin_notices() {
        // Récupération des messages stockés
        $stored_notices = get_transient('sr_admin_notices_' . get_current_user_id());
        if ($stored_notices) {
            $this->admin_notices = array_merge($this->admin_notices, $stored_notices);
            delete_transient('sr_admin_notices_' . get_current_user_id());
        }
        
        foreach ($this->admin_notices as $notice) {
            printf(
                '<div class="notice notice-%s is-dismissible"><p>%s</p></div>',
                esc_attr($notice['type']),
                esc_html($notice['message'])
            );
        }
        
        $this->admin_notices = [];
    }
    
    /**
     * Pages non implémentées dans ce snippet (à compléter)
     */
    public function render_requests_page() {
        echo '<div class="wrap"><h1>Demandes</h1><p>Page en cours de développement...</p></div>';
    }
    
    public function render_assignments_page() {
        echo '<div class="wrap"><h1>Affectations</h1><p>Page en cours de développement...</p></div>';
    }
    
    public function render_hours_page() {
        echo '<div class="wrap"><h1>Heures déclarées</h1><p>Page en cours de développement...</p></div>';
    }
    
    public function render_settings_page() {
        echo '<div class="wrap"><h1>Configuration</h1><p>Page en cours de développement...</p></div>';
    }
    
    /**
     * Méthodes placeholder à implémenter
     */
    private function handle_admin_actions() {}
    private function handle_user_actions() {}
    private function get_recent_activity() { return []; }
    private function render_recent_activity($activity) {}
    private function render_quick_actions() {}
    private function render_diagnostic_tools() {}
    private function render_user_edit_modal() {}
    private function get_filtered_users() { return ['users' => [], 'total_pages' => 0]; }
    private function render_pagination($data) {}
    private function get_popular_cities() { return []; }
    private function get_user_status($user) { return ['class' => 'active', 'label' => 'Actif']; }
    private function format_user_location($user) { return ''; }
    private function get_user_subject($user) { return ''; }
    private function get_primary_role($user) { return 'um_famille'; }
    private function format_user_roles($user) { return 'Famille'; }
    private function display_form_messages() {}
    private function calculate_user_trend() { return 0; }
}