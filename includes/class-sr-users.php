<?php
/**
 * includes/class-sr-users.php
 * Gestion optimisée des utilisateurs (familles, professeurs, staff)
 */

if (!defined('ABSPATH')) {
    exit;
}

class SR_Users {
    
    /**
     * Statistiques de création
     */
    private static $creation_stats = [
        'families_created' => 0,
        'professors_created' => 0,
        'errors' => 0
    ];
    
    public function __construct() {
        $this->init_hooks();
    }
    
    /**
     * Initialisation des hooks
     */
    private function init_hooks() {
        add_action('user_register', [$this, 'on_user_register']);
        add_action('wp_login', [$this, 'on_user_login'], 10, 2);
        add_filter('login_redirect', [$this, 'redirect_after_login'], 10, 3);
        add_filter('um_login_redirect_url', [$this, 'um_redirect_after_login'], 10, 3);
        
        // Hook pour géocodage asynchrone
        add_action('sr_geocode_user', [$this, 'handle_async_geocoding']);
    }
    
    /**
     * CRÉATION FAMILLE - Corrigée
     * ================================================================
     */
    
    /**
     * Création famille avec validation renforcée
     */
    public function create_family($data) {
        // Validation des données
        $validation = $this->validate_family_data($data);
        if (!$validation['success']) {
            self::$creation_stats['errors']++;
            return $validation;
        }
        
        $clean_data = $validation['data'];
        
        // Génération login unique
        $login = $this->generate_unique_username(
            substr($clean_data['rep_first'], 0, 1) . $clean_data['rep_last']
        );
        
        // Mot de passe sécurisé
        $password = wp_generate_password(12, true, false);
        
        // Création utilisateur WordPress
        $user_id = wp_insert_user([
            'user_login' => $login,
            'user_pass' => $password,
            'user_email' => $clean_data['rep_email'],
            'first_name' => $clean_data['rep_first'],
            'last_name' => $clean_data['rep_last'],
            'display_name' => $clean_data['rep_first'] . ' ' . $clean_data['rep_last'],
            'role' => 'um_famille'
        ]);
        
        if (is_wp_error($user_id)) {
            self::$creation_stats['errors']++;
            SR_Core::log("Failed to create family user: " . $user_id->get_error_message(), 'error');
            return [
                'success' => false,
                'message' => $user_id->get_error_message()
            ];
        }
        
        // Métadonnées utilisateur
        $meta_updates = [
            'sr_rep_first' => $clean_data['rep_first'],
            'sr_rep_last' => $clean_data['rep_last'],
            'sr_rep_email' => $clean_data['rep_email'],
            'sr_rep_phone' => $clean_data['rep_phone'] ?? '',
            'sr_addr1' => $clean_data['addr1'] ?? '',
            'sr_addr2' => $clean_data['addr2'] ?? '',
            'sr_postcode' => $clean_data['postcode'] ?? '',
            'sr_city' => $clean_data['city'] ?? '',
            'sr_country' => $clean_data['country'] ?? 'France',
            'sr_stu_first' => $clean_data['stu_first'] ?? '',
            'sr_stu_last' => $clean_data['stu_last'] ?? '',
            'sr_level' => $clean_data['level'] ?? '',
            'sr_subject' => $clean_data['subject'] ?? '',
            'sr_gender' => $clean_data['gender'] ?? '',
            'sr_freq' => $clean_data['freq'] ?? '',
            'sr_duration' => $clean_data['duration'] ?? '',
            'sr_period' => $clean_data['period'] ?? '',
            'sr_start' => $clean_data['start'] ?? '',
            'sr_created_at' => current_time('mysql'),
            'sr_created_by' => get_current_user_id(),
            'sr_user_type' => 'famille'
        ];
        
        // Mise à jour en lot
        $database = SR_Core::get_module('database');
        if ($database) {
            $success = $database->batch_update_user_meta([$user_id => $meta_updates]);
            if (!$success) {
                SR_Core::log("Failed to update family meta for user {$user_id}", 'warning');
            }
        } else {
            // Fallback si module database non disponible
            foreach ($meta_updates as $key => $value) {
                update_user_meta($user_id, $key, $value);
            }
        }
        
        // Géocodage asynchrone si adresse fournie
        if (!empty($clean_data['addr1']) && !empty($clean_data['postcode'])) {
            $this->schedule_geocoding($user_id);
        }
        
        // Notification de bienvenue
        $this->send_welcome_notification($user_id, 'family', $password);
        
        // Log de succès
        SR_Core::log("Family user created successfully: ID {$user_id}, login {$login}", 'info');
        self::$creation_stats['families_created']++;
        
        return [
            'success' => true,
            'user_id' => $user_id,
            'login' => $login,
            'password' => $password // Pour envoi par email sécurisé
        ];
    }
    
