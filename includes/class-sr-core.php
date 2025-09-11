<?php
/**
 * includes/class-sr-core.php
 * Gestionnaire principal du plugin Sophiacademia
 * 
 * @package Sophiacademia
 * @version 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class SR_Core {
    
    /**
     * Instance unique (Singleton)
     */
    private static $instance = null;
    
    /**
     * Modules chargés
     */
    private static $modules = [];
    
    /**
     * Version du plugin
     */
    const VERSION = '2.0.0';
    
    /**
     * Constantes tarification famille (France)
     */
    const FAMILY_HOURLY_RATE = 50;   // €/h brut
    const FAMILY_CREDIT_RATE = 0.50; // -50% crédit d'impôt
    const FAMILY_NET_HOURLY = self::FAMILY_HOURLY_RATE * (1 - self::FAMILY_CREDIT_RATE);
    
    /**
     * Initialisation singleton
     */
    public static function init() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructeur privé (Singleton)
     */
    private function __construct() {
        $this->define_constants();
        $this->init_hooks();
        $this->load_modules();
    }
    
    /**
     * Définition des constantes globales
     */
    private function define_constants() {
        // Clés API et configuration
        if (!defined('SR_GEOCODE_KEY')) {
            define('SR_GEOCODE_KEY', get_option('sr_geocode_key', ''));
        }
        
        if (!defined('SR_BCC_AGENCE')) {
            define('SR_BCC_AGENCE', get_option('sr_bcc_email', 'agence@sophiacademia.fr'));
        }
        
        // Paramètres géolocalisation France
        if (!defined('SR_DEFAULT_COUNTRY')) {
            define('SR_DEFAULT_COUNTRY', 'France');
        }
        
        if (!defined('SR_DEFAULT_RADIUS')) {
            define('SR_DEFAULT_RADIUS', 25); // km
        }
        
        // Cache et performance
        if (!defined('SR_CACHE_DURATION')) {
            define('SR_CACHE_DURATION', WEEK_IN_SECONDS);
        }
        
        if (!defined('SR_VERSION')) {
            define('SR_VERSION', self::VERSION);
        }
    }
    
    /**
     * Initialisation des hooks WordPress
     */
    private function init_hooks() {
        // Hooks d'activation/désactivation
        register_activation_hook(SR_PLUGIN_DIR . '../staff-registrar.php', [$this, 'activate']);
        register_deactivation_hook(SR_PLUGIN_DIR . '../staff-registrar.php', [$this, 'deactivate']);
        
        // Hooks WordPress standards
        add_action('init', [$this, 'init_post_types'], 5);
        add_action('init', [$this, 'init_roles'], 6);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_frontend_assets']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        
        // Redirections utilisateurs
        add_action('template_redirect', [$this, 'handle_role_redirects']);
        add_action('admin_init', [$this, 'handle_admin_redirects']);
        
        // Gestion de la barre d'admin
        add_filter('show_admin_bar', [$this, 'manage_admin_bar']);
        
        // Redirections après connexion
        add_filter('login_redirect', [$this, 'login_redirect'], 10, 3);
        add_filter('um_login_redirect_url', [$this, 'um_login_redirect'], 10, 3);
        
        // Nettoyage lors de la désinstallation
        add_action('wp_loaded', [$this, 'setup_uninstall_hook']);
        
        // Gestion des mises à jour
        add_action('plugins_loaded', [$this, 'maybe_update']);
    }
    
    /**
     * Chargement des modules avec gestion d'erreurs
     */
    private function load_modules() {
        $modules_config = [
            'database' => [
                'class' => 'SR_Database',
                'file' => 'class-sr-database.php',
                'priority' => 1
            ],
            'geocoding' => [
                'class' => 'SR_Geocoding',
                'file' => 'class-sr-geocoding.php',
                'priority' => 2
            ],
            'users' => [
                'class' => 'SR_Users',
                'file' => 'class-sr-users.php',
                'priority' => 3
            ],
            'requests' => [
                'class' => 'SR_Requests',
                'file' => 'class-sr-requests.php',
                'priority' => 4
            ],
            'notifications' => [
                'class' => 'SR_Notifications',
                'file' => 'class-sr-notifications.php',
                'priority' => 5
            ],
            'ajax' => [
                'class' => 'SR_Ajax',
                'file' => 'class-sr-ajax.php',
                'priority' => 6
            ],
            'shortcodes' => [
                'class' => 'SR_Shortcodes',
                'file' => 'class-sr-shortcodes.php',
                'priority' => 7
            ],
            'admin' => [
                'class' => 'SR_Admin',
                'file' => 'class-sr-admin.php',
                'priority' => 8,
                'condition' => 'is_admin'
            ]
        ];
        
        // Tri par priorité
        uasort($modules_config, function($a, $b) {
            return $a['priority'] - $b['priority'];
        });
        
        foreach ($modules_config as $key => $config) {
            // Vérification condition de chargement
            if (isset($config['condition'])) {
                if ($config['condition'] === 'is_admin' && !is_admin()) {
                    continue;
                }
            }
            
            $this->load_single_module($key, $config);
        }
    }
    
    /**
     * Chargement d'un module individuel
     */
    private function load_single_module($key, $config) {
        $file_path = SR_PLUGIN_DIR . 'includes/' . $config['file'];
        
        if (!file_exists($file_path)) {
            error_log("SR_Core: Module file not found: {$file_path}");
            return false;
        }
        
        require_once $file_path;
        
        if (!class_exists($config['class'])) {
            error_log("SR_Core: Class {$config['class']} not found in {$file_path}");
            return false;
        }
        
        try {
            self::$modules[$key] = new $config['class']();
            return true;
        } catch (Exception $e) {
            error_log("SR_Core: Failed to instantiate {$config['class']}: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Accès aux modules
     */
    public static function get_module($name) {
        return isset(self::$modules[$name]) ? self::$modules[$name] : null;
    }
    
    /**
     * Vérification si un module est chargé
     */
    public static function module_exists($name) {
        return isset(self::$modules[$name]);
    }
    
    /**
     * Initialisation des post types
     */
    public function init_post_types() {
        // Post type pour les demandes
        register_post_type('sr_request', [
            'labels' => [
                'name' => 'Demandes',
                'singular_name' => 'Demande'
            ],
            'public' => false,
            'show_ui' => false,
            'supports' => ['custom-fields'],
            'capability_type' => 'sr_request',
            'map_meta_cap' => true,
            'capabilities' => [
                'create_posts' => 'sr_create_requests',
                'edit_posts' => 'sr_edit_requests',
                'read_posts' => 'sr_read_requests',
                'delete_posts' => 'sr_delete_requests'
            ]
        ]);
        
        // Post type pour les déclarations d'heures
        register_post_type('sr_course', [
            'labels' => [
                'name' => 'Déclarations d\'heures',
                'singular_name' => 'Déclaration'
            ],
            'public' => false,
            'show_ui' => false,
            'supports' => ['custom-fields'],
            'capability_type' => 'sr_course',
            'map_meta_cap' => true,
            'capabilities' => [
                'create_posts' => 'sr_declare_hours',
                'edit_posts' => 'sr_edit_courses',
                'read_posts' => 'sr_read_courses'
            ]
        ]);
        
        // Post type pour les factures (futur)
        register_post_type('sr_invoice', [
            'labels' => [
                'name' => 'Factures',
                'singular_name' => 'Facture'
            ],
            'public' => false,
            'show_ui' => false,
            'supports' => ['custom-fields'],
            'capability_type' => 'sr_invoice'
        ]);
    }
    
    /**
     * Initialisation des rôles et capabilities
     */
    public function init_roles() {
        // Vérification si les rôles existent déjà
        if (get_role('sr_staff')) {
            return; // Déjà initialisés
        }
        
        $this->create_roles();
    }
    
    /**
     * Création des rôles personnalisés
     */
    private function create_roles() {
        // Rôle Staff avec capabilities granulaires
        add_role('sr_staff', 'Staff Sophiacademia', [
            'read' => true,
            'sr_view_dashboard' => true,
            'sr_view_staff' => true,
            'sr_manage_users' => true,
            'sr_create_users' => true,
            'sr_edit_users' => true,
            'sr_manage_requests' => true,
            'sr_create_requests' => true,
            'sr_read_requests' => true,
            'sr_edit_requests' => true,
            'sr_approve_request' => true,
            'sr_reject_request' => true,
            'sr_manage_assignments' => true,
            'sr_read_assignments' => true,
            'sr_break_assignment' => true,
            'sr_reassign' => true,
            'sr_view_hours' => true,
            'sr_read_courses' => true,
            'sr_edit_courses' => true,
            'sr_mark_paid' => true,
            'sr_mark_refund' => true
        ]);
        
        // Mise à jour rôles familles (si UM les a créés)
        $family_role = get_role('um_famille');
        if ($family_role) {
            $family_role->add_cap('sr_view_courses');
            $family_role->add_cap('sr_view_invoices');
            $family_role->add_cap('sr_view_consumption');
        }
        
        // Mise à jour rôles professeurs
        $prof_role = get_role('um_professeur');
        if ($prof_role) {
            $prof_role->add_cap('sr_view_offers');
            $prof_role->add_cap('sr_create_requests');
            $prof_role->add_cap('sr_declare_hours');
            $prof_role->add_cap('sr_view_students');
            $prof_role->add_cap('sr_view_payments');
        }
    }
    
    /**
     * Gestion des assets front-end avec chargement conditionnel
     */
    public function enqueue_frontend_assets() {
        // Chargement uniquement si utilisateur connecté
        if (!is_user_logged_in()) {
            return;
        }
        
        $user = wp_get_current_user();
        
        // CSS de base toujours chargé
        wp_enqueue_style(
            'sr-core',
            SR_PLUGIN_URL . 'assets/css/sr-core.css',
            [],
            SR_VERSION
        );
        
        // Assets spécifiques par rôle
        if (in_array('um_professeur', $user->roles)) {
            $this->enqueue_professor_assets();
        } elseif (in_array('um_famille', $user->roles)) {
            $this->enqueue_family_assets();
        } elseif (in_array('sr_staff', $user->roles)) {
            $this->enqueue_staff_frontend_assets();
        }
    }
    
    /**
     * Assets pour les professeurs
     */
    private function enqueue_professor_assets() {
        // Leaflet pour les cartes (chargement conditionnel)
        if ($this->page_needs_maps()) {
            wp_enqueue_style('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
            wp_enqueue_script('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', [], null, true);
        }
        
        // CSS professeurs
        wp_enqueue_style(
            'sr-offers',
            SR_PLUGIN_URL . 'assets/css/sr-offers.css',
            ['sr-core'],
            SR_VERSION
        );
        
        wp_enqueue_style(
            'sr-students',
            SR_PLUGIN_URL . 'assets/css/sr-students.css',
            ['sr-core'],
            SR_VERSION
        );
        
        wp_enqueue_style(
            'sr-payments',
            SR_PLUGIN_URL . 'assets/css/sr-payments.css',
            ['sr-core'],
            SR_VERSION
        );
    }
    
    /**
     * Assets pour les familles
     */
    private function enqueue_family_assets() {
        wp_enqueue_style(
            'sr-families-courses',
            SR_PLUGIN_URL . 'assets/css/sr-families-courses.css',
            ['sr-core'],
            SR_VERSION
        );
        
        wp_enqueue_style(
            'sr-families-consos',
            SR_PLUGIN_URL . 'assets/css/sr-families-consos.css',
            ['sr-core'],
            SR_VERSION
        );
        
        wp_enqueue_style(
            'sr-families-invoices',
            SR_PLUGIN_URL . 'assets/css/sr-families-invoices.css',
            ['sr-core'],
            SR_VERSION
        );
    }
    
    /**
     * Assets staff pour le front-end
     */
    private function enqueue_staff_frontend_assets() {
        wp_enqueue_style(
            'sr-staff',
            SR_PLUGIN_URL . 'assets/css/sr-staff.css',
            ['sr-core'],
            SR_VERSION
        );
    }
    
    /**
     * Assets admin
     */
    public function enqueue_admin_assets($hook) {
        // Chargement uniquement sur nos pages admin
        if (strpos($hook, 'sophiacademia') === false && strpos($hook, 'sr-') === false) {
            return;
        }
        
        wp_enqueue_style(
            'sr-admin',
            SR_PLUGIN_URL . 'assets/css/sr-admin.css',
            ['wp-admin'],
            SR_VERSION
        );
        
        wp_enqueue_script(
            'sr-admin',
            SR_PLUGIN_URL . 'assets/js/sr-admin.js',
            ['jquery'],
            SR_VERSION,
            true
        );
        
        // Configuration globale JavaScript
        wp_localize_script('sr-admin', 'srGlobal', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('sr_admin_nonce'),
            'geocodeKey' => SR_GEOCODE_KEY,
            'version' => SR_VERSION,
            'i18n' => [
                'loading' => 'Chargement...',
                'error' => 'Une erreur est survenue',
                'success' => 'Opération réussie',
                'confirm' => 'Êtes-vous sûr ?',
                'cancel' => 'Annuler',
                'save' => 'Enregistrer'
            ]
        ]);
    }
    
    /**
     * Vérification si la page nécessite des cartes
     */
    private function page_needs_maps() {
        global $post;
        
        if (!$post) {
            return false;
        }
        
        // Recherche de shortcodes nécessitant des cartes
        $map_shortcodes = ['sr_offers', 'sr_students'];
        
        foreach ($map_shortcodes as $shortcode) {
            if (has_shortcode($post->post_content, $shortcode)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Gestion redirections par rôle (front-end)
     */
    public function handle_role_redirects() {
        if (is_admin() || wp_doing_ajax() || !is_user_logged_in()) {
            return;
        }
        
        $user = wp_get_current_user();
        
        // Redirection staff vers extranet
        if (in_array('sr_staff', $user->roles)) {
            $current_page = get_queried_object();
            
            // Rester sur la page extranet-staff
            if ($current_page && $current_page->post_name === 'extranet-staff') {
                return;
            }
            
            // Autoriser wp-login.php et pages système
            $request_uri = $_SERVER['REQUEST_URI'] ?? '';
            if (strpos($request_uri, 'wp-login.php') !== false ||
                strpos($request_uri, 'wp-admin') !== false) {
                return;
            }
            
            wp_redirect(home_url('/extranet-staff/'));
            exit;
        }
    }
    
    /**
     * Gestion redirections admin
     */
    public function handle_admin_redirects() {
        if (wp_doing_ajax() || !is_user_logged_in()) {
            return;
        }
        
        $user = wp_get_current_user();
        
        // Redirection staff depuis wp-admin vers extranet
        if (in_array('sr_staff', $user->roles)) {
            wp_redirect(home_url('/extranet-staff/'));
            exit;
        }
    }
    
    /**
     * Gestion barre d'admin
     */
    public function manage_admin_bar($show) {
        if (!is_user_logged_in()) {
            return $show;
        }
        
        $user = wp_get_current_user();
        
        // Masquer pour les staff (ils ont leur extranet)
        if (in_array('sr_staff', $user->roles)) {
            return false;
        }
        
        return $show;
    }
    
    /**
     * Redirections après connexion WordPress classique
     */
    public function login_redirect($redirect_to, $request, $user) {
        if (!$user instanceof WP_User) {
            return $redirect_to;
        }
        
        if (in_array('sr_staff', $user->roles)) {
            return home_url('/extranet-staff/');
        }
        
        return $redirect_to;
    }
    
    /**
     * Redirections après connexion Ultimate Member
     */
    public function um_login_redirect($url, $user_id, $args) {
        $user = get_user_by('id', $user_id);
        
        if ($user && in_array('sr_staff', $user->roles)) {
            return home_url('/extranet-staff/');
        }
        
        return $url;
    }
    
    /**
     * Activation du plugin
     */
    public function activate() {
        // Création des rôles
        $this->create_roles();
        
        // Création des index de base de données
        $this->create_database_indexes();
        
        // Création des options par défaut
        $this->create_default_options();
        
        // Programmation des tâches CRON
        $this->schedule_cron_jobs();
        
        // Flush des règles de réécriture
        flush_rewrite_rules();
        
        // Enregistrement de la version
        update_option('sr_version', SR_VERSION);
        update_option('sr_activated_at', current_time('mysql'));
    }
    
    /**
     * Désactivation du plugin
     */
    public function deactivate() {
        // Suppression des tâches CRON
        wp_clear_scheduled_hook('sr_auto_validate_courses');
        wp_clear_scheduled_hook('sr_cleanup_old_requests');
        wp_clear_scheduled_hook('sr_geocode_user');
        
        // Flush des règles de réécriture
        flush_rewrite_rules();
    }
    
    /**
     * Création des index de performance
     */
    private function create_database_indexes() {
        global $wpdb;
        
        // Index pour les requêtes géographiques
        $indexes = [
            "CREATE INDEX IF NOT EXISTS idx_sr_lat ON {$wpdb->usermeta} (meta_key, meta_value(20)) WHERE meta_key = 'sr_lat'",
            "CREATE INDEX IF NOT EXISTS idx_sr_lng ON {$wpdb->usermeta} (meta_key, meta_value(20)) WHERE meta_key = 'sr_lng'",
            "CREATE INDEX IF NOT EXISTS idx_sr_postcode ON {$wpdb->usermeta} (meta_key, meta_value(10)) WHERE meta_key = 'sr_postcode'",
            "CREATE INDEX IF NOT EXISTS idx_sr_request_status ON {$wpdb->postmeta} (meta_key, meta_value(20)) WHERE meta_key = '_sr_status'",
            "CREATE INDEX IF NOT EXISTS idx_sr_course_prof ON {$wpdb->postmeta} (meta_key, meta_value) WHERE meta_key = '_sr_prof'",
            "CREATE INDEX IF NOT EXISTS idx_sr_course_family ON {$wpdb->postmeta} (meta_key, meta_value) WHERE meta_key = '_sr_family'"
        ];
        
        foreach ($indexes as $sql) {
            $wpdb->query($sql);
        }
    }
    
    /**
     * Création des options par défaut
     */
    private function create_default_options() {
        $defaults = [
            'sr_geocode_key' => '',
            'sr_bcc_email' => 'agence@sophiacademia.fr',
            'sr_default_radius' => 25,
            'sr_auto_validate_hours' => 48, // heures
            'sr_cleanup_requests_days' => 180, // jours
            'sr_email_notifications' => true,
            'sr_debug_mode' => false
        ];
        
        foreach ($defaults as $option => $value) {
            if (get_option($option) === false) {
                add_option($option, $value);
            }
        }
    }
    
    /**
     * Programmation des tâches CRON
     */
    private function schedule_cron_jobs() {
        // Auto-validation des cours après 48h
        if (!wp_next_scheduled('sr_auto_validate_courses')) {
            wp_schedule_event(time() + 3600, 'hourly', 'sr_auto_validate_courses');
        }
        
        // Nettoyage des anciennes demandes
        if (!wp_next_scheduled('sr_cleanup_old_requests')) {
            wp_schedule_event(time() + 3600, 'daily', 'sr_cleanup_old_requests');
        }
    }
    
    /**
     * Hook de désinstallation
     */
    public function setup_uninstall_hook() {
        if (is_admin() && current_user_can('activate_plugins')) {
            register_uninstall_hook(SR_PLUGIN_DIR . '../staff-registrar.php', ['SR_Core', 'uninstall']);
        }
    }
    
    /**
     * Désinstallation complète
     */
    public static function uninstall() {
        // Suppression des rôles
        remove_role('sr_staff');
        
        // Suppression des options
        $options_to_delete = [
            'sr_geocode_key', 'sr_bcc_email', 'sr_default_radius',
            'sr_auto_validate_hours', 'sr_cleanup_requests_days',
            'sr_email_notifications', 'sr_debug_mode', 'sr_version',
            'sr_activated_at'
        ];
        
        foreach ($options_to_delete as $option) {
            delete_option($option);
        }
        
        // Suppression des post types et métadonnées (optionnel)
        if (get_option('sr_delete_data_on_uninstall', false)) {
            global $wpdb;
            
            // Suppression des posts
            $wpdb->query("DELETE FROM {$wpdb->posts} WHERE post_type IN ('sr_request', 'sr_course', 'sr_invoice')");
            
            // Suppression des métadonnées orphelines
            $wpdb->query("DELETE FROM {$wpdb->postmeta} WHERE post_id NOT IN (SELECT ID FROM {$wpdb->posts})");
            
            // Suppression des métadonnées utilisateur SR
            $wpdb->query("DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE 'sr_%'");
        }
        
        // Suppression des tâches CRON
        wp_clear_scheduled_hook('sr_auto_validate_courses');
        wp_clear_scheduled_hook('sr_cleanup_old_requests');
        
        // Flush des règles de réécriture
        flush_rewrite_rules();
    }
    
    /**
     * Gestion des mises à jour
     */
    public function maybe_update() {
        $current_version = get_option('sr_version', '1.0.0');
        
        if (version_compare($current_version, SR_VERSION, '<')) {
            $this->run_updates($current_version);
            update_option('sr_version', SR_VERSION);
        }
    }
    
    /**
     * Exécution des mises à jour
     */
    private function run_updates($from_version) {
        // Mise à jour 1.x -> 2.0
        if (version_compare($from_version, '2.0.0', '<')) {
            $this->update_to_2_0();
        }
    }
    
    /**
     * Mise à jour vers la version 2.0
     */
    private function update_to_2_0() {
        // Recréation des rôles avec nouvelles capabilities
        $this->create_roles();
        
        // Recréation des index
        $this->create_database_indexes();
        
        // Migration des données si nécessaire
        $this->migrate_legacy_data();
        
        error_log('SR_Core: Updated to version 2.0.0');
    }
    
    /**
     * Migration des données legacy
     */
    private function migrate_legacy_data() {
        // Ici vous pourriez ajouter la logique de migration
        // Par exemple, renommer des meta_keys, convertir des formats, etc.
    }
    
    /**
     * Utilitaires statiques
     */
    
    /**
     * Log des erreurs avec niveau de debug
     */
    public static function log($message, $level = 'info') {
        if (!get_option('sr_debug_mode', false) && $level === 'debug') {
            return;
        }
        
        error_log("SR_Core [{$level}]: {$message}");
    }
    
    /**
     * Vérification des prérequis
     */
    public static function check_requirements() {
        $requirements = [
            'php_version' => '7.4',
            'wp_version' => '5.0',
            'required_plugins' => [] // Ultimate Member si nécessaire
        ];
        
        $errors = [];
        
        // Vérification PHP
        if (version_compare(PHP_VERSION, $requirements['php_version'], '<')) {
            $errors[] = sprintf('PHP %s requis (version actuelle : %s)', $requirements['php_version'], PHP_VERSION);
        }
        
        // Vérification WordPress
        global $wp_version;
        if (version_compare($wp_version, $requirements['wp_version'], '<')) {
            $errors[] = sprintf('WordPress %s requis (version actuelle : %s)', $requirements['wp_version'], $wp_version);
        }
        
        return empty($errors) ? true : $errors;
    }
    
    /**
     * Informations sur le plugin
     */
    public static function get_plugin_info() {
        return [
            'name' => 'Sophiacademia Staff Registrar',
            'version' => SR_VERSION,
            'modules_loaded' => array_keys(self::$modules),
            'db_version' => get_option('sr_version'),
            'php_version' => PHP_VERSION,
            'wp_version' => get_bloginfo('version')
        ];
    }
}