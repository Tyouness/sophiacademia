<?php
/**
 * ÉTAPE 1 : Structure de fichiers cible
 * 
 * /sophiacademia-plugin/
 * ├── staff-registrar.php (fichier principal allégé)
 * ├── includes/
 * │   ├── class-sr-core.php           // Configuration + autoloader
 * │   ├── class-sr-database.php       // Optimisations BDD
 * │   ├── class-sr-geocoding.php      // Cache géolocalisation
 * │   ├── class-sr-admin.php          // Menus admin
 * │   ├── class-sr-ajax.php           // Handlers AJAX
 * │   ├── class-sr-shortcodes.php     // Shortcodes front
 * │   ├── class-sr-users.php          // Gestion utilisateurs
 * │   ├── class-sr-requests.php       // Système demandes
 * │   └── class-sr-notifications.php  // Mails + notifications
 * └── assets/ (js, css)
 */

// ================================================================================
// NOUVEAU staff-registrar.php (fichier principal allégé)
// ================================================================================

/**
 * Plugin Name: Staff Registrar Optimized
 * Description: Version optimisée avec architecture modulaire
 * Version: 2.0.0
 * Author: Sophiacademia
 */

if (!defined('ABSPATH')) exit;

// Constantes du plugin
define('SR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SR_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SR_VERSION', '2.0.0');

// Chargement de la classe principale
require_once SR_PLUGIN_DIR . 'includes/class-sr-core.php';

// Initialisation
SR_Core::init();

// ================================================================================
// includes/class-sr-core.php - Gestionnaire principal
// ================================================================================

class SR_Core {
    
    private static $instance = null;
    private static $modules = [];
    