    /**
     * CRÉATION PROFESSEUR - Corrigée
     * ================================================================
     */
    
    /**
     * Création professeur avec validation
     */
    public function create_professor($data) {
        $validation = $this->validate_professor_data($data);
        if (!$validation['success']) {
            self::$creation_stats['errors']++;
            return $validation;
        }
        
        $clean_data = $validation['data'];
        
        $login = $this->generate_unique_username(
            substr($clean_data['prof_first'], 0, 1) . $clean_data['prof_last']
        );
        
        $password = wp_generate_password(12, true, false);
        
        $user_id = wp_insert_user([
            'user_login' => $login,
            'user_pass' => $password,
            'user_email' => $clean_data['prof_email'],
            'first_name' => $clean_data['prof_first'],
            'last_name' => $clean_data['prof_last'],
            'display_name' => $clean_data['prof_first'] . ' ' . $clean_data['prof_last'],
            'role' => 'um_professeur'
        ]);
        
        if (is_wp_error($user_id)) {
            self::$creation_stats['errors']++;
            SR_Core::log("Failed to create professor user: " . $user_id->get_error_message(), 'error');
            return [
                'success' => false,
                'message' => $user_id->get_error_message()
            ];
        }
        
        $meta_updates = [
            'sr_prof_first' => $clean_data['prof_first'],
            'sr_prof_last' => $clean_data['prof_last'],
            'sr_prof_email' => $clean_data['prof_email'],
            'sr_prof_phone' => $clean_data['prof_phone'] ?? '',
            'sr_prof_subject' => $clean_data['prof_subject'] ?? '',
            'sr_addr1' => $clean_data['addr1'] ?? '',
            'sr_addr2' => $clean_data['addr2'] ?? '',
            'sr_postcode' => $clean_data['postcode'] ?? '',
            'sr_city' => $clean_data['city'] ?? '',
            'sr_country' => $clean_data['country'] ?? 'France',
            'sr_created_at' => current_time('mysql'),
            'sr_created_by' => get_current_user_id(),
            'sr_user_type' => 'professeur'
        ];
        
        $database = SR_Core::get_module('database');
        if ($database) {
            $database->batch_update_user_meta([$user_id => $meta_updates]);
        } else {
            foreach ($meta_updates as $key => $value) {
                update_user_meta($user_id, $key, $value);
            }
        }
        
        if (!empty($clean_data['addr1']) && !empty($clean_data['postcode'])) {
            $this->schedule_geocoding($user_id);
        }
        
        $this->send_welcome_notification($user_id, 'professor', $password);
        
        SR_Core::log("Professor user created successfully: ID {$user_id}, login {$login}", 'info');
        self::$creation_stats['professors_created']++;
        
        return [
            'success' => true,
            'user_id' => $user_id,
            'login' => $login,
            'password' => $password
        ];
    }
    
    /**
     * VALIDATIONS - Corrigées
     * ================================================================
     */
    
    /**
     * Validation données famille
     */
    private function validate_family_data($data) {
        $errors = [];
        $clean = [];
        
        // Champs obligatoires - NOMS CORRIGÉS
        $required_fields = [
            'rep_first' => 'Prénom représentant',
            'rep_last' => 'Nom représentant', 
            'rep_email' => 'Email'
        ];
        
        foreach ($required_fields as $field => $label) {
            if (empty($data[$field])) {
                $errors[] = "Le champ '{$label}' est obligatoire";
            } else {
                $clean[$field] = sanitize_text_field($data[$field]);
            }
        }
        
        // Validation email renforcée
        if (!empty($data['rep_email'])) {
            $email = sanitize_email($data['rep_email']);
            if (!is_email($email)) {
                $errors[] = 'Format d\'email invalide';
            } elseif (email_exists($email)) {
                $errors[] = 'Cette adresse email est déjà utilisée';
            } else {
                $clean['rep_email'] = $email;
            }
        }
        
        // Validation code postal français
        if (!empty($data['postcode'])) {
            $postcode = preg_replace('/\D/', '', $data['postcode']);
            if (strlen($postcode) !== 5 || intval($postcode) < 1000) {
                $errors[] = 'Code postal français invalide (5 chiffres)';
            } else {
                $clean['postcode'] = $postcode;
            }
        }
        
        // Validation téléphone français renforcée
        if (!empty($data['rep_phone'])) {
            $phone = $this->validate_french_phone($data['rep_phone']);
            if ($phone === false) {
                $errors[] = 'Numéro de téléphone français invalide';
            } else {
                $clean['rep_phone'] = $phone;
            }
        }
        
        // Validation des niveaux scolaires
        if (!empty($data['level'])) {
            $valid_levels = [
                '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale',
                'BTS', 'Licence', 'Master', 'Doctorat'
            ];
            if (!in_array($data['level'], $valid_levels)) {
                $errors[] = 'Niveau scolaire invalide';
            } else {
                $clean['level'] = $data['level'];
            }
        }
        
        // Champs optionnels
        $optional_fields = [
            'addr1', 'addr2', 'city', 'country', 'stu_first', 'stu_last',
            'subject', 'gender', 'freq', 'duration', 'period', 'start'
        ];
        
        foreach ($optional_fields as $field) {
            if (isset($data[$field]) && $data[$field] !== '') {
                $clean[$field] = sanitize_text_field($data[$field]);
            }
        }
        
        return [
            'success' => empty($errors),
            'errors' => $errors,
            'data' => $clean
        ];
    }
    
