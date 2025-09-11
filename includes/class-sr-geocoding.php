<?php
/**
 * includes/class-sr-geocoding.php
 * Géolocalisation automatique universelle pour TOUS les codes postaux français
 * 
 * @package Sophiacademia
 * @version 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class SR_Geocoding {
    
    /**
     * Cache mémoire pour la session
     */
    private static $memory_cache = [];
    
    /**
     * APIs disponibles pour géocodage (par ordre de priorité)
     */
    private static $apis_config = [
        'gouvernement' => [
            'url' => 'https://api-adresse.data.gouv.fr/search/',
            'rate_limit' => 50, // req/sec
            'cost' => 'free',
            'quality' => 'high',
            'enabled' => true
        ],
        'nominatim' => [
            'url' => 'https://nominatim.openstreetmap.org/search',
            'rate_limit' => 1, // req/sec
            'cost' => 'free', 
            'quality' => 'medium',
            'enabled' => true
        ],
        'google' => [
            'url' => 'https://maps.googleapis.com/maps/api/geocode/json',
            'rate_limit' => 5, // req/sec
            'cost' => 'paid',
            'quality' => 'high',
            'enabled' => true // Se base sur SR_GEOCODE_KEY
        ]
    ];
    
    /**
     * Statistiques d'utilisation par API
     */
    private static $stats = [
        'gouvernement' => ['calls' => 0, 'success' => 0, 'cache_hits' => 0],
        'nominatim' => ['calls' => 0, 'success' => 0, 'cache_hits' => 0],
        'google' => ['calls' => 0, 'success' => 0, 'cache_hits' => 0]
    ];
    
    public function __construct() {
        $this->init_hooks();
    }
    
    /**
     * GÉOCODAGE AUTOMATIQUE UNIVERSEL - Point d'entrée unique
     * ================================================================
     */
    
    /**
     * Géocodage automatique pour N'IMPORTE QUEL code postal français
     */
    public static function geocode_address($address, $postcode = '', $city = '', $country = 'France') {
        $normalized_postcode = self::normalize_french_postcode($postcode);
        if (!$normalized_postcode) {
            return false;
        }
        
        // Génération clé de cache unique
        $cache_key = self::generate_cache_key($address, $normalized_postcode, $city);
        
        // 1. Vérification cache transient (1er niveau)
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            self::$stats['cache']['hits']++;
            return $cached;
        }
        
        // 2. Vérification cache mémoire (2e niveau)
        if (isset(self::$memory_cache[$cache_key])) {
            return self::$memory_cache[$cache_key];
        }
        
        // 3. Appel APIs par ordre de priorité
        $result = self::geocode_via_cascade($address, $normalized_postcode, $city);
        
        if ($result) {
            // Stockage dans tous les caches
            self::store_in_all_caches($cache_key, $result);
        }
        
        return $result;
    }
    
    /**
     * Cascade d'APIs : Gouvernement → Nominatim → Google
     */
    private static function geocode_via_cascade($address, $postcode, $city) {
        $apis_order = ['gouvernement', 'nominatim', 'google'];
        
        foreach ($apis_order as $api_name) {
            $config = self::$apis_config[$api_name];
            
            // Vérification si API activée
            if (!$config['enabled']) {
                continue;
            }
            
            // Vérification clé Google si nécessaire
            if ($api_name === 'google' && !SR_GEOCODE_KEY) {
                continue;
            }
            
            // Vérification rate limiting
            if (!self::check_api_rate_limit($api_name)) {
                continue;
            }
            
            // Tentative de géocodage
            $result = self::call_api($api_name, $address, $postcode, $city);
            
            if ($result) {
                $result['source'] = $api_name;
                self::$stats[$api_name]['success']++;
                return $result;
            }
        }
        
        return false;
    }
    
    /**
     * APIS SPÉCIALISÉES FRANCE
     * ================================================================
     */
    
    /**
     * API Adresse du Gouvernement français (GRATUITE et PRÉCISE)
     */
    private static function call_api_gouvernement($address, $postcode, $city) {
        // Construction requête optimisée
        $query_parts = array_filter([$address, $city]);
        $query = implode(' ', $query_parts);
        
        $url = add_query_arg([
            'q' => $query,
            'postcode' => $postcode,
            'limit' => 1,
            'type' => 'housenumber' // Plus précis que 'street'
        ], self::$apis_config['gouvernement']['url']);
        
        $response = wp_remote_get($url, [
            'timeout' => 5,
            'user-agent' => 'Sophiacademia/2.0'
        ]);
        
        if (is_wp_error($response)) {
            return false;
        }
        
        $data = json_decode(wp_remote_retrieve_body($response), true);
        if (!$data || empty($data['features'])) {
            return false;
        }
        
        $feature = $data['features'][0];
        $coords = $feature['geometry']['coordinates'] ?? null;
        $props = $feature['properties'] ?? [];
        
        if (!$coords || count($coords) < 2) {
            return false;
        }
        
        return [
            'lat' => floatval($coords[1]), // Attention : lon,lat dans GeoJSON
            'lng' => floatval($coords[0]),
            'city' => $props['city'] ?? $city,
            'postcode' => $props['postcode'] ?? $postcode,
            'formatted_address' => sprintf('%s, %s %s', 
                $props['name'] ?? $address,
                $props['postcode'] ?? $postcode,
                $props['city'] ?? $city
            ),
            'quality' => self::determine_quality_gouvernement($props),
            'source' => 'gouvernement'
        ];
    }
    
    /**
     * API Nominatim OpenStreetMap (GRATUITE)
     */
    private static function call_api_nominatim($address, $postcode, $city) {
        $query = sprintf('%s, %s %s, France', $address, $postcode, $city);
        
        $url = add_query_arg([
            'q' => $query,
            'format' => 'json',
            'limit' => 1,
            'countrycodes' => 'fr',
            'addressdetails' => 1
        ], self::$apis_config['nominatim']['url']);
        
        $response = wp_remote_get($url, [
            'timeout' => 8,
            'user-agent' => 'Sophiacademia/2.0 (contact@sophiacademia.fr)'
        ]);
        
        if (is_wp_error($response)) {
            return false;
        }
        
        $data = json_decode(wp_remote_retrieve_body($response), true);
        if (!$data || empty($data)) {
            return false;
        }
        
        $result = $data[0];
        
        return [
            'lat' => floatval($result['lat']),
            'lng' => floatval($result['lon']),
            'city' => $result['address']['city'] ?? $result['address']['town'] ?? $result['address']['village'] ?? $city,
            'postcode' => $result['address']['postcode'] ?? $postcode,
            'formatted_address' => $result['display_name'] ?? '',
            'quality' => self::determine_quality_nominatim($result),
            'source' => 'nominatim'
        ];
    }
    
    /**
     * API Google (PAYANTE mais très précise)
     */
    private static function call_api_google($address, $postcode, $city) {
        if (!SR_GEOCODE_KEY) {
            return false;
        }
        
        $query = sprintf('%s, %s %s, France', $address, $postcode, $city);
        
        $url = add_query_arg([
            'address' => $query,
            'key' => SR_GEOCODE_KEY,
            'region' => 'fr',
            'language' => 'fr',
            'components' => 'country:FR'
        ], self::$apis_config['google']['url']);
        
        $response = wp_remote_get($url, [
            'timeout' => 5,
            'user-agent' => 'Sophiacademia/2.0'
        ]);
        
        if (is_wp_error($response)) {
            return false;
        }
        
        $data = json_decode(wp_remote_retrieve_body($response), true);
        if (!$data || $data['status'] !== 'OK' || empty($data['results'])) {
            return false;
        }
        
        $result = $data['results'][0];
        $location = $result['geometry']['location'];
        
        return [
            'lat' => floatval($location['lat']),
            'lng' => floatval($location['lng']),
            'city' => self::extract_city_from_google($result),
            'postcode' => self::extract_postcode_from_google($result),
            'formatted_address' => $result['formatted_address'],
            'quality' => self::determine_quality_google($result),
            'source' => 'google'
        ];
    }
    
    /**
     * DISPATCHER D'APIS
     * ================================================================
     */
    
    /**
     * Appel API générique avec gestion d'erreurs
     */
    private static function call_api($api_name, $address, $postcode, $city) {
        self::$stats[$api_name]['calls']++;
        
        // Rate limiting
        self::record_api_call($api_name);
        
        switch ($api_name) {
            case 'gouvernement':
                return self::call_api_gouvernement($address, $postcode, $city);
            case 'nominatim':
                return self::call_api_nominatim($address, $postcode, $city);
            case 'google':
                return self::call_api_google($address, $postcode, $city);
            default:
                return false;
        }
    }
    
    /**
     * RATE LIMITING PER API
     * ================================================================
     */
    
    /**
     * Vérification rate limit par API
     */
    private static function check_api_rate_limit($api_name) {
        $config = self::$apis_config[$api_name];
        $limit = $config['rate_limit'];
        
        $key = "sr_api_rate_{$api_name}_" . time();
        $count = intval(get_transient($key));
        
        return $count < $limit;
    }
    
    /**
     * Enregistrement appel API
     */
    private static function record_api_call($api_name) {
        $key = "sr_api_rate_{$api_name}_" . time();
        $count = intval(get_transient($key)) + 1;
        set_transient($key, $count, 2); // 2 secondes
        
        // Délai respectueux selon l'API
        switch ($api_name) {
            case 'nominatim':
                usleep(1100000); // 1.1 sec (rate limit strict)
                break;
            case 'gouvernement':
                usleep(50000); // 50ms (plus permissif)
                break;
            case 'google':
                usleep(200000); // 200ms
                break;
        }
    }
    
    /**
     * UTILITAIRES DE QUALITÉ
     * ================================================================
     */
    
    /**
     * Détermination qualité API Gouvernement
     */
    private static function determine_quality_gouvernement($properties) {
        $score = $properties['score'] ?? 0;
        
        if ($score >= 0.9) return 'high';
        if ($score >= 0.7) return 'medium';
        if ($score >= 0.5) return 'low';
        return 'very_low';
    }
    
    /**
     * Détermination qualité Nominatim
     */
    private static function determine_quality_nominatim($result) {
        $class = $result['class'] ?? '';
        $type = $result['type'] ?? '';
        
        if ($class === 'place' && in_array($type, ['house', 'building'])) {
            return 'high';
        }
        if ($class === 'highway' || $type === 'residential') {
            return 'medium';
        }
        return 'low';
    }
    
    /**
     * Détermination qualité Google
     */
    private static function determine_quality_google($result) {
        $type = $result['geometry']['location_type'] ?? '';
        
        switch ($type) {
            case 'ROOFTOP': return 'high';
            case 'RANGE_INTERPOLATED': return 'medium';
            case 'GEOMETRIC_CENTER': return 'low';
            default: return 'very_low';
        }
    }
    
    /**
     * EXTRACTION DE DONNÉES
     * ================================================================
     */
    
    /**
     * Extraction ville depuis résultat Google
     */
    private static function extract_city_from_google($result) {
        $components = $result['address_components'] ?? [];
        
        foreach ($components as $component) {
            $types = $component['types'] ?? [];
            if (in_array('locality', $types)) {
                return $component['long_name'];
            }
        }
        
        return '';
    }
    
    /**
     * Extraction code postal depuis résultat Google
     */
    private static function extract_postcode_from_google($result) {
        $components = $result['address_components'] ?? [];
        
        foreach ($components as $component) {
            $types = $component['types'] ?? [];
            if (in_array('postal_code', $types)) {
                return $component['long_name'];
            }
        }
        
        return '';
    }
    
    /**
     * NORMALISATION ET CACHE
     * ================================================================
     */
    
    /**
     * Normalisation code postal français (inchangé)
     */
    private static function normalize_french_postcode($postcode) {
        if (!$postcode) return false;
        
        $clean = preg_replace('/\D/', '', $postcode);
        if (strlen($clean) !== 5) return false;
        
        $numeric = intval($clean);
        if ($numeric < 1000 || $numeric > 98999) return false;
        
        return $clean;
    }
    
    /**
     * Génération clé de cache
     */
    private static function generate_cache_key($address, $postcode, $city) {
        return 'sr_geo_v2_' . md5(implode('|', array_filter([$address, $postcode, $city])));
    }
    
    /**
     * Stockage tous caches
     */
    private static function store_in_all_caches($cache_key, $result) {
        // Cache duration selon qualité
        $duration = MONTH_IN_SECONDS;
        if ($result['quality'] === 'very_low') {
            $duration = WEEK_IN_SECONDS;
        }
        
        set_transient($cache_key, $result, $duration);
        self::$memory_cache[$cache_key] = $result;
    }
    
    /**
     * INTERFACE SIMPLE POUR L'UTILISATEUR
     * ================================================================
     */
    
    /**
     * Géocodage d'un utilisateur (interface simplifiée)
     */
    public static function geocode_user($user_id) {
        $address = get_user_meta($user_id, 'sr_addr1', true);
        $postcode = get_user_meta($user_id, 'sr_postcode', true);
        $city = get_user_meta($user_id, 'sr_city', true);
        
        if (!$address || !$postcode) {
            return false;
        }
        
        $result = self::geocode_address($address, $postcode, $city);
        
        if ($result) {
            update_user_meta($user_id, 'sr_lat', $result['lat']);
            update_user_meta($user_id, 'sr_lng', $result['lng']);
            update_user_meta($user_id, 'sr_geocoded_at', current_time('mysql'));
            update_user_meta($user_id, 'sr_geocoded_source', $result['source']);
            
            // Mise à jour ville si meilleure version
            if ($result['city'] && (!$city || strlen($result['city']) > strlen($city))) {
                update_user_meta($user_id, 'sr_city', $result['city']);
            }
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Test simple pour vérifier le fonctionnement
     */
    public static function test_geocoding($postcode, $city = '') {
        $test_address = "1 rue principale";
        return self::geocode_address($test_address, $postcode, $city);
    }
    
    /**
     * HOOKS ET MAINTENANCE
     * ================================================================
     */
    
    private function init_hooks() {
        add_action('sr_geocode_user', [$this, 'geocode_user_async']);
        add_action('wp_ajax_sr_test_geocoding', [$this, 'ajax_test_geocoding']);
        add_action('wp_ajax_sr_geocoding_stats', [$this, 'ajax_get_stats']);
    }
    
    public function geocode_user_async($user_id) {
        usleep(100000); // 100ms entre utilisateurs
        self::geocode_user($user_id);
    }
    
    /**
     * Test AJAX pour diagnostic
     */
    public function ajax_test_geocoding() {
        check_ajax_referer('sr_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Permissions insuffisantes');
        }
        
        $postcode = sanitize_text_field($_POST['postcode'] ?? '');
        $city = sanitize_text_field($_POST['city'] ?? '');
        
        if (!$postcode) {
            wp_send_json_error('Code postal requis');
        }
        
        $result = self::test_geocoding($postcode, $city);
        
        if ($result) {
            wp_send_json_success([
                'result' => $result,
                'stats' => self::$stats
            ]);
        } else {
            wp_send_json_error('Géocodage échoué');
        }
    }
    
    /**
     * Statistiques AJAX
     */
    public function ajax_get_stats() {
        check_ajax_referer('sr_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Permissions insuffisantes');
        }
        
        wp_send_json_success([
            'stats' => self::$stats,
            'apis_config' => self::$apis_config,
            'cache_size' => count(self::$memory_cache)
        ]);
    }
}