    public static function init() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->define_constants();
        $this->init_hooks();
        $this->load_modules();
    }
    
    private function define_constants() {
        define('SR_GEOCODE_KEY', get_option('sr_geocode_key', ''));
        define('SR_BCC_AGENCE', get_option('sr_bcc_email', 'agence@sophiacademia.fr'));
        
        // Constantes optimisées pour la France
        define('SR_DEFAULT_COUNTRY', 'France');
        define('SR_DEFAULT_RADIUS', 25); // km
        define('SR_CACHE_DURATION', WEEK_IN_SECONDS);
    }
    
    private function init_hooks() {
        add_action('init', [$this, 'init_post_types']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        
        // Hook d'activation optimisé
        register_activation_hook(SR_PLUGIN_DIR . '../staff-registrar.php', [$this, 'activate']);
    }
    
    private function load_modules() {
        $modules = [
            'database'      => 'SR_Database',
            'geocoding'     => 'SR_Geocoding', 
            'admin'         => 'SR_Admin',
            'ajax'          => 'SR_Ajax',
            'shortcodes'    => 'SR_Shortcodes',
            'users'         => 'SR_Users',
            'requests'      => 'SR_Requests',
            'notifications' => 'SR_Notifications'
        ];
        
        foreach ($modules as $key => $class) {
            $file = SR_PLUGIN_DIR . "includes/class-sr-{$key}.php";
            if (file_exists($file)) {
                require_once $file;
                if (class_exists($class)) {
                    self::$modules[$key] = new $class();
                }
            }
        }
    }
    
    public static function get_module($name) {
        return self::$modules[$name] ?? null;
    }
    
    public function init_post_types() {
        // Post types optimisés
        register_post_type('sr_request', [
            'public' => false,
            'show_ui' => false,
            'supports' => ['custom-fields'],
            'capability_type' => 'sr_request',
            'capabilities' => [
                'create_posts' => 'sr_create_requests',
                'edit_posts' => 'sr_edit_requests',
                'read_posts' => 'sr_read_requests',
            ]
        ]);
        
        register_post_type('sr_course', [
            'public' => false,
            'show_ui' => false,
            'supports' => ['custom-fields'],
            'capability_type' => 'sr_course'
        ]);
    }
    
    public function enqueue_assets() {
        // Chargement conditionnel des assets
        if (!is_admin() && is_user_logged_in()) {
            $user = wp_get_current_user();
            
            // CSS commun
            wp_enqueue_style('sr-core', 
                SR_PLUGIN_URL . 'assets/css/sr-core.css', 
                [], SR_VERSION);
            
            // Assets spécifiques par rôle
            if (in_array('um_professeur', $user->roles)) {
                $this->enqueue_professor_assets();
            } elseif (in_array('um_famille', $user->roles)) {
                $this->enqueue_family_assets();
            } elseif (in_array('sr_staff', $user->roles)) {
                $this->enqueue_staff_assets();
            }
        }
    }
    
    private function enqueue_professor_assets() {
        wp_enqueue_style('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        wp_enqueue_script('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', [], null, true);
        
        wp_enqueue_style('sr-offers', SR_PLUGIN_URL . 'assets/css/sr-offers.css', ['sr-core'], SR_VERSION);
        wp_enqueue_script('sr-offers', SR_PLUGIN_URL . 'assets/js/sr-offers.js', ['jquery', 'leaflet'], SR_VERSION, true);
    }
    
    public function activate() {
        // Création des rôles optimisée
        $this->create_roles();
        $this->create_database_indexes();
        flush_rewrite_rules();
    }
    
    private function create_roles() {
        // Rôles avec capabilities granulaires
        add_role('sr_staff', 'Staff Sophiacademia', [
            'read' => true,
            'sr_view_dashboard' => true,
            'sr_manage_requests' => true,
            'sr_manage_assignments' => true,
            'sr_view_hours' => true
        ]);
    }
    
    private function create_database_indexes() {
        global $wpdb;
        
        // Index pour optimiser les requêtes géographiques
        $wpdb->query("
            CREATE INDEX IF NOT EXISTS idx_sr_lat 
            ON {$wpdb->usermeta} (meta_key, meta_value) 
            WHERE meta_key = 'sr_lat'
        ");
        
        $wpdb->query("
            CREATE INDEX IF NOT EXISTS idx_sr_lng 
            ON {$wpdb->usermeta} (meta_key, meta_value) 
            WHERE meta_key = 'sr_lng'
        ");
    }
}

// ================================================================================
// includes/class-sr-database.php - Optimisations BDD
// ================================================================================

class SR_Database {
    
    private static $query_cache = [];
    
    public function __construct() {
        add_action('init', [$this, 'init_cache']);
    }
    
    public function init_cache() {
        // Cache des requêtes fréquentes en mémoire
        if (!wp_using_ext_object_cache()) {
            wp_cache_add_global_groups(['sr_geo_queries', 'sr_user_queries']);
        }
    }
    
    /**
     * Requête géographique optimisée avec cache et bounding box
     */
    public function get_families_in_radius($prof_lat, $prof_lng, $radius_km = 25) {
        $cache_key = "families_radius_{$prof_lat}_{$prof_lng}_{$radius_km}";
        
        // Vérification cache
        $cached = wp_cache_get($cache_key, 'sr_geo_queries');
        if ($cached !== false) {
            return $cached;
        }
        
        global $wpdb;
        
        // Pré-filtrage par bounding box (performance)
        $lat_delta = $radius_km / 111; // ~111km par degré de latitude
        $lng_delta = $radius_km / (111 * cos(deg2rad($prof_lat)));
        
        $results = $wpdb->get_results($wpdb->prepare("
            SELECT u.ID, u.display_name,
                   lat.meta_value as lat, lng.meta_value as lng,
                   city.meta_value as city, pc.meta_value as postcode,
                   level.meta_value as level, subject.meta_value as subject,
                   (6371 * acos(
                       cos(radians(%f)) * cos(radians(lat.meta_value)) * 
                       cos(radians(lng.meta_value) - radians(%f)) + 
                       sin(radians(%f)) * sin(radians(lat.meta_value))
                   )) AS distance
            FROM {$wpdb->users} u
            JOIN {$wpdb->usermeta} lat ON lat.user_id = u.ID AND lat.meta_key = 'sr_lat'
            JOIN {$wpdb->usermeta} lng ON lng.user_id = u.ID AND lng.meta_key = 'sr_lng'
            LEFT JOIN {$wpdb->usermeta} city ON city.user_id = u.ID AND city.meta_key = 'sr_city'
            LEFT JOIN {$wpdb->usermeta} pc ON pc.user_id = u.ID AND pc.meta_key = 'sr_postcode'
            LEFT JOIN {$wpdb->usermeta} level ON level.user_id = u.ID AND level.meta_key = 'sr_level'
            LEFT JOIN {$wpdb->usermeta} subject ON subject.user_id = u.ID AND subject.meta_key = 'sr_subject'
            WHERE lat.meta_value BETWEEN %f AND %f
              AND lng.meta_value BETWEEN %f AND %f
              AND EXISTS (
                  SELECT 1 FROM {$wpdb->usermeta} role 
                  WHERE role.user_id = u.ID 
                  AND role.meta_key = '{$wpdb->prefix}capabilities' 
                  AND role.meta_value LIKE '%um_famille%'
              )
            HAVING distance <= %f
            ORDER BY distance ASC
        ", 
            $prof_lat, $prof_lng, $prof_lat,
            $prof_lat - $lat_delta, $prof_lat + $lat_delta,
            $prof_lng - $lng_delta, $prof_lng + $lng_delta,
            $radius_km
        ));
        
        // Cache 1 heure
        wp_cache_set($cache_key, $results, 'sr_geo_queries', HOUR_IN_SECONDS);
        
        return $results;
    }
    
    /**
     * Vérifie l'attribution avec une seule requête optimisée
     */
    public function check_family_availability($family_ids) {
        if (empty($family_ids)) return [];
        
        global $wpdb;
        $placeholders = implode(',', array_fill(0, count($family_ids), '%d'));
        
        $assigned = $wpdb->get_col($wpdb->prepare("
            SELECT DISTINCT pm.meta_value
            FROM {$wpdb->postmeta} pm
            JOIN {$wpdb->postmeta} status ON status.post_id = pm.post_id
            WHERE pm.meta_key = '_sr_family'
              AND pm.meta_value IN ($placeholders)
              AND status.meta_key = '_sr_status'
              AND status.meta_value IN ('approved', 'pending')
        ", ...$family_ids));
        
        return array_map('intval', $assigned);
    }
    
    /**
     * Batch update pour améliorer les performances
     */
    public function batch_update_user_meta($updates) {
        global $wpdb;
        
        $wpdb->query('START TRANSACTION');
        
        try {
            foreach ($updates as $user_id => $meta_data) {
                foreach ($meta_data as $key => $value) {
                    $wpdb->replace(
                        $wpdb->usermeta,
                        [
                            'user_id' => $user_id,
                            'meta_key' => $key,
                            'meta_value' => $value
                        ],
                        ['%d', '%s', '%s']
                    );
                }
            }
            $wpdb->query('COMMIT');
            return true;
        } catch (Exception $e) {
            $wpdb->query('ROLLBACK');
            return false;
        }
    }
}

// ================================================================================
// includes/class-sr-geocoding.php - Cache géolocalisation France
// ================================================================================

class SR_Geocoding {
    
    private static $cp_cache = [];
    private static $major_cities = [
        '75001' => ['Paris', 48.8566, 2.3522],
        '69001' => ['Lyon', 45.7640, 4.8357],
        '13001' => ['Marseille', 43.2965, 5.3698],
        '31000' => ['Toulouse', 43.6047, 1.4442],
        '33000' => ['Bordeaux', 44.8378, -0.5792],
        // ... Ajouter les 100 principales villes
    ];
    
    public function __construct() {
        add_action('wp_ajax_sr_geocode_batch', [$this, 'handle_batch_geocoding']);
    }
    
    /**
     * Géocodage optimisé France avec cache persistant
     */
    public static function geocode_address($address, $postcode = '', $city = '', $country = 'France') {
        // Normalisation code postal français
        $normalized_cp = self::normalize_postcode($postcode);
        
        // Cache hit pour villes principales
        if (isset(self::$major_cities[$normalized_cp])) {
            $data = self::$major_cities[$normalized_cp];
            return [
                'city' => $data[0],
                'lat' => $data[1],
                'lng' => $data[2],
                'source' => 'cache_major'
            ];
        }
        
        // Cache transient
        $cache_key = 'sr_geo_' . md5($address . $postcode . $city);
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            return $cached;
        }
        
        // Appel API Google optimisé
        $result = self::call_google_api($address, $postcode, $city, $country);
        
        if ($result) {
            // Cache 1 mois pour les adresses valides
            set_transient($cache_key, $result, MONTH_IN_SECONDS);
            
            // Cache en mémoire pour la session
            self::$cp_cache[$normalized_cp] = $result;
        }
        
        return $result;
    }
    
    private static function normalize_postcode($postcode) {
        $clean = preg_replace('/\D/', '', $postcode);
        return str_pad($clean, 5, '0', STR_PAD_LEFT);
    }
    
    private static function call_google_api($address, $postcode, $city, $country) {
        $key = SR_GEOCODE_KEY;
        if (!$key) return false;
        
        // Construction requête optimisée pour la France
        $query_parts = array_filter([$address, $postcode, $city, $country]);
        $query = implode(', ', $query_parts);
        
        $url = add_query_arg([
            'address' => $query,
            'key' => $key,
            'region' => 'fr', // Biais France
            'language' => 'fr'
        ], 'https://maps.googleapis.com/maps/api/geocode/json');
        
        $response = wp_remote_get($url, [
            'timeout' => 5,
            'user-agent' => 'Sophiacademia/2.0'
        ]);
        
        if (is_wp_error($response)) return false;
        
        $data = json_decode(wp_remote_retrieve_body($response), true);
        
        if ($data['status'] === 'OK' && !empty($data['results'])) {
            $result = $data['results'][0];
            return [
                'city' => self::extract_city($result),
                'lat' => $result['geometry']['location']['lat'],
                'lng' => $result['geometry']['location']['lng'],
                'formatted_address' => $result['formatted_address'],
                'source' => 'google_api'
            ];
        }
        
        return false;
    }
    
    private static function extract_city($result) {
        $components = $result['address_components'] ?? [];
        
        foreach ($components as $component) {
            $types = $component['types'] ?? [];
            if (in_array('locality', $types)) {
                return $component['long_name'];
            }
        }
        
        // Fallback
        foreach ($components as $component) {
            $types = $component['types'] ?? [];
            if (in_array('administrative_area_level_2', $types)) {
                return $component['long_name'];
            }
        }
        
        return '';
    }
    
    /**
     * Géocodage en lot pour l'import initial
     */
    public function handle_batch_geocoding() {
        check_ajax_referer('sr_batch_geocode', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Permission denied');
        }
        
        $batch_size = 10; // Limite Google API
        $users = get_users([
            'meta_query' => [
                [
                    'key' => 'sr_lat',
                    'compare' => 'NOT EXISTS'
                ]
            ],
            'number' => $batch_size
        ]);
        
        $processed = 0;
        foreach ($users as $user) {
            $address = get_user_meta($user->ID, 'sr_addr1', true);
            $postcode = get_user_meta($user->ID, 'sr_postcode', true);
            $city = get_user_meta($user->ID, 'sr_city', true);
            
            if ($address && $postcode) {
                $geo = self::geocode_address($address, $postcode, $city);
                if ($geo) {
                    update_user_meta($user->ID, 'sr_lat', $geo['lat']);
                    update_user_meta($user->ID, 'sr_lng', $geo['lng']);
                    if ($geo['city'] && !$city) {
                        update_user_meta($user->ID, 'sr_city', $geo['city']);
                    }
                    $processed++;
                }
                
                // Rate limiting Google API
                usleep(200000); // 200ms entre requêtes
            }
        }
        
        wp_send_json_success([
            'processed' => $processed,
            'remaining' => count($users) - $processed
        ]);
    }
}

// ================================================================================
// MIGRATION ÉTAPE PAR ÉTAPE
// ================================================================================

/**
 * ÉTAPE 1 : Créer la structure de base
 * 1. Créer le dossier includes/
 * 2. Créer class-sr-core.php
 * 3. Modifier staff-registrar.php pour charger SR_Core
 * 4. Tester que tout fonctionne encore
 * 
 * ÉTAPE 2 : Migrer les constantes et configuration
 * 1. Déplacer les define() vers SR_Core::define_constants()
 * 2. Ajouter la gestion d'options WordPress
 * 3. Tester
 * 
 * ÉTAPE 3 : Migrer la gestion BDD
 * 1. Créer SR_Database avec les requêtes optimisées
 * 2. Remplacer progressivement dans le code principal
 * 3. Ajouter les index de performance
 * 
 * ÉTAPE 4 : Migrer le géocodage
 * 1. Créer SR_Geocoding avec cache France
 * 2. Remplacer sr_geocode_user()
 * 3. Implémenter le géocodage en lot
 * 
 * ÉTAPE 5 : Migrer les autres modules
 * 1. SR_Admin (menus)
 * 2. SR_Ajax (handlers AJAX)  
 * 3. SR_Shortcodes
 * 4. SR_Users, SR_Requests, SR_Notifications
 * 
 * ÉTAPE 6 : Optimisations finales
 * 1. Nettoyage du code legacy
 * 2. Tests de performance
 * 3. Documentation
 */