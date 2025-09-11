<?php
/**
 * includes/class-sr-requests.php
 * Gestion du workflow demandes/affectations et déclarations d'heures
 * 
 * @package Sophiacademia
 * @version 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class SR_Requests {
    
    /**
     * Statuts possibles des demandes
     */
    const STATUS_PENDING = 'pending';
    const STATUS_APPROVED = 'approved';
    const STATUS_REJECTED = 'rejected';
    const STATUS_ENDED = 'ended';
    const STATUS_CANCELLED = 'cancelled';
    
    /**
     * Statuts possibles des cours
     */
    const COURSE_PENDING = 'pending';
    const COURSE_PAID = 'paid';
    const COURSE_ADVANCE = 'advance';
    const COURSE_REFUNDED = 'refunded';
    
    /**
     * Configuration auto-validation
     */
    const AUTO_VALIDATE_HOURS = 48; // heures
    
    public function __construct() {
        $this->init_hooks();
        $this->schedule_maintenance_tasks();
    }
    
    /**
     * INITIALISATION
     * ================================================================
     */
    
    /**
     * Initialisation des hooks WordPress
     */
    private function init_hooks() {
        // Tâches automatisées
        add_action('sr_auto_validate_courses', [$this, 'auto_validate_pending_courses']);
        add_action('sr_cleanup_old_requests', [$this, 'cleanup_old_requests']);
        add_action('sr_send_reminder_notifications', [$this, 'send_reminder_notifications']);
        
        // Hooks de géocodage asynchrone
        add_action('sr_geocode_user', [$this, 'handle_geocode_user']);
        
        // Logs d'activité
        add_action('transition_post_status', [$this, 'log_post_status_change'], 10, 3);
    }
    
    /**
     * Programmation des tâches de maintenance
     */
    private function schedule_maintenance_tasks() {
        // Auto-validation des cours après 48h
        if (!wp_next_scheduled('sr_auto_validate_courses')) {
            wp_schedule_event(time() + 3600, 'hourly', 'sr_auto_validate_courses');
        }
        
        // Nettoyage des anciennes demandes
        if (!wp_next_scheduled('sr_cleanup_old_requests')) {
            wp_schedule_event(time() + 3600, 'daily', 'sr_cleanup_old_requests');
        }
        
        // Rappels de notifications
        if (!wp_next_scheduled('sr_send_reminder_notifications')) {
            wp_schedule_event(time() + 3600, 'twicedaily', 'sr_send_reminder_notifications');
        }
    }
    
    /**
     * GESTION DES DEMANDES
     * ================================================================
     */
    
    /**
     * Création d'une nouvelle demande avec validations robustes
     */
    public function create_request($prof_id, $family_id, $metadata = []) {
        // Validations préliminaires
        if (!$this->validate_users($prof_id, $family_id)) {
            return new WP_Error('invalid_users', 'Utilisateurs invalides');
        }
        
        // Vérification anti-doublon
        $existing = $this->get_existing_request($prof_id, $family_id);
        if ($existing) {
            return new WP_Error('duplicate_request', 'Demande déjà existante', [
                'existing_id' => $existing,
                'status' => get_post_meta($existing, '_sr_status', true)
            ]);
        }
        
        // Vérification disponibilité famille
        if ($this->is_family_assigned($family_id)) {
            return new WP_Error('family_assigned', 'Famille déjà assignée à un autre professeur');
        }
        
        // Vérification quota professeur (optionnel)
        if (!$this->check_professor_quota($prof_id)) {
            return new WP_Error('professor_quota_exceeded', 'Quota de demandes simultanées atteint');
        }
        
        // Création de la demande
        $request_data = array_merge([
            'post_type' => 'sr_request',
            'post_status' => 'publish',
            'post_title' => sprintf('Demande prof %d → famille %d', $prof_id, $family_id),
            'post_content' => sprintf(
                'Demande de cours créée le %s par %s',
                current_time('mysql'),
                get_userdata(get_current_user_id())->display_name ?? 'Système'
            ),
            'meta_input' => array_merge([
                '_sr_prof' => $prof_id,
                '_sr_family' => $family_id,
                '_sr_status' => self::STATUS_PENDING,
                '_sr_date' => current_time('mysql'),
                '_sr_ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                '_sr_user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                '_sr_created_by' => get_current_user_id()
            ], $metadata)
        ], $metadata);
        
        $request_id = wp_insert_post($request_data);
        
        if (is_wp_error($request_id)) {
            return $request_id;
        }
        
        // Log de l'activité
        $this->log_request_activity($request_id, 'created', get_current_user_id(), 'Demande créée');
        
        // Notification staff
        $this->notify_new_request($request_id, $prof_id, $family_id);
        
        // Invalidation du cache
        $this->invalidate_request_cache($prof_id, $family_id);
        
        return $request_id;
    }
    
    /**
     * Approbation d'une demande avec notifications
     */
    public function approve_request($request_id, $approved_by = null) {
        $request = get_post($request_id);
        if (!$request || $request->post_type !== 'sr_request') {
            return new WP_Error('invalid_request', 'Demande invalide');
        }
        
        $current_status = get_post_meta($request_id, '_sr_status', true) ?: self::STATUS_PENDING;
        if ($current_status === self::STATUS_APPROVED) {
            return new WP_Error('already_approved', 'Demande déjà approuvée');
        }
        
        $prof_id = intval(get_post_meta($request_id, '_sr_prof', true));
        $family_id = intval(get_post_meta($request_id, '_sr_family', true));
        
        // Vérification finale de disponibilité
        if ($this->is_family_assigned($family_id, $request_id)) {
            return new WP_Error('family_assigned', 'Famille assignée entre-temps à un autre professeur');
        }
        
        // Mise à jour du statut
        $approved_by = $approved_by ?: get_current_user_id();
        $update_result = $this->update_request_status($request_id, self::STATUS_APPROVED, $approved_by, [
            '_sr_approved_at' => current_time('mysql'),
            '_sr_approved_by' => $approved_by
        ]);
        
        if (is_wp_error($update_result)) {
            return $update_result;
        }
        
        // Rejet automatique des autres demandes pour cette famille
        $this->reject_other_requests_for_family($family_id, $request_id);
        
        // Log
        $this->log_request_activity($request_id, 'approved', $approved_by, 'Demande approuvée par admin');
        
        // Notifications
        $this->notify_request_approved($request_id, $prof_id, $family_id);
        
        // Invalidation du cache
        $this->invalidate_request_cache($prof_id, $family_id);
        
        return true;
    }
    
    /**
     * Rejet d'une demande
     */
    public function reject_request($request_id, $reason = '', $rejected_by = null) {
        $request = get_post($request_id);
        if (!$request || $request->post_type !== 'sr_request') {
            return new WP_Error('invalid_request', 'Demande invalide');
        }
        
        $rejected_by = $rejected_by ?: get_current_user_id();
        
        $update_result = $this->update_request_status($request_id, self::STATUS_REJECTED, $rejected_by, [
            '_sr_rejected_at' => current_time('mysql'),
            '_sr_rejected_by' => $rejected_by,
            '_sr_rejection_reason' => sanitize_textarea_field($reason)
        ]);
        
        if (is_wp_error($update_result)) {
            return $update_result;
        }
        
        $prof_id = intval(get_post_meta($request_id, '_sr_prof', true));
        $family_id = intval(get_post_meta($request_id, '_sr_family', true));
        
        // Log
        $this->log_request_activity($request_id, 'rejected', $rejected_by, $reason ?: 'Demande rejetée');
        
        // Notification famille si raison fournie
        if ($reason) {
            $this->notify_request_rejected($request_id, $prof_id, $family_id, $reason);
        }
        
        // Invalidation du cache
        $this->invalidate_request_cache($prof_id, $family_id);
        
        return true;
    }
    
    /**
     * Rupture d'une affectation
     */
    public function break_assignment($request_id, $reason = '', $broken_by = null) {
        $request = get_post($request_id);
        if (!$request || get_post_meta($request_id, '_sr_status', true) !== self::STATUS_APPROVED) {
            return new WP_Error('invalid_assignment', 'Affectation invalide');
        }
        
        $broken_by = $broken_by ?: get_current_user_id();
        
        $update_result = $this->update_request_status($request_id, self::STATUS_ENDED, $broken_by, [
            '_sr_ended_at' => current_time('mysql'),
            '_sr_ended_by' => $broken_by,
            '_sr_end_reason' => sanitize_textarea_field($reason)
        ]);
        
        if (is_wp_error($update_result)) {
            return $update_result;
        }
        
        $prof_id = intval(get_post_meta($request_id, '_sr_prof', true));
        $family_id = intval(get_post_meta($request_id, '_sr_family', true));
        
        // Log
        $this->log_request_activity($request_id, 'ended', $broken_by, $reason ?: 'Affectation terminée');
        
        // Notifications
        $this->notify_assignment_ended($request_id, $prof_id, $family_id, $reason);
        
        // Invalidation du cache
        $this->invalidate_request_cache($prof_id, $family_id);
        
        return true;
    }
    
    /**
     * GESTION DES COURS ET HEURES
     * ================================================================
     */
    
    /**
     * Déclaration d'heures de cours
     */
    public function declare_hours($prof_id, $family_id, $hours, $subject = '', $metadata = []) {
        // Validations
        if (!$this->validate_hours_declaration($prof_id, $family_id, $hours)) {
            return new WP_Error('invalid_declaration', 'Déclaration d\'heures invalide');
        }
        
        // Vérification de l'affectation active
        if (!$this->has_active_assignment($prof_id, $family_id)) {
            return new WP_Error('no_assignment', 'Aucune affectation active trouvée');
        }
        
        // Récupération de la matière si non fournie
        if (!$subject) {
            $subject = $this->get_assignment_subject($prof_id, $family_id);
        }
        
        // Création de la déclaration
        $course_data = array_merge([
            'post_type' => 'sr_course',
            'post_status' => 'publish',
            'post_title' => sprintf('Cours %sh - prof %d / famille %d', $hours, $prof_id, $family_id),
            'post_content' => sprintf(
                'Déclaration de %s heures en %s le %s',
                $hours,
                $subject,
                current_time('d/m/Y H:i')
            ),
            'meta_input' => array_merge([
                '_sr_prof' => $prof_id,
                '_sr_family' => $family_id,
                '_sr_hours' => $hours,
                '_sr_subject' => $subject,
                '_sr_status' => self::COURSE_PENDING,
                '_sr_date' => current_time('mysql'),
                '_sr_auto_validate_at' => date('Y-m-d H:i:s', time() + (self::AUTO_VALIDATE_HOURS * HOUR_IN_SECONDS)),
                '_sr_declared_by' => get_current_user_id(),
                '_sr_declared_ip' => $_SERVER['REMOTE_ADDR'] ?? ''
            ], $metadata)
        ], $metadata);
        
        $course_id = wp_insert_post($course_data);
        
        if (is_wp_error($course_id)) {
            return $course_id;
        }
        
        // Log de l'activité
        $this->log_course_activity($course_id, 'declared', get_current_user_id(), "Déclaration de {$hours}h en {$subject}");
        
        // Notification famille
        $this->notify_hours_declared($course_id, $prof_id, $family_id, $hours, $subject);
        
        return $course_id;
    }
    
    /**
     * Validation d'une déclaration d'heures
     */
    public function validate_hours($course_id, $status = self::COURSE_PAID, $validated_by = null) {
        $course = get_post($course_id);
        if (!$course || $course->post_type !== 'sr_course') {
            return new WP_Error('invalid_course', 'Déclaration invalide');
        }
        
        $current_status = get_post_meta($course_id, '_sr_status', true) ?: self::COURSE_PENDING;
        if ($current_status !== self::COURSE_PENDING) {
            return new WP_Error('already_validated', 'Déclaration déjà validée');
        }
        
        $validated_by = $validated_by ?: get_current_user_id();
        
        // Mise à jour du statut
        update_post_meta($course_id, '_sr_status', $status);
        update_post_meta($course_id, '_sr_validated_at', current_time('mysql'));
        update_post_meta($course_id, '_sr_validated_by', $validated_by);
        
        if ($status === self::COURSE_PAID) {
            update_post_meta($course_id, '_sr_paid_at', current_time('mysql'));
        } elseif ($status === self::COURSE_ADVANCE) {
            update_post_meta($course_id, '_sr_advance_at', current_time('mysql'));
        }
        
        // Log
        $this->log_course_activity($course_id, 'validated', $validated_by, "Statut changé vers {$status}");
        
        return true;
    }
    
    /**
     * TÂCHES AUTOMATISÉES
     * ================================================================
     */
    
    /**
     * Auto-validation des cours après délai
     */
    public function auto_validate_pending_courses() {
        global $wpdb;
        
        // Récupération des cours en attente depuis plus de 48h
        $course_ids = $wpdb->get_col($wpdb->prepare("
            SELECT p.ID 
            FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm_status ON p.ID = pm_status.post_id AND pm_status.meta_key = '_sr_status'
            JOIN {$wpdb->postmeta} pm_date ON p.ID = pm_date.post_id AND pm_date.meta_key = '_sr_date'
            WHERE p.post_type = 'sr_course'
              AND pm_status.meta_value = %s
              AND pm_date.meta_value < %s
        ", self::COURSE_PENDING, date('Y-m-d H:i:s', time() - (self::AUTO_VALIDATE_HOURS * HOUR_IN_SECONDS))));
        
        $validated_count = 0;
        foreach ($course_ids as $course_id) {
            $result = $this->validate_hours($course_id, self::COURSE_PAID, 0); // 0 = auto-validation
            if (!is_wp_error($result)) {
                $validated_count++;
                
                // Log spécial pour auto-validation
                $this->log_course_activity($course_id, 'auto_validated', 0, 'Auto-validation après 48h');
            }
        }
        
        if ($validated_count > 0) {
            SR_Core::log("Auto-validated {$validated_count} courses after " . self::AUTO_VALIDATE_HOURS . " hours", 'info');
        }
        
        return $validated_count;
    }
    
    /**
     * Nettoyage des anciennes demandes
     */
    public function cleanup_old_requests() {
        // Suppression des demandes rejetées de plus de 6 mois
        $old_requests = get_posts([
            'post_type' => 'sr_request',
            'fields' => 'ids',
            'numberposts' => -1,
            'date_query' => [
                [
                    'before' => date('Y-m-d', strtotime('-6 months'))
                ]
            ],
            'meta_query' => [
                ['key' => '_sr_status', 'value' => self::STATUS_REJECTED]
            ]
        ]);
        
        $deleted_count = 0;
        foreach ($old_requests as $request_id) {
            if (wp_delete_post($request_id, true)) {
                $deleted_count++;
            }
        }
        
        if ($deleted_count > 0) {
            SR_Core::log("Cleaned up {$deleted_count} old rejected requests", 'info');
        }
        
        return $deleted_count;
    }
    
    /**
     * UTILITAIRES ET VALIDATIONS
     * ================================================================
     */
    
    /**
     * Validation des utilisateurs
     */
    private function validate_users($prof_id, $family_id) {
        $prof = get_userdata($prof_id);
        $family = get_userdata($family_id);
        
        if (!$prof || !$family) {
            return false;
        }
        
        // Vérification des rôles
        if (!in_array('um_professeur', $prof->roles) || !in_array('um_famille', $family->roles)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Vérification d'une demande existante
     */
    private function get_existing_request($prof_id, $family_id) {
        $existing = get_posts([
            'post_type' => 'sr_request',
            'post_status' => 'any',
            'fields' => 'ids',
            'numberposts' => 1,
            'meta_query' => [
                ['key' => '_sr_prof', 'value' => $prof_id],
                ['key' => '_sr_family', 'value' => $family_id],
                ['key' => '_sr_status', 'value' => [self::STATUS_PENDING, self::STATUS_APPROVED], 'compare' => 'IN']
            ]
        ]);
        
        return $existing ? $existing[0] : false;
    }
    
    /**
     * Vérification si une famille est déjà assignée
     */
    private function is_family_assigned($family_id, $exclude_request = null) {
        $args = [
            'post_type' => 'sr_request',
            'fields' => 'ids',
            'numberposts' => 1,
            'meta_query' => [
                ['key' => '_sr_family', 'value' => $family_id],
                ['key' => '_sr_status', 'value' => self::STATUS_APPROVED]
            ]
        ];
        
        if ($exclude_request) {
            $args['post__not_in'] = [$exclude_request];
        }
        
        return !empty(get_posts($args));
    }
    
    /**
     * Mise à jour du statut d'une demande
     */
    private function update_request_status($request_id, $status, $updated_by, $additional_meta = []) {
        $result = update_post_meta($request_id, '_sr_status', $status);
        if (!$result) {
            return new WP_Error('update_failed', 'Échec de mise à jour du statut');
        }
        
        update_post_meta($request_id, '_sr_last_updated_at', current_time('mysql'));
        update_post_meta($request_id, '_sr_last_updated_by', $updated_by);
        
        foreach ($additional_meta as $key => $value) {
            update_post_meta($request_id, $key, $value);
        }
        
        return true;
    }
    
    /**
     * LOGGING ET CACHE
     * ================================================================
     */
    
    /**
     * Log d'activité pour les demandes
     */
    private function log_request_activity($request_id, $action, $user_id, $note = '') {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'sr_request_logs';
        
        // Création de la table si elle n'existe pas
        $this->maybe_create_logs_table();
        
        $wpdb->insert(
            $table_name,
            [
                'request_id' => $request_id,
                'action' => $action,
                'user_id' => $user_id,
                'note' => $note,
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'created_at' => current_time('mysql')
            ],
            ['%d', '%s', '%d', '%s', '%s', '%s', '%s']
        );
    }
    
    /**
     * Log d'activité pour les cours
     */
    private function log_course_activity($course_id, $action, $user_id, $note = '') {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'sr_course_logs';
        
        $this->maybe_create_logs_table('course');
        
        $wpdb->insert(
            $table_name,
            [
                'course_id' => $course_id,
                'action' => $action,
                'user_id' => $user_id,
                'note' => $note,
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'created_at' => current_time('mysql')
            ],
            ['%d', '%s', '%d', '%s', '%s', '%s', '%s']
        );
    }
    
    /**
     * Création des tables de logs si nécessaires
     */
    private function maybe_create_logs_table($type = 'request') {
        global $wpdb;
        
        $table_name = $wpdb->prefix . "sr_{$type}_logs";
        $id_column = $type === 'request' ? 'request_id' : 'course_id';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            {$id_column} bigint(20) NOT NULL,
            action varchar(50) NOT NULL,
            user_id bigint(20) NOT NULL DEFAULT 0,
            note text,
            ip_address varchar(45),
            user_agent text,
            created_at datetime NOT NULL,
            PRIMARY KEY (id),
            KEY {$id_column} ({$id_column}),
            KEY action (action),
            KEY created_at (created_at)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
    
    /**
     * Invalidation du cache
     */
    private function invalidate_request_cache($prof_id, $family_id) {
        $cache_keys = [
            "sr_students_{$prof_id}",
            "family_availability_{$family_id}",
            "prof_requests_{$prof_id}"
        ];
        
        foreach ($cache_keys as $key) {
            wp_cache_delete($key, 'sr_request_queries');
        }
    }
    
    /**
     * MÉTHODES PLACEHOLDER À COMPLÉTER
     */
    private function check_professor_quota($prof_id) { return true; }
    private function reject_other_requests_for_family($family_id, $exclude_id) {}
    private function notify_new_request($request_id, $prof_id, $family_id) {}
    private function notify_request_approved($request_id, $prof_id, $family_id) {}
    private function notify_request_rejected($request_id, $prof_id, $family_id, $reason) {}
    private function notify_assignment_ended($request_id, $prof_id, $family_id, $reason) {}
    private function notify_hours_declared($course_id, $prof_id, $family_id, $hours, $subject) {}
    private function validate_hours_declaration($prof_id, $family_id, $hours) { return $hours > 0 && $hours <= 10; }
    private function has_active_assignment($prof_id, $family_id) { return true; }
    private function get_assignment_subject($prof_id, $family_id) { return ''; }
    private function send_reminder_notifications() {}
    public function handle_geocode_user($user_id) {
        SR_Core::get_module('geocoding')::geocode_user($user_id);
    }
    public function log_post_status_change($new_status, $old_status, $post) {}
}