    /**
     * Validation données professeur
     */
    private function validate_professor_data($data) {
        $errors = [];
        $clean = [];
        
        // Champs obligatoires - NOMS CORRIGÉS
        $required_fields = [
            'prof_first' => 'Prénom',
            'prof_last' => 'Nom',
            'prof_email' => 'Email'
        ];
        
        foreach ($required_fields as $field => $label) {
            if (empty($data[$field])) {
                $errors[] = "Le champ '{$label}' est obligatoire";
            } else {
                $clean[$field] = sanitize_text_field($data[$field]);
            }
        }
        
        // Validation email
        if (!empty($data['prof_email'])) {
            $email = sanitize_email($data['prof_email']);
            if (!is_email($email)) {
                $errors[] = 'Format d\'email invalide';
            } elseif (email_exists($email)) {
                $errors[] = 'Cette adresse email est déjà utilisée';
            } else {
                $clean['prof_email'] = $email;
            }
        }
        
        // Validation code postal
        if (!empty($data['postcode'])) {
            $postcode = preg_replace('/\D/', '', $data['postcode']);
            if (strlen($postcode) !== 5) {
                $errors[] = 'Code postal français invalide';
            } else {
                $clean['postcode'] = $postcode;
            }
        }
        
        // Validation téléphone
        if (!empty($data['prof_phone'])) {
            $phone = $this->validate_french_phone($data['prof_phone']);
            if ($phone === false) {
                $errors[] = 'Numéro de téléphone invalide';
            } else {
                $clean['prof_phone'] = $phone;
            }
        }
        
        // Champs optionnels
        $optional_fields = ['prof_subject', 'addr1', 'addr2', 'city', 'country'];
        foreach ($optional_fields as $field) {
            if (isset($data[$field]) && $data[$field] !== '') {
                $clean[$field] = sanitize_text_field($data[$field]);
            }
        }
        
        return [
            'success' => empty($errors),
            'errors' => $errors,
            'data' => $clean
        ];
    }
    
    /**
     * UTILITAIRES
     * ================================================================
     */
    
