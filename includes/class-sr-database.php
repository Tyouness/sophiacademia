<?php
/**
 * includes/class-sr-database.php
 * Optimisations et requêtes de base de données pour Sophiacademia
 * 
 * @package Sophiacademia
 * @version 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class SR_Database {
    
    /**
     * Cache des requêtes en mémoire pour la session
     */
    private static $query_cache = [];
    
    /**
     * Groupes de cache WordPress
     */
    private static $cache_groups = [
        'sr_geo_queries',
        'sr_user_queries', 
        'sr_request_queries',
        'sr_course_queries'
    ];
    
    /**
     * Statistiques de performance
     */
    private static $query_stats = [
        'total_queries' => 0,
        'cached_queries' => 0,
        'execution_time' => 0
    ];
    
    public function __construct() {
        $this->init_cache_groups();
        $this->init_hooks();
    }
    
    /**
     * Initialisation des groupes de cache
     */
    private function init_cache_groups() {
        // Ajout des groupes de cache globaux si pas d'object cache externe
        if (!wp_using_ext_object_cache()) {
            wp_cache_add_global_groups(self::$cache_groups);
        }
    }
    
    /**
     * Hooks WordPress
     */
    private function init_hooks() {
        // Nettoyage du cache lors des modifications
        add_action('updated_user_meta', [$this, 'invalidate_user_cache'], 10, 4);
        add_action('added_user_meta', [$this, 'invalidate_user_cache'], 10, 4);
        add_action('deleted_user_meta', [$this, 'invalidate_user_cache'], 10, 4);
        
        // Nettoyage du cache lors des modifications de posts
        add_action('wp_insert_post', [$this, 'invalidate_post_cache'], 10, 3);
        add_action('before_delete_post', [$this, 'invalidate_post_cache']);
        
        // Stats de performance en mode debug
        if (get_option('sr_debug_mode', false)) {
            add_action('wp_footer', [$this, 'display_query_stats']);
            add_action('admin_footer', [$this, 'display_query_stats']);
        }
    }
    
    /**
     * REQUÊTES GÉOGRAPHIQUES OPTIMISÉES
     * ================================================================
     */
    
    /**
     * Récupération des familles dans un rayon avec optimisations avancées
     */
    public function get_families_in_radius($prof_lat, $prof_lng, $radius_km = 25, $additional_filters = []) {
        $start_time = microtime(true);
        
        // Génération clé de cache unique
        $cache_key = $this->generate_geo_cache_key($prof_lat, $prof_lng, $radius_km, $additional_filters);
        
        // Vérification cache
        $cached = wp_cache_get($cache_key, 'sr_geo_queries');
        if ($cached !== false) {
            self::$query_stats['cached_queries']++;
            return $cached;
        }
        
        global $wpdb;
        
        // Calcul du bounding box pour pré-filtrage (performance)
        $bounds = $this->calculate_bounding_box($prof_lat, $prof_lng, $radius_km);
        
        // Construction de la requête avec filtres dynamiques
        $where_conditions = $this->build_family_filters($additional_filters);
        
        $sql = $wpdb->prepare("
            SELECT u.ID, u.display_name, u.user_email,
                   lat.meta_value as lat, 
                   lng.meta_value as lng,
                   city.meta_value as city,
                   postcode.meta_value as postcode,
                   level.meta_value as level,
                   subject.meta_value as subject,
                   gender.meta_value as gender,
                   freq.meta_value as freq,
                   duration.meta_value as duration,
                   period.meta_value as period,
                   start_date.meta_value as start_date,
                   (6371 * acos(
                       cos(radians(%f)) * cos(radians(lat.meta_value)) * 
                       cos(radians(lng.meta_value) - radians(%f)) + 
                       sin(radians(%f)) * sin(radians(lat.meta_value))
                   )) AS distance
            FROM {$wpdb->users} u
            -- JOINs obligatoires
            JOIN {$wpdb->usermeta} lat ON lat.user_id = u.ID AND lat.meta_key = 'sr_lat'
            JOIN {$wpdb->usermeta} lng ON lng.user_id = u.ID AND lng.meta_key = 'sr_lng'
            -- JOINs optionnels
            LEFT JOIN {$wpdb->usermeta} city ON city.user_id = u.ID AND city.meta_key = 'sr_city'
            LEFT JOIN {$wpdb->usermeta} postcode ON postcode.user_id = u.ID AND postcode.meta_key = 'sr_postcode'
            LEFT JOIN {$wpdb->usermeta} level ON level.user_id = u.ID AND level.meta_key = 'sr_level'
            LEFT JOIN {$wpdb->usermeta} subject ON subject.user_id = u.ID AND subject.meta_key = 'sr_subject'
            LEFT JOIN {$wpdb->usermeta} gender ON gender.user_id = u.ID AND gender.meta_key = 'sr_gender'
            LEFT JOIN {$wpdb->usermeta} freq ON freq.user_id = u.ID AND freq.meta_key = 'sr_freq'
            LEFT JOIN {$wpdb->usermeta} duration ON duration.user_id = u.ID AND duration.meta_key = 'sr_duration'
            LEFT JOIN {$wpdb->usermeta} period ON period.user_id = u.ID AND period.meta_key = 'sr_period'
            LEFT JOIN {$wpdb->usermeta} start_date ON start_date.user_id = u.ID AND start_date.meta_key = 'sr_start'
            WHERE lat.meta_value BETWEEN %f AND %f
              AND lng.meta_value BETWEEN %f AND %f
              AND EXISTS (
                  SELECT 1 FROM {$wpdb->usermeta} role 
                  WHERE role.user_id = u.ID 
                  AND role.meta_key = '{$wpdb->prefix}capabilities' 
                  AND role.meta_value LIKE %s
              )
              {$where_conditions}
            HAVING distance <= %f
            ORDER BY distance ASC
            LIMIT 100
        ", 
            $prof_lat, $prof_lng, $prof_lat,
            $bounds['lat_min'], $bounds['lat_max'],
            $bounds['lng_min'], $bounds['lng_max'],
            '%um_famille%',
            $radius_km
        );
        
        $results = $wpdb->get_results($sql);
        
        // Mise en cache (1 heure)
        wp_cache_set($cache_key, $results, 'sr_geo_queries', HOUR_IN_SECONDS);
        
        // Stats de performance
        self::$query_stats['total_queries']++;
        self::$query_stats['execution_time'] += (microtime(true) - $start_time);
        
        return $results;
    }
    
    /**
     * Calcul du bounding box pour optimiser les requêtes géographiques
     */
    private function calculate_bounding_box($lat, $lng, $radius_km) {
        // Approximation : 1 degré de latitude ≈ 111 km
        $lat_delta = $radius_km / 111;
        
        // Pour la longitude, dépend de la latitude (cos effect)
        $lng_delta = $radius_km / (111 * cos(deg2rad($lat)));
        
        return [
            'lat_min' => $lat - $lat_delta,
            'lat_max' => $lat + $lat_delta,
            'lng_min' => $lng - $lng_delta,
            'lng_max' => $lng + $lng_delta
        ];
    }
    
    /**
     * Construction des filtres dynamiques pour les familles
     */
    private function build_family_filters($filters) {
        if (empty($filters)) {
            return '';
        }
        
        global $wpdb;
        $conditions = [];
        
        // Filtre par matière
        if (!empty($filters['subject'])) {
            $conditions[] = $wpdb->prepare(
                "AND subject.meta_value LIKE %s", 
                '%' . $wpdb->esc_like($filters['subject']) . '%'
            );
        }
        
        // Filtre par niveau
        if (!empty($filters['level'])) {
            $conditions[] = $wpdb->prepare(
                "AND level.meta_value LIKE %s", 
                '%' . $wpdb->esc_like($filters['level']) . '%'
            );
        }
        
        // Filtre par ville
        if (!empty($filters['city'])) {
            $conditions[] = $wpdb->prepare(
                "AND city.meta_value LIKE %s", 
                '%' . $wpdb->esc_like($filters['city']) . '%'
            );
        }
        
        // Filtre par genre
        if (!empty($filters['gender'])) {
            $conditions[] = $wpdb->prepare(
                "AND gender.meta_value = %s", 
                $filters['gender']
            );
        }
        
        return implode(' ', $conditions);
    }
    
    /**
     * Génération de clé de cache pour les requêtes géographiques
     */
    private function generate_geo_cache_key($lat, $lng, $radius, $filters = []) {
        $key_parts = [
            'families_radius',
            round($lat, 4), // Précision suffisante pour le cache
            round($lng, 4),
            $radius
        ];
        
        if (!empty($filters)) {
            $key_parts[] = md5(serialize($filters));
        }
        
        return implode('_', $key_parts);
    }
    
    /**
     * VÉRIFICATIONS D'ATTRIBUTION ET DISPONIBILITÉ
     * ================================================================
     */
    
    /**
     * Vérification en lot de la disponibilité des familles
     */
    public function check_family_availability($family_ids) {
        if (empty($family_ids)) {
            return [];
        }
        
        // Cache par lot pour éviter les requêtes répétées
        $cache_key = 'family_availability_' . md5(implode(',', $family_ids));
        $cached = wp_cache_get($cache_key, 'sr_request_queries');
        
        if ($cached !== false) {
            return $cached;
        }
        
        global $wpdb;
        
        $placeholders = implode(',', array_fill(0, count($family_ids), '%d'));
        
        $assigned_families = $wpdb->get_col($wpdb->prepare("
            SELECT DISTINCT pm_family.meta_value
            FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm_family ON p.ID = pm_family.post_id AND pm_family.meta_key = '_sr_family'
            JOIN {$wpdb->postmeta} pm_status ON p.ID = pm_status.post_id AND pm_status.meta_key = '_sr_status'
            WHERE p.post_type = 'sr_request'
              AND p.post_status = 'publish'
              AND pm_family.meta_value IN ($placeholders)
              AND pm_status.meta_value IN ('approved', 'pending')
        ", ...$family_ids));
        
        $result = array_map('intval', $assigned_families);
        
        // Cache 30 minutes
        wp_cache_set($cache_key, $result, 'sr_request_queries', 30 * MINUTE_IN_SECONDS);
        
        return $result;
    }
    
    /**
     * Vérification des demandes existantes d'un professeur
     */
    public function get_professor_existing_requests($prof_id, $family_ids = []) {
        $cache_key = "prof_requests_{$prof_id}";
        if (!empty($family_ids)) {
            $cache_key .= '_' . md5(implode(',', $family_ids));
        }
        
        $cached = wp_cache_get($cache_key, 'sr_request_queries');
        if ($cached !== false) {
            return $cached;
        }
        
        global $wpdb;
        
        $where_family = '';
        $params = [$prof_id];
        
        if (!empty($family_ids)) {
            $placeholders = implode(',', array_fill(0, count($family_ids), '%d'));
            $where_family = "AND pm_family.meta_value IN ($placeholders)";
            $params = array_merge($params, $family_ids);
        }
        
        $requests = $wpdb->get_results($wpdb->prepare("
            SELECT pm_family.meta_value as family_id,
                   pm_status.meta_value as status,
                   p.post_date
            FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm_prof ON p.ID = pm_prof.post_id AND pm_prof.meta_key = '_sr_prof'
            JOIN {$wpdb->postmeta} pm_family ON p.ID = pm_family.post_id AND pm_family.meta_key = '_sr_family'
            LEFT JOIN {$wpdb->postmeta} pm_status ON p.ID = pm_status.post_id AND pm_status.meta_key = '_sr_status'
            WHERE p.post_type = 'sr_request'
              AND pm_prof.meta_value = %d
              AND COALESCE(pm_status.meta_value, 'pending') IN ('pending', 'approved')
              {$where_family}
            ORDER BY p.post_date DESC
        ", ...$params));
        
        // Cache 15 minutes
        wp_cache_set($cache_key, $requests, 'sr_request_queries', 15 * MINUTE_IN_SECONDS);
        
        return $requests;
    }
    
    /**
     * OPTIMISATIONS UTILISATEURS
     * ================================================================
     */
    
    /**
     * Mise à jour en lot des métadonnées utilisateur
     */
    public function batch_update_user_meta($updates_by_user) {
        if (empty($updates_by_user)) {
            return false;
        }
        
        global $wpdb;
        
        // Transaction pour cohérence
        $wpdb->query('START TRANSACTION');
        
        try {
            foreach ($updates_by_user as $user_id => $meta_data) {
                if (!is_numeric($user_id) || empty($meta_data)) {
                    continue;
                }
                
                foreach ($meta_data as $meta_key => $meta_value) {
                    // Utilisation REPLACE pour éviter les doublons
                    $wpdb->replace(
                        $wpdb->usermeta,
                        [
                            'user_id' => intval($user_id),
                            'meta_key' => sanitize_key($meta_key),
                            'meta_value' => is_array($meta_value) ? serialize($meta_value) : $meta_value
                        ],
                        ['%d', '%s', '%s']
                    );
                }
                
                // Invalidation du cache utilisateur
                $this->invalidate_user_cache_by_id($user_id);
            }
            
            $wpdb->query('COMMIT');
            return true;
            
        } catch (Exception $e) {
            $wpdb->query('ROLLBACK');
            SR_Core::log("Batch update failed: " . $e->getMessage(), 'error');
            return false;
        }
    }
    
    /**
     * Récupération optimisée des données utilisateur avec cache
     */
    public function get_user_complete_data($user_id, $meta_keys = []) {
        $cache_key = "user_complete_{$user_id}";
        if (!empty($meta_keys)) {
            $cache_key .= '_' . md5(implode(',', $meta_keys));
        }
        
        $cached = wp_cache_get($cache_key, 'sr_user_queries');
        if ($cached !== false) {
            return $cached;
        }
        
        // Données utilisateur de base
        $user = get_userdata($user_id);
        if (!$user) {
            return false;
        }
        
        global $wpdb;
        
        // Récupération de toutes les métadonnées SR en une requête
        $where_keys = '';
        if (!empty($meta_keys)) {
            $placeholders = implode(',', array_fill(0, count($meta_keys), '%s'));
            $where_keys = $wpdb->prepare("AND meta_key IN ($placeholders)", ...$meta_keys);
        } else {
            $where_keys = "AND meta_key LIKE 'sr_%'";
        }
        
        $meta_results = $wpdb->get_results($wpdb->prepare("
            SELECT meta_key, meta_value
            FROM {$wpdb->usermeta}
            WHERE user_id = %d {$where_keys}
        ", $user_id));
        
        // Assemblage des données
        $user_data = [
            'ID' => $user->ID,
            'user_login' => $user->user_login,
            'user_email' => $user->user_email,
            'display_name' => $user->display_name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'roles' => $user->roles
        ];
        
        // Ajout des métadonnées
        foreach ($meta_results as $meta) {
            $user_data[$meta->meta_key] = maybe_unserialize($meta->meta_value);
        }
        
        // Cache 1 heure
        wp_cache_set($cache_key, $user_data, 'sr_user_queries', HOUR_IN_SECONDS);
        
        return $user_data;
    }
    
    /**
     * REQUÊTES COURS ET HEURES
     * ================================================================
     */
    
    /**
     * Récupération des cours d'une famille avec synthèse
     */
    public function get_family_courses_with_summary($family_id, $date_from = null, $date_to = null) {
        $cache_key = "family_courses_{$family_id}";
        if ($date_from || $date_to) {
            $cache_key .= '_' . ($date_from ?: 'all') . '_' . ($date_to ?: 'all');
        }
        
        $cached = wp_cache_get($cache_key, 'sr_course_queries');
        if ($cached !== false) {
            return $cached;
        }
        
        global $wpdb;
        
        $date_conditions = '';
        $params = [$family_id];
        
        if ($date_from) {
            $date_conditions .= " AND pm_date.meta_value >= %s";
            $params[] = $date_from;
        }
        
        if ($date_to) {
            $date_conditions .= " AND pm_date.meta_value <= %s";
            $params[] = $date_to;
        }
        
        $courses = $wpdb->get_results($wpdb->prepare("
            SELECT p.ID,
                   pm_date.meta_value as course_date,
                   pm_hours.meta_value as hours,
                   pm_subject.meta_value as subject,
                   pm_status.meta_value as status,
                   pm_prof.meta_value as prof_id,
                   u.display_name as prof_name,
                   DATE_FORMAT(pm_date.meta_value, '%%Y-%%m') as month_key
            FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm_family ON p.ID = pm_family.post_id AND pm_family.meta_key = '_sr_family'
            LEFT JOIN {$wpdb->postmeta} pm_date ON p.ID = pm_date.post_id AND pm_date.meta_key = '_sr_date'
            LEFT JOIN {$wpdb->postmeta} pm_hours ON p.ID = pm_hours.post_id AND pm_hours.meta_key = '_sr_hours'
            LEFT JOIN {$wpdb->postmeta} pm_subject ON p.ID = pm_subject.post_id AND pm_subject.meta_key = '_sr_subject'
            LEFT JOIN {$wpdb->postmeta} pm_status ON p.ID = pm_status.post_id AND pm_status.meta_key = '_sr_status'
            LEFT JOIN {$wpdb->postmeta} pm_prof ON p.ID = pm_prof.post_id AND pm_prof.meta_key = '_sr_prof'
            LEFT JOIN {$wpdb->users} u ON pm_prof.meta_value = u.ID
            WHERE p.post_type = 'sr_course'
              AND pm_family.meta_value = %d
              {$date_conditions}
            ORDER BY pm_date.meta_value DESC
        ", ...$params));
        
        // Calcul de la synthèse
        $summary = [
            'total_hours' => 0,
            'total_cost_gross' => 0,
            'total_cost_net' => 0,
            'by_month' => [],
            'by_professor' => [],
            'by_status' => ['pending' => 0, 'paid' => 0, 'advance' => 0]
        ];
        
        foreach ($courses as $course) {
            $hours = floatval($course->hours ?: 0);
            $status = $course->status ?: 'pending';
            $month = $course->month_key;
            $prof_id = intval($course->prof_id ?: 0);
            
            // Totaux généraux
            $summary['total_hours'] += $hours;
            $summary['total_cost_gross'] += $hours * SR_Core::FAMILY_HOURLY_RATE;
            $summary['total_cost_net'] += $hours * SR_Core::FAMILY_NET_HOURLY;
            
            // Par mois
            if ($month) {
                if (!isset($summary['by_month'][$month])) {
                    $summary['by_month'][$month] = ['hours' => 0, 'cost_net' => 0];
                }
                $summary['by_month'][$month]['hours'] += $hours;
                $summary['by_month'][$month]['cost_net'] += $hours * SR_Core::FAMILY_NET_HOURLY;
            }
            
            // Par professeur
            if ($prof_id && $course->prof_name) {
                if (!isset($summary['by_professor'][$prof_id])) {
                    $summary['by_professor'][$prof_id] = [
                        'name' => $course->prof_name,
                        'hours' => 0
                    ];
                }
                $summary['by_professor'][$prof_id]['hours'] += $hours;
            }
            
            // Par statut
            if (isset($summary['by_status'][$status])) {
                $summary['by_status'][$status] += $hours;
            }
        }
        
        $result = [
            'courses' => $courses,
            'summary' => $summary
        ];
        
        // Cache 30 minutes
        wp_cache_set($cache_key, $result, 'sr_course_queries', 30 * MINUTE_IN_SECONDS);
        
        return $result;
    }
    
    /**
     * Récupération des statistiques professeur
     */
    public function get_professor_stats($prof_id, $period = 'all') {
        $cache_key = "prof_stats_{$prof_id}_{$period}";
        $cached = wp_cache_get($cache_key, 'sr_course_queries');
        
        if ($cached !== false) {
            return $cached;
        }
        
        global $wpdb;
        
        $date_condition = '';
        $params = [$prof_id];
        
        switch ($period) {
            case 'current_month':
                $date_condition = "AND pm_date.meta_value >= %s";
                $params[] = date('Y-m-01');
                break;
            case 'last_month':
                $date_condition = "AND pm_date.meta_value >= %s AND pm_date.meta_value < %s";
                $params[] = date('Y-m-01', strtotime('-1 month'));
                $params[] = date('Y-m-01');
                break;
            case 'current_year':
                $date_condition = "AND pm_date.meta_value >= %s";
                $params[] = date('Y-01-01');
                break;
        }
        
        $stats = $wpdb->get_results($wpdb->prepare("
            SELECT 
                COUNT(DISTINCT pm_family.meta_value) as total_families,
                COUNT(p.ID) as total_courses,
                SUM(CAST(pm_hours.meta_value AS DECIMAL(5,2))) as total_hours,
                SUM(CASE WHEN COALESCE(pm_status.meta_value, 'pending') = 'paid' 
                     THEN CAST(pm_hours.meta_value AS DECIMAL(5,2)) ELSE 0 END) as paid_hours,
                SUM(CASE WHEN COALESCE(pm_status.meta_value, 'pending') = 'advance' 
                     THEN CAST(pm_hours.meta_value AS DECIMAL(5,2)) ELSE 0 END) as advance_hours,
                SUM(CASE WHEN COALESCE(pm_status.meta_value, 'pending') = 'pending' 
                     THEN CAST(pm_hours.meta_value AS DECIMAL(5,2)) ELSE 0 END) as pending_hours
            FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm_prof ON p.ID = pm_prof.post_id AND pm_prof.meta_key = '_sr_prof'
            JOIN {$wpdb->postmeta} pm_family ON p.ID = pm_family.post_id AND pm_family.meta_key = '_sr_family'
            LEFT JOIN {$wpdb->postmeta} pm_date ON p.ID = pm_date.post_id AND pm_date.meta_key = '_sr_date'
            LEFT JOIN {$wpdb->postmeta} pm_hours ON p.ID = pm_hours.post_id AND pm_hours.meta_key = '_sr_hours'
            LEFT JOIN {$wpdb->postmeta} pm_status ON p.ID = pm_status.post_id AND pm_status.meta_key = '_sr_status'
            WHERE p.post_type = 'sr_course'
              AND pm_prof.meta_value = %d
              {$date_condition}
        ", ...$params));
        
        $result = $stats[0] ?? (object) [
            'total_families' => 0,
            'total_courses' => 0,
            'total_hours' => 0,
            'paid_hours' => 0,
            'advance_hours' => 0,
            'pending_hours' => 0
        ];
        
        // Conversion en array et calculs additionnels
        $result = (array) $result;
        $result['total_hours'] = floatval($result['total_hours']);
        $result['paid_hours'] = floatval($result['paid_hours']);
        $result['advance_hours'] = floatval($result['advance_hours']);
        $result['pending_hours'] = floatval($result['pending_hours']);
        
        // Cache 1 heure
        wp_cache_set($cache_key, $result, 'sr_course_queries', HOUR_IN_SECONDS);
        
        return $result;
    }
    
    /**
     * GESTION DU CACHE
     * ================================================================
     */
    
    /**
     * Invalidation du cache utilisateur
     */
    public function invalidate_user_cache($meta_id, $user_id, $meta_key, $meta_value) {
        if (strpos($meta_key, 'sr_') === 0) {
            $this->invalidate_user_cache_by_id($user_id);
        }
    }
    
    /**
     * Invalidation du cache par ID utilisateur
     */
    private function invalidate_user_cache_by_id($user_id) {
        $patterns = [
            "user_complete_{$user_id}",
            "sr_user_meta_{$user_id}",
            "sr_students_{$user_id}",
            "prof_stats_{$user_id}_*",
            "family_courses_{$user_id}*"
        ];
        
        foreach ($patterns as $pattern) {
            if (strpos($pattern, '*') !== false) {
                // Pour les patterns avec wildcard, on nettoie par groupe
                $prefix = str_replace('*', '', $pattern);
                wp_cache_flush_group('sr_user_queries');
            } else {
                wp_cache_delete($pattern, 'sr_user_queries');
            }
        }
        
        // Invalider aussi le cache géographique si coordonnées modifiées
        wp_cache_flush_group('sr_geo_queries');
    }
    
    /**
     * Invalidation du cache lors des modifications de posts
     */
    public function invalidate_post_cache($post_id, $post = null, $update = null) {
        if ($post && in_array($post->post_type, ['sr_request', 'sr_course'])) {
            wp_cache_flush_group('sr_request_queries');
            wp_cache_flush_group('sr_course_queries');
        }
    }
    
    /**
     * Nettoyage complet du cache
     */
    public function flush_all_cache() {
        foreach (self::$cache_groups as $group) {
            wp_cache_flush_group($group);
        }
        
        // Nettoyage du cache en mémoire
        self::$query_cache = [];
        
        SR_Core::log('All SR cache flushed', 'debug');
    }
    
    /**
     * UTILITAIRES ET STATISTIQUES
     * ================================================================
     */
    
    /**
     * Affichage des statistiques de performance
     */
    public function display_query_stats() {
        if (!current_user_can('manage_options')) {
            return;
        }
        
        $cache_ratio = self::$query_stats['total_queries'] > 0 
            ? round((self::$query_stats['cached_queries'] / self::$query_stats['total_queries']) * 100, 1)
            : 0;
        
        printf(
            '<div style="position:fixed;bottom:10px;right:10px;background:#333;color:#fff;padding:8px;font-size:11px;z-index:9999;">
                SR DB Stats: %d queries | %d cached (%s%%) | %.3fs
            </div>',
            self::$query_stats['total_queries'],
            self::$query_stats['cached_queries'],
            $cache_ratio,
            self::$query_stats['execution_time']
        );
    }
    
    /**
     * Obtention des statistiques globales
     */
    public function get_database_stats() {
        global $wpdb;
        
        return [
            'performance' => self::$query_stats,
            'cache_groups' => self::$cache_groups,
            'tables' => [
                'users' => $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->users}"),
                'usermeta' => $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key LIKE 'sr_%'"),
                'requests' => $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'sr_request'"),
                'courses' => $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'sr_course'")
            ]
        ];
    }
    
    /**
     * Maintenance et optimisation
     */
    public function optimize_database() {
        global $wpdb;
        
        // Nettoyage des métadonnées orphelines
        $orphaned = $wpdb->query("
            DELETE FROM {$wpdb->usermeta} 
            WHERE user_id NOT IN (SELECT ID FROM {$wpdb->users})
        ");
        
        $orphaned_posts = $wpdb->query("
            DELETE FROM {$wpdb->postmeta} 
            WHERE post_id NOT IN (SELECT ID FROM {$wpdb->posts})
        ");
        
        // Optimisation des tables
        $wpdb->query("OPTIMIZE TABLE {$wpdb->users}");
        $wpdb->query("OPTIMIZE TABLE {$wpdb->usermeta}");
        $wpdb->query("OPTIMIZE TABLE {$wpdb->posts}");
        $wpdb->query("OPTIMIZE TABLE {$wpdb->postmeta}");
        
        SR_Core::log("Database optimized: {$orphaned} orphaned usermeta, {$orphaned_posts} orphaned postmeta cleaned", 'info');
        
        return [
            'orphaned_usermeta' => $orphaned,
            'orphaned_postmeta' => $orphaned_posts
        ];
    }
}