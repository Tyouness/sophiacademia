<?php
/**
 * includes/class-sr-ajax.php
 * Gestionnaire AJAX centralisé pour Sophiacademia
 * 
 * @package Sophiacademia
 * @version 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class SR_Ajax {
    
    /**
     * Configuration des handlers AJAX
     */
    private $handlers = [];
    
    /**
     * Rate limiting par utilisateur
     */
    private static $rate_limits = [
        'default' => ['requests' => 60, 'window' => 60], // 60 req/min
        'geocoding' => ['requests' => 10, 'window' => 60], // 10 req/min
        'search' => ['requests' => 30, 'window' => 60] // 30 req/min
    ];
    
    /**
     * Cache des réponses fréquentes
     */
    private static $response_cache = [];
    
    public function __construct() {
        $this->register_ajax_handlers();
        $this->init_hooks();
    }
    
    /**
     * ENREGISTREMENT DES HANDLERS
     * ================================================================
     */
    
    /**
     * Enregistrement centralisé de tous les handlers AJAX
     */
    private function register_ajax_handlers() {
        $this->handlers = [
            // ─── GÉOCODAGE ET UTILISATEURS ───
            'sr_get_user_meta' => [
                'callback' => [$this, 'get_user_meta'],
                'capability' => 'edit_users',
                'nonce' => 'sr_admin_nonce',
                'rate_limit' => 'default'
            ],
            'sr_save_user' => [
                'callback' => [$this, 'save_user'],
                'capability' => 'edit_users',
                'nonce' => 'sr_admin_nonce',
                'rate_limit' => 'default'
            ],
            'sr_geocode_batch' => [
                'callback' => [$this, 'geocode_batch'],
                'capability' => 'manage_options',
                'nonce' => 'sr_batch_geocode',
                'rate_limit' => 'geocoding'
            ],
            'sr_test_geocoding' => [
                'callback' => [$this, 'test_geocoding'],
                'capability' => 'manage_options',
                'nonce' => 'sr_admin_nonce',
                'rate_limit' => 'geocoding'
            ],
            
            // ─── OFFRES PROFESSEURS ───
            'sr_get_students' => [
                'callback' => [$this, 'get_students'],
                'capability' => 'sr_view_students',
                'nonce' => 'sr_nonce',
                'rate_limit' => 'default'
            ],
            'sr_send_request' => [
                'callback' => [$this, 'send_request'],
                'capability' => 'sr_create_requests',
                'nonce' => 'sr_nonce',
                'rate_limit' => 'default'
            ],
            'sr_declare_hours' => [
                'callback' => [$this, 'declare_hours'],
                'capability' => 'sr_declare_hours',
                'nonce' => 'sr_nonce',
                'rate_limit' => 'default'
            ],
            'sr_hours_summary' => [
                'callback' => [$this, 'hours_summary'],
                'capability' => 'sr_view_students',
                'nonce' => 'sr_nonce',
                'rate_limit' => 'default',
                'cache_duration' => 15 * MINUTE_IN_SECONDS
            ],
            
            // ─── INTERFACE STAFF ───
            'sr_staff_list_requests' => [
                'callback' => [$this, 'staff_list_requests'],
                'capability' => 'sr_manage_requests',
                'nonce' => 'sr_staff_nonce',
                'rate_limit' => 'default'
            ],
            'sr_staff_approve_request' => [
                'callback' => [$this, 'staff_approve_request'],
                'capability' => 'sr_approve_request',
                'nonce' => 'sr_staff_nonce',
                'rate_limit' => 'default'
            ],
            'sr_staff_reject_request' => [
                'callback' => [$this, 'staff_reject_request'],
                'capability' => 'sr_reject_request',
                'nonce' => 'sr_staff_nonce',
                'rate_limit' => 'default'
            ],
            'sr_staff_list_assignments' => [
                'callback' => [$this, 'staff_list_assignments'],
                'capability' => 'sr_read_assignments',
                'nonce' => 'sr_staff_nonce',
                'rate_limit' => 'default'
            ],
            'sr_staff_break_assignment' => [
                'callback' => [$this, 'staff_break_assignment'],
                'capability' => 'sr_break_assignment',
                'nonce' => 'sr_staff_nonce',
                'rate_limit' => 'default'
            ],
            'sr_staff_list_hours' => [
                'callback' => [$this, 'staff_list_hours'],
                'capability' => 'sr_view_hours',
                'nonce' => 'sr_staff_nonce',
                'rate_limit' => 'default'
            ],
            'sr_staff_mark_paid' => [
                'callback' => [$this, 'staff_mark_paid'],
                'capability' => 'sr_mark_paid',
                'nonce' => 'sr_staff_nonce',
                'rate_limit' => 'default'
            ],
            'sr_staff_list_all_users' => [
                'callback' => [$this, 'staff_list_all_users'],
                'capability' => 'sr_view_staff',
                'nonce' => 'sr_staff_nonce',
                'rate_limit' => 'default',
                'cache_duration' => 5 * MINUTE_IN_SECONDS
            ],
            'sr_staff_add_family' => [
                'callback' => [$this, 'staff_add_family'],
                'capability' => 'sr_create_users',
                'nonce' => 'sr_staff_nonce',
                'rate_limit' => 'default'
            ],
            'sr_staff_add_prof' => [
                'callback' => [$this, 'staff_add_prof'],
                'capability' => 'sr_create_users',
                'nonce' => 'sr_staff_nonce',
                'rate_limit' => 'default'
            ],
            
            // ─── RECHERCHE ET FILTRES ───
            'sr_search_users' => [
                'callback' => [$this, 'search_users'],
                'capability' => 'sr_manage_users',
                'nonce' => 'sr_admin_nonce',
                'rate_limit' => 'search',
                'cache_duration' => 2 * MINUTE_IN_SECONDS
            ],
            'sr_filter_offers' => [
                'callback' => [$this, 'filter_offers'],
                'capability' => 'sr_view_offers',
                'nonce' => 'sr_nonce',
                'rate_limit' => 'search'
            ],
            
            // ─── DIAGNOSTICS ET STATS ───
            'sr_get_stats' => [
                'callback' => [$this, 'get_system_stats'],
                'capability' => 'manage_options',
                'nonce' => 'sr_admin_nonce',
                'rate_limit' => 'default',
                'cache_duration' => 5 * MINUTE_IN_SECONDS
            ]
        ];
    }
    
    /**
     * Initialisation des hooks WordPress
     */
    private function init_hooks() {
        foreach ($this->handlers as $action => $config) {
            add_action("wp_ajax_{$action}", [$this, 'handle_ajax_request']);
            
            // Certaines actions peuvent être publiques (non connecté)
            if (isset($config['public']) && $config['public']) {
                add_action("wp_ajax_nopriv_{$action}", [$this, 'handle_ajax_request']);
            }
        }
    }
    
    /**
     * GESTIONNAIRE PRINCIPAL
     * ================================================================
     */
    
    /**
     * Gestionnaire principal pour toutes les requêtes AJAX
     */
    public function handle_ajax_request() {
        $action = $_POST['action'] ?? '';
        
        if (!isset($this->handlers[$action])) {
            $this->send_error('UNKNOWN_ACTION', 'Action AJAX inconnue');
            return;
        }
        
        $config = $this->handlers[$action];
        
        // Vérifications de sécurité
        $security_check = $this->verify_request_security($config);
        if ($security_check !== true) {
            $this->send_error($security_check['code'], $security_check['message']);
            return;
        }
        
        // Rate limiting
        if (!$this->check_rate_limit($config['rate_limit'] ?? 'default')) {
            $this->send_error('RATE_LIMIT_EXCEEDED', 'Trop de requêtes, veuillez patienter');
            return;
        }
        
        // Vérification cache
        $cache_key = $this->generate_cache_key($action, $_POST);
        if (isset($config['cache_duration'])) {
            $cached = $this->get_cached_response($cache_key);
            if ($cached !== false) {
                wp_send_json_success($cached);
                return;
            }
        }
        
        // Exécution du handler
        try {
            $result = call_user_func($config['callback']);
            
            // Mise en cache si configuré
            if (isset($config['cache_duration']) && $result !== false) {
                $this->cache_response($cache_key, $result, $config['cache_duration']);
            }
            
        } catch (Exception $e) {
            SR_Core::log("AJAX error in {$action}: " . $e->getMessage(), 'error');
            $this->send_error('HANDLER_ERROR', 'Erreur lors du traitement');
        }
    }
    
    /**
     * VÉRIFICATIONS DE SÉCURITÉ
     * ================================================================
     */
    
    /**
     * Vérification complète de la sécurité
     */
    private function verify_request_security($config) {
        // Vérification utilisateur connecté
        if (!is_user_logged_in()) {
            return ['code' => 'NOT_LOGGED_IN', 'message' => 'Connexion requise'];
        }
        
        // Vérification nonce
        $nonce_field = $config['nonce'] ?? 'sr_nonce';
        if (!check_ajax_referer($nonce_field, 'nonce', false)) {
            return ['code' => 'INVALID_NONCE', 'message' => 'Token de sécurité invalide'];
        }
        
        // Vérification capabilities
        if (isset($config['capability']) && !current_user_can($config['capability'])) {
            return ['code' => 'INSUFFICIENT_PERMISSIONS', 'message' => 'Permissions insuffisantes'];
        }
        
        return true;
    }
    
    /**
     * Vérification rate limiting
     */
    private function check_rate_limit($limit_type) {
        if (!isset(self::$rate_limits[$limit_type])) {
            return true; // Pas de limite définie
        }
        
        $config = self::$rate_limits[$limit_type];
        $user_id = get_current_user_id();
        $window_start = time() - $config['window'];
        
        $cache_key = "sr_rate_limit_{$limit_type}_{$user_id}_{$window_start}";
        $current_requests = intval(get_transient($cache_key));
        
        if ($current_requests >= $config['requests']) {
            return false;
        }
        
        // Incrémenter le compteur
        set_transient($cache_key, $current_requests + 1, $config['window']);
        
        return true;
    }
    
    /**
     * HANDLERS GÉOCODAGE ET UTILISATEURS
     * ================================================================
     */
    
    /**
     * Récupération des métadonnées utilisateur
     */
    public function get_user_meta() {
        $user_id = intval($_POST['user_id'] ?? 0);
        
        if (!$user_id || !get_userdata($user_id)) {
            $this->send_error('INVALID_USER', 'Utilisateur introuvable');
            return;
        }
        
        $database = SR_Core::get_module('database');
        $user_data = $database->get_user_complete_data($user_id, [
            'sr_addr1', 'sr_addr2', 'sr_postcode', 'sr_city', 'sr_country',
            'sr_subject', 'sr_level', 'sr_gender', 'sr_freq', 'sr_duration',
            'sr_period', 'sr_start', 'sr_rep_phone', 'sr_prof_phone',
            'sr_prof_subject'
        ]);
        
        if (!$user_data) {
            $this->send_error('DATA_ERROR', 'Impossible de récupérer les données');
            return;
        }
        
        wp_send_json_success($user_data);
    }
    
    /**
     * Sauvegarde des données utilisateur
     */
    public function save_user() {
        $user_id = intval($_POST['user_id'] ?? 0);
        
        if (!$user_id || !get_userdata($user_id)) {
            $this->send_error('INVALID_USER', 'Utilisateur introuvable');
            return;
        }
        
        // Validation et nettoyage des données
        $allowed_fields = [
            'sr_addr1', 'sr_addr2', 'sr_postcode', 'sr_city', 'sr_country',
            'sr_subject', 'sr_level', 'sr_gender', 'sr_freq', 'sr_duration',
            'sr_start', 'sr_rep_phone', 'sr_prof_phone'
        ];
        
        $updates = [];
        $address_changed = false;
        
        foreach ($allowed_fields as $field) {
            if (isset($_POST[$field])) {
                $value = sanitize_text_field($_POST[$field]);
                $updates[$field] = $value;
                
                if (in_array($field, ['sr_addr1', 'sr_postcode', 'sr_city'])) {
                    $address_changed = true;
                }
            }
        }
        
        // Traitement spécial périodes
        if (isset($_POST['sr_period']) && is_array($_POST['sr_period'])) {
            $periods = array_map('sanitize_text_field', $_POST['sr_period']);
            $updates['sr_period'] = implode(',', $periods);
        }
        
        if (empty($updates)) {
            $this->send_error('NO_CHANGES', 'Aucune modification détectée');
            return;
        }
        
        // Mise à jour en base
        $database = SR_Core::get_module('database');
        $success = $database->batch_update_user_meta([$user_id => $updates]);
        
        if (!$success) {
            $this->send_error('UPDATE_FAILED', 'Échec de la mise à jour');
            return;
        }
        
        // Géocodage si adresse modifiée
        $geocoded = false;
        if ($address_changed) {
            $geocoding = SR_Core::get_module('geocoding');
            if ($geocoding) {
                $geocoded = $geocoding::geocode_user($user_id);
            }
        }
        
        wp_send_json_success([
            'updated_fields' => count($updates),
            'geocoded' => $geocoded,
            'address_changed' => $address_changed
        ]);
    }
    
    /**
     * Test de géocodage
     */
    public function test_geocoding() {
        $postcode = sanitize_text_field($_POST['postcode'] ?? '');
        $city = sanitize_text_field($_POST['city'] ?? '');
        
        if (!$postcode) {
            $this->send_error('MISSING_POSTCODE', 'Code postal requis');
            return;
        }
        
        $geocoding = SR_Core::get_module('geocoding');
        if (!$geocoding) {
            $this->send_error('MODULE_ERROR', 'Module géocodage non disponible');
            return;
        }
        
        $result = $geocoding::test_geocoding($postcode, $city);
        
        if ($result) {
            wp_send_json_success([
                'result' => $result,
                'stats' => $geocoding::get_geocoding_stats()
            ]);
        } else {
            $this->send_error('GEOCODING_FAILED', 'Géocodage impossible pour cette adresse');
        }
    }
    
    /**
     * HANDLERS PROFESSEURS
     * ================================================================
     */
    
    /**
     * Liste des élèves d'un professeur
     */
    public function get_students() {
        $prof_id = intval($_POST['prof_id'] ?? 0);
        
        if (!$prof_id) {
            $this->send_error('MISSING_PROF_ID', 'ID professeur manquant');
            return;
        }
        
        $database = SR_Core::get_module('database');
        
        // Récupération des demandes approuvées
        $requests = get_posts([
            'post_type' => 'sr_request',
            'meta_query' => [
                ['key' => '_sr_prof', 'value' => $prof_id],
                ['key' => '_sr_status', 'value' => 'approved']
            ],
            'numberposts' => -1,
            'fields' => 'ids'
        ]);
        
        $students = [];
        foreach ($requests as $request_id) {
            $family_id = intval(get_post_meta($request_id, '_sr_family', true));
            if (!$family_id) continue;
            
            $user_data = $database->get_user_complete_data($family_id);
            if (!$user_data) continue;
            
            $students[] = [
                'family_id' => $family_id,
                'name' => $user_data['display_name'],
                'class' => $user_data['sr_level'] ?? '',
                'subject' => $user_data['sr_subject'] ?? '',
                'freq' => $user_data['sr_freq'] ?? '',
                'duration' => $user_data['sr_duration'] ?? '',
                'status' => 'Confirmé',
                'address' => $this->format_address($user_data),
                'lat' => floatval($user_data['sr_lat'] ?? 0),
                'lng' => floatval($user_data['sr_lng'] ?? 0),
                'phone' => $user_data['sr_rep_phone'] ?? $user_data['sr_prof_phone'] ?? ''
            ];
        }
        
        wp_send_json_success($students);
    }
    
    /**
     * Envoi d'une demande de cours
     */
    public function send_request() {
        $family_id = intval($_POST['family_id'] ?? 0);
        $prof_id = intval($_POST['prof_id'] ?? 0);
        
        if (!$family_id || !$prof_id) {
            $this->send_error('MISSING_IDS', 'Identifiants manquants');
            return;
        }
        
        if (!get_userdata($family_id) || !get_userdata($prof_id)) {
            $this->send_error('INVALID_USERS', 'Utilisateurs invalides');
            return;
        }
        
        $requests_module = SR_Core::get_module('requests');
        if (!$requests_module) {
            $this->send_error('MODULE_ERROR', 'Module demandes non disponible');
            return;
        }
        
        $result = $requests_module->create_request($prof_id, $family_id, [
            '_sr_ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            '_sr_user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
        ]);
        
        if (is_wp_error($result)) {
            $this->send_error('REQUEST_FAILED', $result->get_error_message());
            return;
        }
        
        wp_send_json_success(['request_id' => $result]);
    }
    
    /**
     * Déclaration d'heures
     */
    public function declare_hours() {
        $prof_id = intval($_POST['prof_id'] ?? 0);
        $family_id = intval($_POST['family_id'] ?? 0);
        $hours = floatval($_POST['hours'] ?? 0);
        $subject = sanitize_text_field($_POST['subject'] ?? '');
        
        if (!$prof_id || !$family_id) {
            $this->send_error('MISSING_IDS', 'Identifiants manquants');
            return;
        }
        
        if ($hours <= 0 || $hours > 10) {
            $this->send_error('INVALID_HOURS', 'Nombre d\'heures invalide (0.5-10h)');
            return;
        }
        
        // Vérification affectation existante
        $assignment = get_posts([
            'post_type' => 'sr_request',
            'numberposts' => 1,
            'fields' => 'ids',
            'meta_query' => [
                ['key' => '_sr_prof', 'value' => $prof_id],
                ['key' => '_sr_family', 'value' => $family_id],
                ['key' => '_sr_status', 'value' => 'approved']
            ]
        ]);
        
        if (!$assignment) {
            $this->send_error('NO_ASSIGNMENT', 'Aucune affectation trouvée');
            return;
        }
        
        // Récupération matière si non fournie
        if (!$subject) {
            $subject = get_user_meta($family_id, 'sr_subject', true);
        }
        
        // Création de la déclaration
        $course_id = wp_insert_post([
            'post_type' => 'sr_course',
            'post_status' => 'publish',
            'post_title' => sprintf('Cours %sh - prof %d / famille %d', $hours, $prof_id, $family_id),
            'meta_input' => [
                '_sr_prof' => $prof_id,
                '_sr_family' => $family_id,
                '_sr_hours' => $hours,
                '_sr_subject' => $subject,
                '_sr_status' => 'pending',
                '_sr_date' => current_time('mysql'),
                '_sr_auto_validate_at' => date('Y-m-d H:i:s', time() + (48 * HOUR_IN_SECONDS)),
                '_sr_declared_ip' => $_SERVER['REMOTE_ADDR'] ?? ''
            ]
        ]);
        
        if (is_wp_error($course_id)) {
            $this->send_error('CREATION_FAILED', 'Échec de création');
            return;
        }
        
        // Notification famille
        $notifications = SR_Core::get_module('notifications');
        if ($notifications) {
            $notifications->notify_hours_declared($course_id, $prof_id, $family_id, $hours);
        }
        
        wp_send_json_success(['course_id' => $course_id]);
    }
    
    /**
     * Synthèse des heures
     */
    public function hours_summary() {
        $prof_id = intval($_POST['prof_id'] ?? 0);
        $family_id = intval($_POST['family_id'] ?? 0);
        
        if (!$prof_id || !$family_id) {
            $this->send_error('MISSING_IDS', 'Identifiants manquants');
            return;
        }
        
        $database = SR_Core::get_module('database');
        if (!$database) {
            $this->send_error('MODULE_ERROR', 'Module base de données non disponible');
            return;
        }
        
        global $wpdb;
        
        $summary = $wpdb->get_results($wpdb->prepare("
            SELECT 
                COALESCE(pm_status.meta_value, 'pending') as status,
                SUM(CAST(pm_hours.meta_value AS DECIMAL(5,2))) as total_hours
            FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm_prof ON p.ID = pm_prof.post_id AND pm_prof.meta_key = '_sr_prof'
            JOIN {$wpdb->postmeta} pm_family ON p.ID = pm_family.post_id AND pm_family.meta_key = '_sr_family'
            JOIN {$wpdb->postmeta} pm_hours ON p.ID = pm_hours.post_id AND pm_hours.meta_key = '_sr_hours'
            LEFT JOIN {$wpdb->postmeta} pm_status ON p.ID = pm_status.post_id AND pm_status.meta_key = '_sr_status'
            WHERE p.post_type = 'sr_course'
              AND pm_prof.meta_value = %d
              AND pm_family.meta_value = %d
            GROUP BY COALESCE(pm_status.meta_value, 'pending')
        ", $prof_id, $family_id));
        
        $result = ['paid' => 0, 'advance' => 0, 'pending' => 0];
        foreach ($summary as $row) {
            $status = $row->status ?: 'pending';
            $result[$status] = floatval($row->total_hours);
        }
        
        wp_send_json_success($result);
    }
    
    /**
     * HANDLERS INTERFACE STAFF
     * ================================================================
     */
    
    /**
     * Liste des demandes pour le staff
     */
    public function staff_list_requests() {
        $requests = get_posts([
            'post_type' => 'sr_request',
            'post_status' => 'any',
            'numberposts' => 100,
            'orderby' => 'date',
            'order' => 'DESC',
            'meta_query' => [
                'relation' => 'OR',
                ['key' => '_sr_status', 'value' => 'pending'],
                ['key' => '_sr_status', 'compare' => 'NOT EXISTS'],
                ['key' => '_sr_status', 'value' => ['', ' '], 'compare' => 'IN']
            ]
        ]);
        
        $formatted = [];
        foreach ($requests as $request) {
            $prof_id = intval(get_post_meta($request->ID, '_sr_prof', true));
            $family_id = intval(get_post_meta($request->ID, '_sr_family', true));
            
            $formatted[] = [
                'id' => $request->ID,
                'date' => $request->post_date,
                'prof' => $prof_id ? get_userdata($prof_id)->display_name : '—',
                'family' => $family_id ? get_userdata($family_id)->display_name : '—',
                'city' => $family_id ? (get_user_meta($family_id, 'sr_postcode', true) . ' ' . get_user_meta($family_id, 'sr_city', true)) : '',
                'subject' => $family_id ? get_user_meta($family_id, 'sr_subject', true) : ''
            ];
        }
        
        wp_send_json_success($formatted);
    }
    
    /**
     * Approbation d'une demande par le staff
     */
    public function staff_approve_request() {
        $request_id = intval($_POST['request_id'] ?? 0);
        
        if (!$request_id) {
            $this->send_error('INVALID_REQUEST', 'Demande invalide');
            return;
        }
        
        $requests_module = SR_Core::get_module('requests');
        if (!$requests_module) {
            $this->send_error('MODULE_ERROR', 'Module demandes non disponible');
            return;
        }
        
        $result = $requests_module->approve_request($request_id, get_current_user_id());
        
        if (is_wp_error($result)) {
            $this->send_error('APPROVAL_FAILED', $result->get_error_message());
            return;
        }
        
        wp_send_json_success(['request_id' => $request_id, 'status' => 'approved']);
    }
    
    /**
     * Rejet d'une demande par le staff
     */
    public function staff_reject_request() {
        $request_id = intval($_POST['request_id'] ?? 0);
        $reason = sanitize_textarea_field($_POST['reason'] ?? '');
        
        if (!$request_id) {
            $this->send_error('INVALID_REQUEST', 'Demande invalide');
            return;
        }
        
        $requests_module = SR_Core::get_module('requests');
        if (!$requests_module) {
            $this->send_error('MODULE_ERROR', 'Module demandes non disponible');
            return;
        }
        
        $result = $requests_module->reject_request($request_id, $reason, get_current_user_id());
        
        if (is_wp_error($result)) {
            $this->send_error('REJECTION_FAILED', $result->get_error_message());
            return;
        }
        
        wp_send_json_success(['request_id' => $request_id, 'status' => 'rejected']);
    }
    
    /**
     * UTILITAIRES ET CACHE
     * ================================================================
     */
    
    /**
     * Génération de clé de cache
     */
    private function generate_cache_key($action, $params) {
        $key_parts = [$action, get_current_user_id()];
        
        // Ajout des paramètres significatifs
        $significant_params = ['user_id', 'prof_id', 'family_id', 'postcode'];
        foreach ($significant_params as $param) {
            if (isset($params[$param])) {
                $key_parts[] = $params[$param];
            }
        }
        
        return 'sr_ajax_' . md5(implode('_', $key_parts));
    }
    
    /**
     * Récupération réponse en cache
     */
    private function get_cached_response($cache_key) {
        return get_transient($cache_key);
    }
    
    /**
     * Mise en cache d'une réponse
     */
    private function cache_response($cache_key, $data, $duration) {
        set_transient($cache_key, $data, $duration);
    }
    
    /**
     * Formatage d'une adresse
     */
    private function format_address($user_data) {
        $parts = [
            $user_data['sr_addr1'] ?? '',
            $user_data['sr_postcode'] ?? '',
            $user_data['sr_city'] ?? ''
        ];
        
        return trim(implode(' ', array_filter($parts)));
    }
    
    /**
     * Envoi d'une erreur JSON standardisée
     */
    private function send_error($code, $message) {
        wp_send_json_error([
            'code' => $code,
            'message' => $message,
            'timestamp' => current_time('mysql')
        ]);
    }
    
    /**
     * Handlers placeholder pour les méthodes staff non détaillées
     */
    public function staff_list_assignments() {
        // Implementation similaire à staff_list_requests
        wp_send_json_success([]);
    }
    
    public function staff_break_assignment() {
        // Implementation rupture d'affectation
        wp_send_json_success(['status' => 'ended']);
    }
    
    public function staff_list_hours() {
        // Implementation liste heures déclarées
        wp_send_json_success([]);
    }
    
    public function staff_mark_paid() {
        // Implementation marquer payé
        wp_send_json_success(['status' => 'paid']);
    }
    
    public function staff_list_all_users() {
        // Implementation liste utilisateurs
        wp_send_json_success([]);
    }
    
    public function staff_add_family() {
        // Implementation ajout famille
        wp_send_json_success(['user_id' => 0]);
    }
    
    public function staff_add_prof() {
        // Implementation ajout professeur
        wp_send_json_success(['user_id' => 0]);
    }
    
    public function search_users() {
        // Implementation recherche utilisateurs
        wp_send_json_success([]);
    }
    
    public function filter_offers() {
        // Implementation filtres offres
        wp_send_json_success([]);
    }
    
    public function get_system_stats() {
        // Implementation statistiques système
        wp_send_json_success([]);
    }
    
    public function geocode_batch() {
        // Délégation au module géocodage
        $geocoding = SR_Core::get_module('geocoding');
        if ($geocoding) {
            return $geocoding->handle_batch_geocoding();
        }
        
        $this->send_error('MODULE_ERROR', 'Module géocodage non disponible');
    }
}