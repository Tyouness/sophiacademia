<?php
/**
 * includes/class-sr-shortcodes.php
 * Gestion des shortcodes et interfaces front-end pour Sophiacademia
 * 
 * @package Sophiacademia
 * @version 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class SR_Shortcodes {
    
    /**
     * Configuration des shortcodes
     */
    private $shortcodes_config = [];
    
    /**
     * Assets déjà chargés (éviter doublons)
     */
    private static $loaded_assets = [];
    
    /**
     * Cache des données shortcodes
     */
    private static $shortcode_cache = [];
    
    public function __construct() {
        $this->init_shortcodes_config();
        $this->register_shortcodes();
        $this->init_hooks();
    }
    
    /**
     * CONFIGURATION DES SHORTCODES
     * ================================================================
     */
    
    /**
     * Configuration centralisée des shortcodes
     */
    private function init_shortcodes_config() {
        $this->shortcodes_config = [
            'sr_offers' => [
                'callback' => 'render_offers',
                'required_role' => 'um_professeur',
                'required_capability' => 'sr_view_offers',
                'assets' => ['leaflet', 'sr-offers'],
                'default_atts' => ['radius' => 25],
                'cache_duration' => 30 * MINUTE_IN_SECONDS,
                'description' => 'Interface offres de cours pour professeurs'
            ],
            'sr_students' => [
                'callback' => 'render_students',
                'required_role' => 'um_professeur',
                'required_capability' => 'sr_view_students',
                'assets' => ['leaflet', 'sr-students'],
                'cache_duration' => 15 * MINUTE_IN_SECONDS,
                'description' => 'Interface "Mes élèves" pour professeurs'
            ],
            'sr_fam_courses' => [
                'callback' => 'render_family_courses',
                'required_role' => 'um_famille',
                'required_capability' => 'sr_view_courses',
                'assets' => ['toastify', 'sr-fam-courses'],
                'cache_duration' => 10 * MINUTE_IN_SECONDS,
                'description' => 'Historique des cours pour familles'
            ],
            'sr_acomptes' => [
                'callback' => 'render_professor_payments',
                'required_role' => 'um_professeur',
                'required_capability' => 'sr_view_payments',
                'assets' => ['sr-payments'],
                'cache_duration' => 15 * MINUTE_IN_SECONDS,
                'description' => 'Acomptes et paiements pour professeurs'
            ],
            'sr_family_consos' => [
                'callback' => 'render_family_consumption',
                'required_role' => 'um_famille',
                'required_capability' => 'sr_view_consumption',
                'assets' => ['sr-families-consos'],
                'cache_duration' => 20 * MINUTE_IN_SECONDS,
                'description' => 'Consommations mensuelles pour familles'
            ],
            'sr_family_invoices' => [
                'callback' => 'render_family_invoices',
                'required_role' => 'um_famille',
                'required_capability' => 'sr_view_invoices',
                'assets' => ['sr-families-invoices'],
                'cache_duration' => 60 * MINUTE_IN_SECONDS,
                'description' => 'Factures mensuelles pour familles'
            ],
            'sr_staff' => [
                'callback' => 'render_staff_interface',
                'required_role' => 'sr_staff',
                'required_capability' => 'sr_view_staff',
                'assets' => ['toastify', 'sr-staff'],
                'cache_duration' => 0, // Pas de cache pour l'interface staff
                'description' => 'Interface d\'administration staff'
            ]
        ];
    }
    
    /**
     * Enregistrement de tous les shortcodes
     */
    private function register_shortcodes() {
        foreach ($this->shortcodes_config as $shortcode => $config) {
            add_shortcode($shortcode, [$this, 'render_shortcode_wrapper']);
        }
    }
    
    /**
     * Initialisation des hooks
     */
    private function init_hooks() {
        add_action('wp_enqueue_scripts', [$this, 'maybe_enqueue_shortcode_assets'], 20);
        add_filter('the_content', [$this, 'detect_shortcodes_in_content'], 5);
    }
    
    /**
     * WRAPPER PRINCIPAL
     * ================================================================
     */
    
    /**
     * Wrapper principal pour tous les shortcodes avec sécurité et cache
     */
    public function render_shortcode_wrapper($atts, $content, $tag) {
        if (!isset($this->shortcodes_config[$tag])) {
            return '<div class="sr-error">Shortcode non configuré.</div>';
        }
        
        $config = $this->shortcodes_config[$tag];
        
        // Vérification de sécurité
        $security_check = $this->verify_shortcode_access($config);
        if ($security_check !== true) {
            return $security_check;
        }
        
        // Traitement des attributs
        $processed_atts = shortcode_atts($config['default_atts'] ?? [], $atts, $tag);
        
        // Gestion du cache
        $cache_key = $this->generate_shortcode_cache_key($tag, $processed_atts);
        $cache_duration = $config['cache_duration'] ?? 0;
        
        if ($cache_duration > 0) {
            $cached_content = $this->get_shortcode_cache($cache_key);
            if ($cached_content !== false) {
                $this->enqueue_shortcode_assets($config['assets'] ?? []);
                return $cached_content;
            }
        }
        
        // Exécution du callback
        $callback_method = $config['callback'];
        if (!method_exists($this, $callback_method)) {
            return '<div class="sr-error">Méthode de rendu non trouvée.</div>';
        }
        
        $output = $this->$callback_method($processed_atts, $content, $tag);
        
        // Mise en cache
        if ($cache_duration > 0 && !empty($output)) {
            $this->set_shortcode_cache($cache_key, $output, $cache_duration);
        }
        
        // Chargement des assets
        $this->enqueue_shortcode_assets($config['assets'] ?? []);
        
        return $output;
    }
    
    /**
     * VÉRIFICATIONS DE SÉCURITÉ
     * ================================================================
     */
    
    /**
     * Vérification de l'accès au shortcode
     */
    private function verify_shortcode_access($config) {
        // Vérification utilisateur connecté
        if (!is_user_logged_in()) {
            return $this->render_login_required();
        }
        
        $user = wp_get_current_user();
        
        // Vérification du rôle requis
        if (isset($config['required_role']) && !in_array($config['required_role'], $user->roles)) {
            return $this->render_access_denied($config['required_role']);
        }
        
        // Vérification de la capability
        if (isset($config['required_capability']) && !current_user_can($config['required_capability'])) {
            return $this->render_insufficient_permissions();
        }
        
        return true;
    }
    
    /**
     * Messages d'erreur standardisés
     */
    private function render_login_required() {
        return '<div class="sr-message sr-login-required">
            <p>Veuillez vous connecter pour accéder à cette section.</p>
            <p><a href="' . wp_login_url(get_permalink()) . '" class="sr-btn">Se connecter</a></p>
        </div>';
    }
    
    private function render_access_denied($required_role) {
        $role_labels = [
            'um_famille' => 'familles',
            'um_professeur' => 'professeurs',
            'sr_staff' => 'personnel administratif'
        ];
        
        $label = $role_labels[$required_role] ?? 'utilisateurs autorisés';
        
        return '<div class="sr-message sr-access-denied">
            <p>Accès réservé aux ' . esc_html($label) . '.</p>
        </div>';
    }
    
    private function render_insufficient_permissions() {
        return '<div class="sr-message sr-insufficient-permissions">
            <p>Permissions insuffisantes pour accéder à cette section.</p>
        </div>';
    }
    
    /**
     * SHORTCODES PROFESSEURS
     * ================================================================
     */
    
    /**
     * [sr_offers] - Interface offres pour professeurs
     */
    public function render_offers($atts, $content, $tag) {
        $radius = max(5, min(100, floatval($atts['radius']))); // Limite 5-100km
        $user = wp_get_current_user();
        
        // Vérification géolocalisation professeur
        $prof_lat = floatval(get_user_meta($user->ID, 'sr_lat', true));
        $prof_lng = floatval(get_user_meta($user->ID, 'sr_lng', true));
        
        if (!$prof_lat || !$prof_lng) {
            return '<div class="sr-message sr-no-location">
                <h3>Géolocalisation requise</h3>
                <p>Votre adresse n\'est pas géolocalisée. Contactez l\'administration pour corriger cela.</p>
                <p><a href="mailto:' . SR_BCC_AGENCE . '" class="sr-btn">Contacter l\'administration</a></p>
            </div>';
        }
        
        // Récupération des offres
        $offers = $this->get_offers_for_professor($user->ID, $prof_lat, $prof_lng, $radius);
        
        // Configuration JavaScript
        $this->localize_script('sr-offers', 'sr_front', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'prof_id' => $user->ID,
            'nonce' => wp_create_nonce('sr_nonce'),
        ]);
        
        // Données pour le front
        wp_add_inline_script('sr-offers', sprintf(
            'window.srOffers = %s; window.srCenter = [%f, %f]; window.srDistance = "km";',
            wp_json_encode($offers),
            $prof_lat,
            $prof_lng
        ), 'before');
        
        $offers_count = count($offers);
        
        return '<div id="sr-offers-app" class="sr-wrapper">
            <div class="sr-offers-header">
                <h2>Offres de cours à proximité</h2>
                <div class="sr-offers-meta">
                    <span class="sr-offers-count">' . $offers_count . ' famille(s) dans un rayon de ' . $radius . ' km</span>
                    <span class="sr-offers-location">Votre position : ' . esc_html(get_user_meta($user->ID, 'sr_city', true)) . '</span>
                </div>
            </div>
            ' . ($offers_count > 0 ? '
            <div class="sr-offers-content">
                <div id="sr-offers-list" class="sr-offers-column"></div>
                <div id="sr-offers-map" class="sr-offers-column"></div>
            </div>' : '
            <div class="sr-no-offers">
                <p>Aucune famille ne recherche de professeur dans votre secteur actuellement.</p>
                <p>Vérifiez régulièrement ou contactez l\'administration pour élargir votre zone.</p>
            </div>') . '
        </div>';
    }
    
    /**
     * [sr_students] - Interface "Mes élèves" pour professeurs
     */
    public function render_students($atts, $content, $tag) {
        $user = wp_get_current_user();
        
        // Configuration JavaScript
        $this->localize_script('sr-students', 'sr_students_vars', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('sr_nonce'),
            'prof_id' => $user->ID,
        ]);
        
        return '<div id="sr-students-app" class="sr-wrapper">
            <div class="sr-students-header">
                <h2>Mes élèves</h2>
                <p class="sr-students-desc">Gérez vos élèves et déclarez vos heures de cours.</p>
            </div>
            <div id="sr-students-grid" class="sr-students-grid">
                <div class="sr-loading">
                    <span class="sr-spinner"></span>
                    <span>Chargement de vos élèves...</span>
                </div>
            </div>
        </div>';
    }
    
    /**
     * [sr_acomptes] - Acomptes pour professeurs
     */
    public function render_professor_payments($atts, $content, $tag) {
        $user = wp_get_current_user();
        $payments = $this->get_professor_payments($user->ID);
        
        if (empty($payments)) {
            return '<div class="sr-wrapper">
                <h2>Mes acomptes</h2>
                <div class="sr-no-data">
                    <p>Aucun acompte enregistré pour le moment.</p>
                    <p>Les acomptes apparaîtront ici après validation de vos déclarations d\'heures.</p>
                </div>
            </div>';
        }
        
        ob_start();
        ?>
        <div class="sr-wrapper">
            <div class="sr-payments-header">
                <h2>Mes acomptes</h2>
                <div class="sr-payments-summary">
                    <?php
                    $total_hours = 0;
                    $total_amount = 0;
                    foreach ($payments as $payment) {
                        $total_hours += floatval($payment['hours']);
                        $total_amount += floatval($payment['hours']) * 25; // Exemple tarif
                    }
                    ?>
                    <div class="sr-summary-card">
                        <span class="sr-summary-number"><?php echo number_format_i18n($total_hours, 1); ?>h</span>
                        <span class="sr-summary-label">Total heures</span>
                    </div>
                    <div class="sr-summary-card">
                        <span class="sr-summary-number"><?php echo number_format_i18n($total_amount, 0); ?>€</span>
                        <span class="sr-summary-label">Total montant</span>
                    </div>
                </div>
            </div>
            
            <table class="sr-pay-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Famille</th>
                        <th>Heures</th>
                        <th>Statut</th>
                        <th>Montant</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($payments as $payment): ?>
                    <tr>
                        <td><?php echo esc_html(date_i18n('d/m/Y', strtotime($payment['date']))); ?></td>
                        <td><?php echo esc_html($payment['family_name']); ?></td>
                        <td><?php echo esc_html(number_format_i18n($payment['hours'], 1)); ?></td>
                        <td>
                            <span class="sr-tag <?php echo esc_attr(strtolower($payment['status'])); ?>">
                                <?php echo esc_html(ucfirst($payment['status'])); ?>
                            </span>
                        </td>
                        <td><?php echo esc_html(number_format_i18n(floatval($payment['hours']) * 25, 0)); ?>€</td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
        return ob_get_clean();
    }
    
    /**
     * SHORTCODES FAMILLES
     * ================================================================
     */
    
    /**
     * [sr_fam_courses] - Historique cours pour familles
     */
    public function render_family_courses($atts, $content, $tag) {
        $user = wp_get_current_user();
        $courses_data = $this->get_family_courses_data($user->ID);
        
        // Configuration JavaScript
        $this->localize_script('sr-fam-courses', 'srFamCoursesData', $courses_data);
        
        return '<div class="sr-wrapper">
            <div class="sr-courses-header">
                <h2>Mes cours particuliers</h2>
                <div class="sr-courses-summary">
                    <div class="sr-summary-card">
                        <span class="sr-summary-number">' . count($courses_data['courses']) . '</span>
                        <span class="sr-summary-label">Cours total</span>
                    </div>
                    <div class="sr-summary-card">
                        <span class="sr-summary-number">' . count($courses_data['profOptions']) . '</span>
                        <span class="sr-summary-label">Professeur(s)</span>
                    </div>
                </div>
            </div>
            
            <div class="sr-filters">
                <label>Professeur&nbsp;
                    <select id="sr-filter-prof"></select>
                </label>
                <label style="margin-left:12px">Période&nbsp;
                    <select id="sr-filter-month"></select>
                </label>
            </div>
            
            <div id="sr-courses-wrapper">
                <div class="sr-loading">Chargement des cours...</div>
            </div>
        </div>';
    }
    
    /**
     * [sr_family_consos] - Consommations pour familles
     */
    public function render_family_consumption($atts, $content, $tag) {
        $user = wp_get_current_user();
        $consumption_data = $this->get_family_consumption($user->ID);
        
        if (empty($consumption_data)) {
            return '<div class="sr-wrapper">
                <h2>Mes consommations</h2>
                <div class="sr-no-data">
                    <p>Aucune consommation enregistrée pour le moment.</p>
                    <p>Vos consommations apparaîtront ici après les premiers cours.</p>
                </div>
            </div>';
        }
        
        $total_hours = array_sum(array_column($consumption_data, 'hours'));
        $total_net = array_sum(array_column($consumption_data, 'net_amount'));
        
        ob_start();
        ?>
        <div class="sr-wrapper">
            <div class="sr-consumption-header">
                <h2>Mes consommations</h2>
                <div class="sr-consumption-summary">
                    <div class="sr-summary-card">
                        <span class="sr-summary-number"><?php echo number_format_i18n($total_hours, 1); ?>h</span>
                        <span class="sr-summary-label">Total heures</span>
                    </div>
                    <div class="sr-summary-card">
                        <span class="sr-summary-number"><?php echo number_format_i18n($total_net, 0); ?>€</span>
                        <span class="sr-summary-label">Total à charge</span>
                    </div>
                </div>
            </div>
            
            <table class="sr-conso-table">
                <thead>
                    <tr>
                        <th>Mois</th>
                        <th>Heures</th>
                        <th>Total € (avant crédit)</th>
                        <th>À charge € (-50%)</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($consumption_data as $data): ?>
                    <tr>
                        <td><?php echo esc_html($data['month_label']); ?></td>
                        <td><?php echo esc_html(number_format_i18n($data['hours'], 1)); ?></td>
                        <td><?php echo esc_html(number_format_i18n($data['gross_amount'], 2)); ?> €</td>
                        <td><strong><?php echo esc_html(number_format_i18n($data['net_amount'], 2)); ?> €</strong></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
        return ob_get_clean();
    }
    
    /**
     * [sr_family_invoices] - Factures pour familles
     */
    public function render_family_invoices($atts, $content, $tag) {
        $user = wp_get_current_user();
        
        // Récupération des factures (post_type sr_invoice)
        $invoices = get_posts([
            'post_type' => 'sr_invoice',
            'meta_key' => '_sr_period',
            'orderby' => 'meta_value',
            'order' => 'DESC',
            'meta_query' => [
                ['key' => '_sr_family', 'value' => $user->ID]
            ],
            'numberposts' => -1
        ]);
        
        if (empty($invoices)) {
            return '<div class="sr-wrapper">
                <h2>Mes factures</h2>
                <div class="sr-no-data">
                    <p>Aucune facture disponible pour le moment.</p>
                    <p>Les factures seront générées automatiquement chaque mois.</p>
                </div>
            </div>';
        }
        
        ob_start();
        ?>
        <div class="sr-wrapper">
            <h2>Mes factures mensuelles</h2>
            <table class="sr-inv-table">
                <thead>
                    <tr>
                        <th>Période</th>
                        <th>Montant</th>
                        <th>Statut</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($invoices as $invoice): ?>
                    <?php
                    $period = get_post_meta($invoice->ID, '_sr_period', true);
                    $total = get_post_meta($invoice->ID, '_sr_total', true);
                    $status = get_post_meta($invoice->ID, '_sr_status', true) ?: 'generated';
                    $pdf_id = get_post_meta($invoice->ID, '_sr_pdf', true);
                    ?>
                    <tr>
                        <td><?php echo esc_html(date_i18n('F Y', strtotime($period . '-01'))); ?></td>
                        <td><?php echo esc_html(number_format_i18n($total, 2)); ?> €</td>
                        <td>
                            <span class="sr-status sr-status-<?php echo esc_attr($status); ?>">
                                <?php echo esc_html(ucfirst($status)); ?>
                            </span>
                        </td>
                        <td>
                            <?php if ($pdf_id): ?>
                            <a href="<?php echo esc_url(wp_get_attachment_url($pdf_id)); ?>" 
                               class="button" target="_blank">Télécharger PDF</a>
                            <?php else: ?>
                            <span class="sr-text-muted">En cours de génération</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php
        return ob_get_clean();
    }
    
    /**
     * SHORTCODE STAFF
     * ================================================================
     */
    
    /**
     * [sr_staff] - Interface staff
     */
    public function render_staff_interface($atts, $content, $tag) {
        // Configuration JavaScript
        $this->localize_script('sr-staff', 'sr_staff_vars', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('sr_staff_nonce')
        ]);
        
        return '<div id="sr-staff-app" class="sr-wrapper">
            <div class="sr-staff-header">
                <h2>Extranet Staff</h2>
                <p class="sr-staff-desc">Interface de gestion Sophiacademia</p>
            </div>
            
            <nav class="sr-tabs">
                <button data-tab="req" class="sr-tab-button active">Demandes</button>
                <button data-tab="aff" class="sr-tab-button">Affectations</button>
                <button data-tab="hrs" class="sr-tab-button">Heures déclarées</button>
                <span class="sr-separator"></span>
                <button data-tab="allusers" class="sr-tab-button">Utilisateurs</button>
                <button data-tab="addfam" class="sr-tab-button">Ajouter famille</button>
                <button data-tab="addprof" class="sr-tab-button">Ajouter professeur</button>
            </nav>
            
            <div class="sr-tab-content">
                <section id="sr-tab-req" class="sr-tab-panel active"></section>
                <section id="sr-tab-aff" class="sr-tab-panel"></section>
                <section id="sr-tab-hrs" class="sr-tab-panel"></section>
                <section id="sr-tab-allusers" class="sr-tab-panel"></section>
                <section id="sr-tab-addfam" class="sr-tab-panel"></section>
                <section id="sr-tab-addprof" class="sr-tab-panel"></section>
            </div>
        </div>';
    }
    
    /**
     * GESTION DES ASSETS
     * ================================================================
     */
    
    /**
     * Détection des shortcodes dans le contenu
     */
    public function detect_shortcodes_in_content($content) {
        foreach ($this->shortcodes_config as $shortcode => $config) {
            if (has_shortcode($content, $shortcode)) {
                $this->enqueue_shortcode_assets($config['assets'] ?? []);
            }
        }
        return $content;
    }
    
    /**
     * Chargement conditionnel des assets
     */
    public function maybe_enqueue_shortcode_assets() {
        // Chargement uniquement si nécessaire
        global $post;
        if (!$post) return;
        
        foreach ($this->shortcodes_config as $shortcode => $config) {
            if (has_shortcode($post->post_content, $shortcode)) {
                $this->enqueue_shortcode_assets($config['assets'] ?? []);
            }
        }
    }
    
    /**
     * Chargement des assets spécifiques
     */
    private function enqueue_shortcode_assets($assets) {
        foreach ($assets as $asset) {
            if (in_array($asset, self::$loaded_assets)) {
                continue; // Déjà chargé
            }
            
            switch ($asset) {
                case 'leaflet':
                    wp_enqueue_style('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
                    wp_enqueue_script('leaflet', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', [], null, true);
                    break;
                    
                case 'toastify':
                    wp_enqueue_script('toastify', 'https://cdn.jsdelivr.net/npm/toastify-js', [], '1.12.0', true);
                    break;
                    
                default:
                    // Assets locaux
                    $css_file = SR_PLUGIN_URL . "assets/css/{$asset}.css";
                    $js_file = SR_PLUGIN_URL . "assets/js/{$asset}.js";
                    
                    if (file_exists(SR_PLUGIN_DIR . "assets/css/{$asset}.css")) {
                        wp_enqueue_style($asset, $css_file, ['sr-core'], SR_VERSION);
                    }
                    
                    if (file_exists(SR_PLUGIN_DIR . "assets/js/{$asset}.js")) {
                        $deps = ($asset === 'sr-offers') ? ['jquery', 'leaflet'] : ['jquery'];
                        wp_enqueue_script($asset, $js_file, $deps, SR_VERSION, true);
                    }
                    break;
            }
            
            self::$loaded_assets[] = $asset;
        }
    }
    
    /**
     * Localisation de script sécurisée
     */
    private function localize_script($handle, $object_name, $data) {
        if (!wp_script_is($handle, 'registered')) {
            return;
        }
        
        wp_localize_script($handle, $object_name, $data);
    }
    
    /**
     * DONNÉES ET CACHE
     * ================================================================
     */
    
    /**
     * Récupération des offres pour un professeur
     */
    private function get_offers_for_professor($prof_id, $prof_lat, $prof_lng, $radius) {
        $database = SR_Core::get_module('database');
        if (!$database) return [];
        
        $families = $database->get_families_in_radius($prof_lat, $prof_lng, $radius);
        
        if (empty($families)) return [];
        
        // Filtrage des familles disponibles
        $family_ids = array_column($families, 'ID');
        $assigned_families = $database->check_family_availability($family_ids);
        $requested_families = $database->get_professor_existing_requests($prof_id, $family_ids);
        $requested_family_ids = array_column($requested_families, 'family_id');
        
        $offers = [];
        foreach ($families as $family) {
            $family_id = intval($family->ID);
            
            if (in_array($family_id, $assigned_families) || in_array($family_id, $requested_family_ids)) {
                continue;
            }
            
            $offers[] = [
                'id' => $family_id,
                'name' => $family->display_name,
                'lat' => floatval($family->lat),
                'lng' => floatval($family->lng),
                'dist' => round(floatval($family->distance ?? 0), 1),
                'city' => $family->city,
                'level' => $family->level,
                'subject' => $family->subject,
                'gender' => $family->gender,
                'freq' => $family->freq,
                'duration' => $family->duration,
                'period' => $family->period,
                'start' => $family->start_date,
            ];
        }
        
        return $offers;
    }
    
    /**
     * Cache des shortcodes
     */
    private function generate_shortcode_cache_key($shortcode, $atts) {
        return 'sr_shortcode_' . $shortcode . '_' . get_current_user_id() . '_' . md5(serialize($atts));
    }
    
    private function get_shortcode_cache($key) {
        return get_transient($key);
    }
    
    private function set_shortcode_cache($key, $content, $duration) {
        set_transient($key, $content, $duration);
    }
    
    /**
     * Helpers pour les données (à implémenter selon besoins)
     */
    private function get_family_courses_data($family_id) {
        $database = SR_Core::get_module('database');
        if ($database) {
            $result = $database->get_family_courses_with_summary($family_id);
            return [
                'courses' => $result['courses'] ?? [],
                'profOptions' => [], // À calculer
                'monthOptions' => [] // À calculer
            ];
        }
        return ['courses' => [], 'profOptions' => [], 'monthOptions' => []];
    }
    
    private function get_professor_payments($prof_id) {
        // Requête simplifiée pour les paiements
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare("
            SELECT pm_date.meta_value as date,
                   pm_hours.meta_value as hours,
                   pm_status.meta_value as status,
                   u.display_name as family_name
            FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm_prof ON p.ID = pm_prof.post_id AND pm_prof.meta_key = '_sr_prof'
            JOIN {$wpdb->postmeta} pm_family ON p.ID = pm_family.post_id AND pm_family.meta_key = '_sr_family'
            LEFT JOIN {$wpdb->postmeta} pm_date ON p.ID = pm_date.post_id AND pm_date.meta_key = '_sr_date'
            LEFT JOIN {$wpdb->postmeta} pm_hours ON p.ID = pm_hours.post_id AND pm_hours.meta_key = '_sr_hours'
            LEFT JOIN {$wpdb->postmeta} pm_status ON p.ID = pm_status.post_id AND pm_status.meta_key = '_sr_status'
            LEFT JOIN {$wpdb->users} u ON pm_family.meta_value = u.ID
            WHERE p.post_type = 'sr_course'
              AND pm_prof.meta_value = %d
              AND pm_status.meta_value IN ('advance', 'paid')
            ORDER BY pm_date.meta_value DESC
        ", $prof_id), ARRAY_A);
    }
    
    private function get_family_consumption($family_id) {
        global $wpdb;
        
        $results = $wpdb->get_results($wpdb->prepare("
            SELECT DATE_FORMAT(pm_date.meta_value, '%%Y-%%m') as month_key,
                   SUM(CAST(pm_hours.meta_value AS DECIMAL(5,2))) as total_hours
            FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm_family ON p.ID = pm_family.post_id AND pm_family.meta_key = '_sr_family'
            JOIN {$wpdb->postmeta} pm_date ON p.ID = pm_date.post_id AND pm_date.meta_key = '_sr_date'
            JOIN {$wpdb->postmeta} pm_hours ON p.ID = pm_hours.post_id AND pm_hours.meta_key = '_sr_hours'
            WHERE p.post_type = 'sr_course'
              AND pm_family.meta_value = %d
            GROUP BY month_key
            ORDER BY month_key DESC
        ", $family_id), ARRAY_A);
        
        $consumption = [];
        foreach ($results as $result) {
            $hours = floatval($result['total_hours']);
            $gross = $hours * SR_Core::FAMILY_HOURLY_RATE;
            $net = $hours * SR_Core::FAMILY_NET_HOURLY;
            
            $consumption[] = [
                'month_key' => $result['month_key'],
                'month_label' => date_i18n('F Y', strtotime($result['month_key'] . '-01')),
                'hours' => $hours,
                'gross_amount' => $gross,
                'net_amount' => $net
            ];
        }
        
        return $consumption;
    }
}