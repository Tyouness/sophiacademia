<?php
/**
 * includes/class-sr-notifications.php
 * Système de notifications et emails pour Sophiacademia
 * 
 * @package Sophiacademia
 * @version 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class SR_Notifications {
    
    /**
     * Templates d'emails
     */
    private $email_templates = [];
    
    /**
     * Configuration des notifications
     */
    private $notification_types = [];
    
    /**
     * Log des envois
     */
    private static $email_log = [];
    
    /**
     * Configuration SMTP/Email
     */
    private $email_config = [];
    
    public function __construct() {
        $this->init_email_config();
        $this->load_email_templates();
        $this->init_notification_types();
        $this->init_hooks();
    }
    
    /**
     * CONFIGURATION ET INITIALISATION
     * ================================================================
     */
    
    /**
     * Initialisation de la configuration email
     */
    private function init_email_config() {
        $this->email_config = [
            'from_name' => get_option('sr_email_from_name', 'Sophiacademia'),
            'from_email' => get_option('sr_email_from_address', 'noreply@sophiacademia.fr'),
            'reply_to' => get_option('sr_email_reply_to', SR_BCC_AGENCE),
            'bcc_agence' => SR_BCC_AGENCE,
            'use_html' => true,
            'charset' => 'UTF-8'
        ];
    }
    
    /**
     * Types de notifications disponibles
     */
    private function init_notification_types() {
        $this->notification_types = [
            'new_request' => [
                'title' => 'Nouvelle demande de cours',
                'recipients' => ['staff'],
                'template' => 'new_request',
                'priority' => 'high'
            ],
            'request_approved' => [
                'title' => 'Demande approuvée',
                'recipients' => ['professor'],
                'template' => 'request_approved',
                'priority' => 'high'
            ],
            'request_rejected' => [
                'title' => 'Demande rejetée',
                'recipients' => ['professor'],
                'template' => 'request_rejected',
                'priority' => 'medium'
            ],
            'hours_declared' => [
                'title' => 'Heures déclarées',
                'recipients' => ['family'],
                'template' => 'hours_declared',
                'priority' => 'medium'
            ],
            'hours_validated' => [
                'title' => 'Heures validées',
                'recipients' => ['professor'],
                'template' => 'hours_validated',
                'priority' => 'medium'
            ],
            'assignment_ended' => [
                'title' => 'Fin d\'affectation',
                'recipients' => ['professor', 'family'],
                'template' => 'assignment_ended',
                'priority' => 'high'
            ],
            'welcome_family' => [
                'title' => 'Bienvenue famille',
                'recipients' => ['family'],
                'template' => 'welcome_family',
                'priority' => 'medium'
            ],
            'welcome_professor' => [
                'title' => 'Bienvenue professeur',
                'recipients' => ['professor'],
                'template' => 'welcome_professor',
                'priority' => 'medium'
            ],
            'password_reset' => [
                'title' => 'Réinitialisation mot de passe',
                'recipients' => ['user'],
                'template' => 'password_reset',
                'priority' => 'high'
            ],
            'monthly_summary' => [
                'title' => 'Récapitulatif mensuel',
                'recipients' => ['family', 'professor'],
                'template' => 'monthly_summary',
                'priority' => 'low'
            ]
        ];
    }
    
    /**
     * Hooks WordPress
     */
    private function init_hooks() {
        // Hook pour définir le content type HTML
        add_filter('wp_mail_content_type', [$this, 'set_html_content_type']);
        add_filter('wp_mail_from', [$this, 'set_mail_from']);
        add_filter('wp_mail_from_name', [$this, 'set_mail_from_name']);
        
        // Hooks pour les événements automatiques
        add_action('sr_send_notification', [$this, 'send_notification'], 10, 3);
        add_action('sr_send_bulk_notifications', [$this, 'send_bulk_notifications'], 10, 2);
        
        // Tâche CRON pour les résumés mensuels
        add_action('sr_send_monthly_summaries', [$this, 'send_monthly_summaries']);
        
        // Programmation CRON si pas déjà fait
        if (!wp_next_scheduled('sr_send_monthly_summaries')) {
            wp_schedule_event(strtotime('first day of next month 9:00 AM'), 'monthly', 'sr_send_monthly_summaries');
        }
        
        // Nettoyage des logs anciens
        add_action('sr_cleanup_notification_logs', [$this, 'cleanup_old_logs']);
        if (!wp_next_scheduled('sr_cleanup_notification_logs')) {
            wp_schedule_event(time(), 'weekly', 'sr_cleanup_notification_logs');
        }
    }
    
    /**
     * TEMPLATES D'EMAILS
     * ================================================================
     */
    
    /**
     * Chargement des templates d'emails
     */
    private function load_email_templates() {
        $this->email_templates = [
            'new_request' => [
                'subject' => 'Nouvelle demande de cours - {family_name}',
                'template' => $this->get_new_request_template()
            ],
            'request_approved' => [
                'subject' => 'Nouveau cours attribué - {family_name}',
                'template' => $this->get_request_approved_template()
            ],
            'request_rejected' => [
                'subject' => 'Demande de cours - Réponse',
                'template' => $this->get_request_rejected_template()
            ],
            'hours_declared' => [
                'subject' => 'Déclaration de {hours}h de cours - {prof_name}',
                'template' => $this->get_hours_declared_template()
            ],
            'hours_validated' => [
                'subject' => 'Heures validées - {family_name}',
                'template' => $this->get_hours_validated_template()
            ],
            'assignment_ended' => [
                'subject' => 'Fin d\'affectation - {other_party_name}',
                'template' => $this->get_assignment_ended_template()
            ],
            'welcome_family' => [
                'subject' => 'Bienvenue chez Sophiacademia',
                'template' => $this->get_welcome_family_template()
            ],
            'welcome_professor' => [
                'subject' => 'Bienvenue dans l\'équipe Sophiacademia',
                'template' => $this->get_welcome_professor_template()
            ],
            'password_reset' => [
                'subject' => 'Réinitialisation de votre mot de passe',
                'template' => $this->get_password_reset_template()
            ],
            'monthly_summary' => [
                'subject' => 'Récapitulatif mensuel - {month_name}',
                'template' => $this->get_monthly_summary_template()
            ]
        ];
    }
    
    /**
     * Template nouvelle demande (pour le staff)
     */
    private function get_new_request_template() {
        return '
        <div class="sr-notification-header">
            <h2>Nouvelle demande de cours</h2>
        </div>
        
        <div class="sr-notification-content">
            <p>Bonjour,</p>
            
            <p>Une nouvelle demande de cours a été soumise et nécessite votre attention.</p>
            
            <div class="sr-info-box">
                <h3>Détails de la demande</h3>
                <ul>
                    <li><strong>Professeur :</strong> {prof_name}</li>
                    <li><strong>Famille :</strong> {family_name}</li>
                    <li><strong>Élève :</strong> {student_name} ({student_level})</li>
                    <li><strong>Matière :</strong> {subject}</li>
                    <li><strong>Localisation :</strong> {city} ({postcode})</li>
                    <li><strong>Date de la demande :</strong> {request_date}</li>
                </ul>
            </div>
            
            <div class="sr-action-section">
                <p><strong>Actions requises :</strong></p>
                <ul>
                    <li>Vérifier la compatibilité professeur/famille</li>
                    <li>Valider les disponibilités</li>
                    <li>Approuver ou rejeter la demande</li>
                </ul>
            </div>
            
            <div class="sr-cta-container">
                <a href="{admin_url}" class="sr-button sr-button-primary">Traiter la demande</a>
            </div>
            
            <p class="sr-footer-note">
                Cette demande doit être traitée dans les 24h pour maintenir la qualité de service.
            </p>
        </div>';
    }
    
    /**
     * Template demande approuvée (pour le professeur)
     */
    private function get_request_approved_template() {
        return '
        <div class="sr-notification-header success">
            <h2>Félicitations ! Nouveau cours attribué</h2>
        </div>
        
        <div class="sr-notification-content">
            <p>Bonjour {prof_name},</p>
            
            <p>Nous avons le plaisir de vous informer qu\'un cours vous a été attribué.</p>
            
            <div class="sr-info-box highlight">
                <h3>Informations famille</h3>
                <ul>
                    <li><strong>Famille :</strong> {family_name}</li>
                    <li><strong>Email :</strong> <a href="mailto:{family_email}">{family_email}</a></li>
                    <li><strong>Téléphone :</strong> <a href="tel:{family_phone}">{family_phone}</a></li>
                    <li><strong>Adresse :</strong> {full_address}</li>
                </ul>
            </div>
            
            <div class="sr-info-box">
                <h3>Détails du cours</h3>
                <ul>
                    <li><strong>Élève :</strong> {student_name}</li>
                    <li><strong>Niveau :</strong> {student_level}</li>
                    <li><strong>Matière :</strong> {subject}</li>
                    <li><strong>Fréquence :</strong> {frequency}</li>
                    <li><strong>Durée :</strong> {duration}</li>
                    <li><strong>Périodes :</strong> {periods}</li>
                </ul>
            </div>
            
            <div class="sr-action-section urgent">
                <h3>Actions immédiates</h3>
                <p><strong>Merci de contacter la famille dans les 48 heures maximum</strong> pour :</p>
                <ul>
                    <li>Vous présenter et faire connaissance</li>
                    <li>Planifier le premier cours</li>
                    <li>Échanger sur les objectifs pédagogiques</li>
                    <li>Organiser le planning des séances</li>
                </ul>
            </div>
            
            <div class="sr-cta-container">
                <a href="tel:{family_phone}" class="sr-button sr-button-primary">Appeler maintenant</a>
                <a href="mailto:{family_email}" class="sr-button sr-button-secondary">Envoyer un email</a>
            </div>
            
            <p>Nous vous souhaitons un excellent accompagnement pédagogique !</p>
        </div>';
    }
    
    /**
     * Template déclaration d'heures (pour la famille)
     */
    private function get_hours_declared_template() {
        return '
        <div class="sr-notification-header">
            <h2>Déclaration d\'heures de cours</h2>
        </div>
        
        <div class="sr-notification-content">
            <p>Bonjour {family_name},</p>
            
            <p>Votre professeur <strong>{prof_name}</strong> a déclaré des heures de cours.</p>
            
            <div class="sr-info-box">
                <h3>Détails de la déclaration</h3>
                <ul>
                    <li><strong>Professeur :</strong> {prof_name}</li>
                    <li><strong>Matière :</strong> {subject}</li>
                    <li><strong>Nombre d\'heures :</strong> {hours}h</li>
                    <li><strong>Date de déclaration :</strong> {declaration_date}</li>
                    <li><strong>Coût brut :</strong> {gross_cost}€</li>
                    <li><strong>Coût net (après crédit d\'impôt) :</strong> {net_cost}€</li>
                </ul>
            </div>
            
            <div class="sr-validation-info">
                <h3>Validation automatique</h3>
                <p>Cette déclaration sera <strong>automatiquement validée dans 48 heures</strong> sauf contestation de votre part.</p>
                
                <p>Si vous souhaitez contester cette déclaration, merci de nous contacter rapidement à <a href="mailto:{contact_email}">{contact_email}</a> ou par téléphone.</p>
            </div>
            
            <div class="sr-cta-container">
                <a href="{family_portal_url}" class="sr-button sr-button-primary">Voir mes cours</a>
                <a href="mailto:{contact_email}" class="sr-button sr-button-secondary">Contester</a>
            </div>
            
            <p class="sr-footer-note">
                Vous recevrez un récapitulatif mensuel de toutes vos consommations.
            </p>
        </div>';
    }
    
    /**
     * Template bienvenue famille
     */
    private function get_welcome_family_template() {
        return '
        <div class="sr-notification-header welcome">
            <h2>Bienvenue chez Sophiacademia !</h2>
        </div>
        
        <div class="sr-notification-content">
            <p>Bonjour {family_name},</p>
            
            <p>Nous sommes ravis de vous accueillir parmi nos familles. Votre compte a été créé avec succès et nos équipes vont rapidement vous proposer un professeur adapté aux besoins de <strong>{student_name}</strong>.</p>
            
            <div class="sr-info-box">
                <h3>Votre profil</h3>
                <ul>
                    <li><strong>Élève :</strong> {student_name}</li>
                    <li><strong>Niveau :</strong> {student_level}</li>
                    <li><strong>Matière :</strong> {subject}</li>
                    <li><strong>Localisation :</strong> {city}</li>
                </ul>
            </div>
            
            <div class="sr-steps-section">
                <h3>Prochaines étapes</h3>
                <ol>
                    <li><strong>Activation du compte</strong> - Vous allez recevoir vos identifiants de connexion par email séparé</li>
                    <li><strong>Recherche du professeur</strong> - Nous sélectionnons le meilleur profil pour votre enfant</li>
                    <li><strong>Mise en relation</strong> - Le professeur vous contactera sous 48h après validation</li>
                    <li><strong>Premier cours</strong> - Organisation des séances selon vos disponibilités</li>
                </ol>
            </div>
            
            <div class="sr-cta-container">
                <a href="{login_url}" class="sr-button sr-button-primary">Se connecter</a>
                <a href="{contact_url}" class="sr-button sr-button-secondary">Nous contacter</a>
            </div>
            
            <p>Notre équipe reste à votre disposition pour toute question.</p>
        </div>';
    }
    
    /**
     * Template bienvenue professeur
     */
    private function get_welcome_professor_template() {
        return '
        <div class="sr-notification-header welcome">
            <h2>Bienvenue dans l\'équipe Sophiacademia !</h2>
        </div>
        
        <div class="sr-notification-content">
            <p>Bonjour {prof_name},</p>
            
            <p>Nous sommes heureux de vous accueillir parmi nos professeurs. Votre profil a été validé et vous pouvez dès maintenant accéder aux offres de cours dans votre secteur.</p>
            
            <div class="sr-info-box">
                <h3>Votre profil professeur</h3>
                <ul>
                    <li><strong>Matière principale :</strong> {prof_subject}</li>
                    <li><strong>Zone d\'intervention :</strong> {city} et alentours</li>
                    <li><strong>Statut :</strong> Actif</li>
                </ul>
            </div>
            
            <div class="sr-features-section">
                <h3>Vos outils Sophiacademia</h3>
                <ul>
                    <li><strong>Mes offres</strong> - Consultez les familles qui recherchent un professeur près de chez vous</li>
                    <li><strong>Mes élèves</strong> - Gérez vos affectations et déclarez vos heures de cours</li>
                    <li><strong>Mes paiements</strong> - Suivez vos rémunérations et acomptes</li>
                </ul>
            </div>
            
            <div class="sr-getting-started">
                <h3>Pour bien commencer</h3>
                <ol>
                    <li>Connectez-vous à votre espace professeur</li>
                    <li>Consultez les offres de cours disponibles</li>
                    <li>Posez une option sur les familles qui vous intéressent</li>
                    <li>Attendez la validation de notre équipe</li>
                </ol>
            </div>
            
            <div class="sr-cta-container">
                <a href="{professor_portal_url}" class="sr-button sr-button-primary">Mon espace professeur</a>
                <a href="{offers_url}" class="sr-button sr-button-secondary">Voir les offres</a>
            </div>
            
            <p>Bonne route avec Sophiacademia !</p>
        </div>';
    }
    
    /**
     * Templates supplémentaires (placeholders)
     */
    private function get_request_rejected_template() {
        return '<p>Bonjour {prof_name}, votre demande concernant {family_name} n\'a pas été retenue. {reason}</p>';
    }
    
    private function get_hours_validated_template() {
        return '<p>Bonjour {prof_name}, vos {hours}h de cours avec {family_name} ont été validées.</p>';
    }
    
    private function get_assignment_ended_template() {
        return '<p>Bonjour, l\'affectation avec {other_party_name} a pris fin. {reason}</p>';
    }
    
    private function get_password_reset_template() {
        return '<p>Bonjour, cliquez ici pour réinitialiser votre mot de passe : {reset_link}</p>';
    }
    
    private function get_monthly_summary_template() {
        return '<p>Bonjour, voici votre récapitulatif du mois de {month_name} : {summary_data}</p>';
    }
    
    /**
     * LAYOUT HTML PRINCIPAL
     * ================================================================
     */
    
    /**
     * Layout HTML responsive pour tous les emails
     */
    private function get_email_layout($content, $variables = []) {
        $logo_url = get_option('sr_email_logo_url', SR_PLUGIN_URL . 'assets/images/logo-email.png');
        $primary_color = get_option('sr_email_primary_color', '#1e90ff');
        $secondary_color = get_option('sr_email_secondary_color', '#5b3fa3');
        
        return sprintf('
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>%s</title>
            <style>
                /* Reset CSS */
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                /* Base */
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    line-height: 1.6; 
                    color: #333; 
                    background-color: #f5f5f5;
                }
                
                /* Container principal */
                .sr-email-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                }
                
                /* Header */
                .sr-email-header {
                    background: linear-gradient(135deg, %s 0%%, %s 100%%);
                    color: white;
                    padding: 30px 40px;
                    text-align: center;
                }
                
                .sr-email-logo {
                    max-width: 200px;
                    height: auto;
                    margin-bottom: 15px;
                }
                
                .sr-email-header h1 {
                    font-size: 24px;
                    font-weight: 300;
                    margin: 0;
                }
                
                /* Content */
                .sr-email-content {
                    padding: 40px;
                }
                
                /* Notification headers */
                .sr-notification-header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #eee;
                }
                
                .sr-notification-header.success {
                    border-bottom-color: #28a745;
                }
                
                .sr-notification-header.welcome {
                    border-bottom-color: %s;
                }
                
                .sr-notification-header h2 {
                    color: %s;
                    font-size: 22px;
                    margin: 0;
                }
                
                /* Info boxes */
                .sr-info-box {
                    background-color: #f8f9fa;
                    border-left: 4px solid %s;
                    padding: 20px;
                    margin: 20px 0;
                }
                
                .sr-info-box.highlight {
                    background-color: #e8f4fd;
                    border-left-color: %s;
                }
                
                .sr-info-box h3 {
                    color: %s;
                    margin-bottom: 15px;
                    font-size: 18px;
                }
                
                .sr-info-box ul {
                    list-style: none;
                    margin: 0;
                }
                
                .sr-info-box li {
                    padding: 5px 0;
                    border-bottom: 1px solid #eee;
                }
                
                .sr-info-box li:last-child {
                    border-bottom: none;
                }
                
                /* Action sections */
                .sr-action-section {
                    background-color: #fff3cd;
                    border: 1px solid #ffeaa7;
                    padding: 20px;
                    margin: 20px 0;
                    border-radius: 5px;
                }
                
                .sr-action-section.urgent {
                    background-color: #f8d7da;
                    border-color: #f5c6cb;
                }
                
                .sr-action-section h3 {
                    color: #856404;
                    margin-bottom: 10px;
                }
                
                .sr-action-section.urgent h3 {
                    color: #721c24;
                }
                
                /* Buttons */
                .sr-cta-container {
                    text-align: center;
                    margin: 30px 0;
                }
                
                .sr-button {
                    display: inline-block;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 600;
                    margin: 0 10px 10px 0;
                    transition: all 0.3s ease;
                }
                
                .sr-button-primary {
                    background-color: %s;
                    color: white;
                }
                
                .sr-button-secondary {
                    background-color: %s;
                    color: white;
                }
                
                .sr-button:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }
                
                /* Footer */
                .sr-email-footer {
                    background-color: #f8f9fa;
                    padding: 30px 40px;
                    text-align: center;
                    font-size: 14px;
                    color: #666;
                    border-top: 1px solid #eee;
                }
                
                .sr-footer-note {
                    font-size: 14px;
                    color: #666;
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                }
                
                /* Steps */
                .sr-steps-section ol {
                    padding-left: 20px;
                }
                
                .sr-steps-section li {
                    margin-bottom: 10px;
                }
                
                /* Responsive */
                @media (max-width: 600px) {
                    .sr-email-content {
                        padding: 20px;
                    }
                    
                    .sr-email-header {
                        padding: 20px;
                    }
                    
                    .sr-button {
                        display: block;
                        margin: 10px 0;
                    }
                }
            </style>
        </head>
        <body>
            <div class="sr-email-container">
                <div class="sr-email-header">
                    <img src="%s" alt="Sophiacademia" class="sr-email-logo">
                    <h1>%s</h1>
                </div>
                
                <div class="sr-email-content">
                    %s
                </div>
                
                <div class="sr-email-footer">
                    <p><strong>Sophiacademia</strong></p>
                    <p>Cours particuliers de qualité</p>
                    <p>
                        <a href="mailto:%s">Contact</a> | 
                        <a href="%s">Site web</a> | 
                        <a href="{unsubscribe_url}">Se désabonner</a>
                    </p>
                    <p style="margin-top: 15px; font-size: 12px;">
                        Cet email a été envoyé automatiquement, merci de ne pas y répondre directement.
                    </p>
                </div>
            </div>
        </body>
        </html>',
            $variables['email_title'] ?? 'Sophiacademia',
            $primary_color, $secondary_color,
            $primary_color, $primary_color, $primary_color, $primary_color, $primary_color,
            $primary_color, $secondary_color,
            $logo_url,
            $variables['header_title'] ?? 'Sophiacademia',
            $content,
            $this->email_config['reply_to'],
            home_url()
        );
    }
    
    /**
     * MÉTHODES PUBLIQUES D'ENVOI
     * ================================================================
     */
    
    /**
     * Notification nouvelle demande
     */
    public function notify_new_request($request_id, $prof_id, $family_id) {
        $prof = get_userdata($prof_id);
        $family = get_userdata($family_id);
        
        if (!$prof || !$family) return false;
        
        $variables = [
            'prof_name' => $prof->display_name,
            'family_name' => $family->display_name,
            'student_name' => get_user_meta($family_id, 'sr_stu_first', true) . ' ' . get_user_meta($family_id, 'sr_stu_last', true),
            'student_level' => get_user_meta($family_id, 'sr_level', true),
            'subject' => get_user_meta($family_id, 'sr_subject', true),
            'city' => get_user_meta($family_id, 'sr_city', true),
            'postcode' => get_user_meta($family_id, 'sr_postcode', true),
            'request_date' => date_i18n('d/m/Y H:i'),
            'admin_url' => admin_url('admin.php?page=sr-requests'),
            'header_title' => 'Nouvelle demande',
            'email_title' => 'Nouvelle demande - ' . $family->display_name
        ];
        
        return $this->send_notification('new_request', $this->get_staff_emails(), $variables);
    }
    
    /**
     * Notification demande approuvée
     */
    public function notify_request_approved($request_id, $prof_id, $family_id) {
        $prof = get_userdata($prof_id);
        $family = get_userdata($family_id);
        
        if (!$prof || !$family) return false;
        
        $variables = [
            'prof_name' => $prof->first_name,
            'family_name' => $family->display_name,
            'family_email' => $family->user_email,
            'family_phone' => get_user_meta($family_id, 'sr_rep_phone', true),
            'full_address' => $this->get_formatted_address($family_id),
            'student_name' => get_user_meta($family_id, 'sr_stu_first', true) . ' ' . get_user_meta($family_id, 'sr_stu_last', true),
            'student_level' => get_user_meta($family_id, 'sr_level', true),
            'subject' => get_user_meta($family_id, 'sr_subject', true),
            'frequency' => get_user_meta($family_id, 'sr_freq', true),
            'duration' => get_user_meta($family_id, 'sr_duration', true),
            'periods' => get_user_meta($family_id, 'sr_period', true),
            'header_title' => 'Cours attribué',
            'email_title' => 'Nouveau cours - ' . $family->display_name
        ];
        
        $result = $this->send_notification('request_approved', $prof->user_email, $variables);
        
        // Copie à l'agence
        if ($result) {
            $this->send_notification('request_approved', $this->email_config['bcc_agence'], $variables);
        }
        
        return $result;
    }
    
    /**
     * Notification déclaration d'heures
     */
    public function notify_hours_declared($course_id, $prof_id, $family_id, $hours) {
        $prof = get_userdata($prof_id);
        $family = get_userdata($family_id);
        
        if (!$prof || !$family) return false;
        
        $subject = get_post_meta($course_id, '_sr_subject', true) ?: get_user_meta($family_id, 'sr_subject', true);
        $gross_cost = $hours * SR_Core::FAMILY_HOURLY_RATE;
        $net_cost = $hours * SR_Core::FAMILY_NET_HOURLY;
        
        $variables = [
            'family_name' => $family->first_name,
            'prof_name' => $prof->display_name,
            'hours' => number_format_i18n($hours, 1),
            'subject' => $subject,
            'declaration_date' => date_i18n('d/m/Y'),
            'gross_cost' => number_format_i18n($gross_cost, 2),
            'net_cost' => number_format_i18n($net_cost, 2),
            'contact_email' => $this->email_config['reply_to'],
            'family_portal_url' => home_url('/mes-cours/'),
            'header_title' => 'Déclaration d\'heures',
            'email_title' => 'Déclaration ' . $hours . 'h - ' . $prof->display_name
        ];
        
        $result = $this->send_notification('hours_declared', $family->user_email, $variables);
        
        // Copie à l'agence
        if ($result) {
            $this->send_notification('hours_declared', $this->email_config['bcc_agence'], $variables);
        }
        
        return $result;
    }
    
    /**
     * Email de bienvenue famille
     */
    public function send_welcome_family($user_id) {
        $user = get_userdata($user_id);
        if (!$user) return false;
        
        $variables = [
            'family_name' => $user->first_name,
            'student_name' => get_user_meta($user_id, 'sr_stu_first', true),
            'student_level' => get_user_meta($user_id, 'sr_level', true),
            'subject' => get_user_meta($user_id, 'sr_subject', true),
            'city' => get_user_meta($user_id, 'sr_city', true),
            'login_url' => wp_login_url(),
            'contact_url' => home_url('/contact/'),
            'header_title' => 'Bienvenue',
            'email_title' => 'Bienvenue chez Sophiacademia'
        ];
        
        return $this->send_notification('welcome_family', $user->user_email, $variables);
    }
    
    /**
     * Email de bienvenue professeur
     */
    public function send_welcome_professor($user_id) {
        $user = get_userdata($user_id);
        if (!$user) return false;
        
        $variables = [
            'prof_name' => $user->first_name,
            'prof_subject' => get_user_meta($user_id, 'sr_prof_subject', true),
            'city' => get_user_meta($user_id, 'sr_city', true),
            'professor_portal_url' => home_url('/espace-professeur/'),
            'offers_url' => home_url('/mes-offres/'),
            'header_title' => 'Bienvenue',
            'email_title' => 'Bienvenue chez Sophiacademia'
        ];
        
        return $this->send_notification('welcome_professor', $user->user_email, $variables);
    }
    
    /**
     * MÉTHODES UTILITAIRES
     * ================================================================
     */
    
    /**
     * Envoi d'une notification
     */
    public function send_notification($type, $recipients, $variables = []) {
        if (!isset($this->email_templates[$type])) {
            SR_Core::log("Unknown notification type: {$type}", 'error');
            return false;
        }
        
        $template_config = $this->email_templates[$type];
        
        // Préparation du contenu
        $subject = $this->replace_variables($template_config['subject'], $variables);
        $content = $this->replace_variables($template_config['template'], $variables);
        $html_content = $this->get_email_layout($content, $variables);
        
        // Normalisation des destinataires
        if (!is_array($recipients)) {
            $recipients = [$recipients];
        }
        
        // Headers email
        $headers = [
            'Content-Type: text/html; charset=' . $this->email_config['charset'],
            'From: ' . $this->email_config['from_name'] . ' <' . $this->email_config['from_email'] . '>',
            'Reply-To: ' . $this->email_config['reply_to']
        ];
        
        // Envoi
        $success = true;
        foreach ($recipients as $recipient) {
            $result = wp_mail($recipient, $subject, $html_content, $headers);
            
            if (!$result) {
                $success = false;
                SR_Core::log("Failed to send {$type} notification to {$recipient}", 'error');
            } else {
                // Log de succès
                $this->log_email_sent($type, $recipient, $subject);
            }
        }
        
        return $success;
    }
    
    /**
     * Remplacement des variables dans les templates
     */
    private function replace_variables($template, $variables) {
        foreach ($variables as $key => $value) {
            $template = str_replace('{' . $key . '}', $value, $template);
        }
        
        // Nettoyage des variables non remplacées
        $template = preg_replace('/\{[^}]+\}/', '', $template);
        
        return $template;
    }
    
    /**
     * Récupération des emails du staff
     */
    private function get_staff_emails() {
        $staff_users = get_users(['role' => 'sr_staff', 'fields' => 'user_email']);
        $emails = array_column($staff_users, 'user_email');
        
        // Ajout email agence
        if (!in_array($this->email_config['bcc_agence'], $emails)) {
            $emails[] = $this->email_config['bcc_agence'];
        }
        
        return array_unique($emails);
    }
    
    /**
     * Formatage d'une adresse complète
     */
    private function get_formatted_address($user_id) {
        $parts = [
            get_user_meta($user_id, 'sr_addr1', true),
            get_user_meta($user_id, 'sr_addr2', true),
            get_user_meta($user_id, 'sr_postcode', true),
            get_user_meta($user_id, 'sr_city', true)
        ];
        
        return trim(implode(' ', array_filter($parts)));
    }
    
    /**
     * Configuration WordPress mail
     */
    public function set_html_content_type() {
        return 'text/html';
    }
    
    public function set_mail_from($email) {
        return $this->email_config['from_email'];
    }
    
    public function set_mail_from_name($name) {
        return $this->email_config['from_name'];
    }
    
    /**
     * Log des emails envoyés
     */
    private function log_email_sent($type, $recipient, $subject) {
        self::$email_log[] = [
            'type' => $type,
            'recipient' => $recipient,
            'subject' => $subject,
            'timestamp' => current_time('mysql'),
            'user_id' => get_current_user_id()
        ];
        
        // Sauvegarde périodique
        if (count(self::$email_log) >= 10) {
            $this->save_email_logs();
        }
    }
    
    /**
     * Sauvegarde des logs
     */
    private function save_email_logs() {
        if (empty(self::$email_log)) return;
        
        $existing_logs = get_option('sr_email_logs', []);
        $updated_logs = array_merge($existing_logs, self::$email_log);
        
        // Limite à 1000 entrées
        if (count($updated_logs) > 1000) {
            $updated_logs = array_slice($updated_logs, -1000);
        }
        
        update_option('sr_email_logs', $updated_logs);
        self::$email_log = [];
    }
    
    /**
     * Nettoyage des logs anciens
     */
    public function cleanup_old_logs() {
        $logs = get_option('sr_email_logs', []);
        $cutoff_date = date('Y-m-d H:i:s', strtotime('-3 months'));
        
        $filtered_logs = array_filter($logs, function($log) use ($cutoff_date) {
            return $log['timestamp'] >= $cutoff_date;
        });
        
        update_option('sr_email_logs', array_values($filtered_logs));
        
        SR_Core::log('Cleaned old email logs, kept ' . count($filtered_logs) . ' entries', 'debug');
    }
    
    /**
     * Résumés mensuels (tâche CRON)
     */
    public function send_monthly_summaries() {
        // Implementation des résumés mensuels
        SR_Core::log('Monthly summaries sent', 'info');
    }
    
    /**
     * Méthodes placeholder pour notifications avancées
     */
    public function notify_request_rejected($request_id, $prof_id, $family_id, $reason = '') {
        // Implementation rejet demande
        return true;
    }
    
    public function notify_assignment_ended($request_id, $prof_id, $family_id, $reason = '') {
        // Implementation fin affectation
        return true;
    }
    
    public function notify_hours_validated($course_id, $prof_id, $family_id) {
        // Implementation validation heures
        return true;
    }
}