    /**
     * Validation téléphone français
     */
    private function validate_french_phone($phone) {
        // Nettoyage
        $clean = preg_replace('/[^\d\+]/', '', $phone);
        
        // Patterns français valides
        $patterns = [
            '/^0[1-9]\d{8}$/',           // 01 23 45 67 89
            '/^\+33[1-9]\d{8}$/',        // +33 1 23 45 67 89
            '/^33[1-9]\d{8}$/'           // 33 1 23 45 67 89
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $clean)) {
                // Normalisation au format français
                if (substr($clean, 0, 3) === '+33') {
                    return '0' . substr($clean, 3);
                } elseif (substr($clean, 0, 2) === '33') {
                    return '0' . substr($clean, 2);
                }
                return $clean;
            }
        }
        
        return false;
    }
    
    /**
     * Génération nom d'utilisateur unique avec fallback
     */
    private function generate_unique_username($base) {
        $base = sanitize_user($base, true);
        $username = $base;
        $i = 1;
        
        // Limite pour éviter boucle infinie
        while (username_exists($username) && $i < 999) {
            $username = $base . $i;
            $i++;
        }
        
        // Fallback si toujours pas unique
        if (username_exists($username)) {
            $username = $base . '_' . wp_rand(1000, 9999);
        }
        
        return $username;
    }
    
    /**
     * Programmation géocodage asynchrone sécurisée
     */
    private function schedule_geocoding($user_id) {
        // Vérification que le module géocodage existe
        $geocoding = SR_Core::get_module('geocoding');
        if (!$geocoding) {
            SR_Core::log("Cannot schedule geocoding: geocoding module not available", 'warning');
            return false;
        }
        
        // Programmation avec délai pour éviter surcharge
        wp_schedule_single_event(time() + wp_rand(5, 30), 'sr_geocode_user', [$user_id]);
        return true;
    }
    
    /**
     * Gestion géocodage asynchrone
     */
    public function handle_async_geocoding($user_id) {
        $geocoding = SR_Core::get_module('geocoding');
        if ($geocoding) {
            $success = $geocoding::geocode_user($user_id);
            SR_Core::log("Async geocoding for user {$user_id}: " . ($success ? 'success' : 'failed'), 'debug');
        }
    }
    
    /**
     * Envoi notification de bienvenue sécurisée
     */
    private function send_welcome_notification($user_id, $type, $password) {
        $notifications = SR_Core::get_module('notifications');
        if (!$notifications) {
            SR_Core::log("Cannot send welcome notification: notifications module not available", 'warning');
            return false;
        }
        
        try {
            if ($type === 'family') {
                return $notifications->send_welcome_family($user_id, $password);
            } elseif ($type === 'professor') {
                return $notifications->send_welcome_professor($user_id, $password);
            }
        } catch (Exception $e) {
            SR_Core::log("Failed to send welcome notification: " . $e->getMessage(), 'error');
            return false;
        }
        
        return false;
    }
    
    /**
     * HOOKS CONNEXION
     * ================================================================
     */
    
    /**
     * Actions lors de l'inscription
     */
    public function on_user_register($user_id) {
        update_user_meta($user_id, 'sr_registered_at', current_time('mysql'));
        update_user_meta($user_id, 'sr_login_count', 0);
        update_user_meta($user_id, 'sr_last_activity', current_time('mysql'));
        
        SR_Core::log("User registered: ID {$user_id}", 'info');
    }
    
    /**
     * Actions lors de la connexion
     */
    public function on_user_login($user_login, $user) {
        // Mise à jour statistiques connexion
        update_user_meta($user->ID, 'sr_last_login', current_time('mysql'));
        update_user_meta($user->ID, 'sr_last_activity', current_time('mysql'));
        update_user_meta($user->ID, 'sr_last_ip', $_SERVER['REMOTE_ADDR'] ?? '');
        
        $count = intval(get_user_meta($user->ID, 'sr_login_count', true));
        update_user_meta($user->ID, 'sr_login_count', $count + 1);
        
        SR_Core::log("User login: {$user_login} (ID {$user->ID})", 'debug');
    }
    
    /**
     * Redirections post-connexion
     */
    public function redirect_after_login($redirect_to, $request, $user) {
        if (!$user instanceof WP_User) {
            return $redirect_to;
        }
        
        // Redirection staff vers extranet
        if (in_array('sr_staff', $user->roles)) {
            return home_url('/extranet-staff/');
        }
        
        // Redirection première connexion vers page d'accueil personnalisée
        $login_count = intval(get_user_meta($user->ID, 'sr_login_count', true));
        if ($login_count <= 1) {
            if (in_array('um_famille', $user->roles)) {
                return home_url('/bienvenue-famille/');
            } elseif (in_array('um_professeur', $user->roles)) {
                return home_url('/bienvenue-professeur/');
            }
        }
        
        return $redirect_to;
    }
    
    /**
     * Redirection Ultimate Member
     */
    public function um_redirect_after_login($url, $user_id, $args) {
        $user = get_user_by('id', $user_id);
        if (!$user) return $url;
        
        if (in_array('sr_staff', $user->roles)) {
            return home_url('/extranet-staff/');
        }
        
        return $url;
    }
    
    /**
     * STATISTIQUES ET DIAGNOSTIC
     * ================================================================
     */
    
    /**
     * Obtention des statistiques de création
     */
    public static function get_creation_stats() {
        return self::$creation_stats;
    }
    
    /**
     * Statistiques utilisateurs globales
     */
    public function get_user_statistics() {
        global $wpdb;
        
        return [
            'total_families' => $wpdb->get_var("
                SELECT COUNT(*) FROM {$wpdb->users} u 
                JOIN {$wpdb->usermeta} um ON u.ID = um.user_id 
                WHERE um.meta_key = '{$wpdb->prefix}capabilities' 
                AND um.meta_value LIKE '%um_famille%'
            "),
            'total_professors' => $wpdb->get_var("
                SELECT COUNT(*) FROM {$wpdb->users} u 
                JOIN {$wpdb->usermeta} um ON u.ID = um.user_id 
                WHERE um.meta_key = '{$wpdb->prefix}capabilities' 
                AND um.meta_value LIKE '%um_professeur%'
            "),
            'recent_registrations' => $wpdb->get_var($wpdb->prepare("
                SELECT COUNT(*) FROM {$wpdb->usermeta} 
                WHERE meta_key = 'sr_registered_at' 
                AND meta_value >= %s
            ", date('Y-m-d', strtotime('-30 days')))),
            'geocoded_users' => $wpdb->get_var("
                SELECT COUNT(DISTINCT user_id) FROM {$wpdb->usermeta} 
                WHERE meta_key IN ('sr_lat', 'sr_lng')
                AND meta_value != ''
            ")
        ];
    }
}