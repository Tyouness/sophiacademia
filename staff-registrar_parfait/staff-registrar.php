<?php
/**
 * Plugin Name: Staff Registrar
 * Description: Comptes profs / familles ; géoloc Google ; offres Leaflet (« Mes offres ») +
 *              « mettre une option » & validation admin ; notifications ; page « Mes élèves »
 *              (déclaration d’heures) + auto-validation 48 h ; suivi admin des heures déclarées.
 * Version:     1.4.1
 * Author:      Vous
 */

define( 'WP_DEBUG', true );
define( 'WP_DEBUG_DISPLAY', true );
if ( ! defined( 'ABSPATH' ) ) exit;

/*────────────────────────────────────────────
 * 0.  CONSTANTES
 *───────────────────────────────────────────*/
define( 'SR_GEOCODE_KEY', 'VOTRE_CLE_GOOGLE' );   // ← changez !
define( 'SR_BCC_AGENCE',  'agence@example.com' ); // ← changez !

/*════════════════════════════════════════════
 * FAMILLES  – constantes communes
 *════════════════════════════════════════════*/
const SR_FAMILY_HOURLY_RATE    = 50;   // tarif brut (avant crédit)
const SR_FAMILY_CREDIT_RATE    = 0.50; // –50 %
const SR_FAMILY_NET_HOURLY     = SR_FAMILY_HOURLY_RATE * (1 - SR_FAMILY_CREDIT_RATE);


/*────────────────────────────────────────────
 * 1.  MENUS ADMIN
 *───────────────────────────────────────────*/
add_action( 'admin_menu', function () {

    add_menu_page(
        'Utilisateurs', 'Utilisateurs',
        'manage_options', 'staff-registrar',
        '__return_false', 'dashicons-admin-users', 20
    );

    add_submenu_page(
        'staff-registrar', 'Tous les utilisateurs', 'Tous les utilisateurs',
        'manage_options', 'staff-registrar-list', 'sr_render_users_list'
    );

    add_submenu_page(
        'staff-registrar', 'Ajouter famille', 'Ajouter famille',
        'manage_options', 'staff-registrar-famille', 'sr_render_form_famille'
    );

    add_submenu_page(
        'staff-registrar', 'Ajouter professeur', 'Ajouter professeur',
        'manage_options', 'staff-registrar-prof', 'sr_render_form_prof'
    );

    add_submenu_page(
        'staff-registrar', 'Demandes', 'Demandes',
        'manage_options', 'staff-registrar-requests', 'sr_render_requests_page'
    );

    /* — nouveau sous-menu — */
    add_submenu_page(
        'staff-registrar', 'Heures déclarées', 'Heures déclarées',
        'manage_options', 'staff-registrar-hours', 'sr_render_hours_page'
    );
	add_submenu_page(
    'staff-registrar',           // slug parent
    'Attributions',              // title <title>
    'Attributions',              // label dans le menu
    'manage_options',            // capability
    'staff-registrar-assign',    // slug de la page
    'sr_render_assign_page'      // callback ci-dessous
	);

} );

/*────────────────────────────────────────────
 * 2.  ASSETS ADMIN (géocode + modale)
 *───────────────────────────────────────────*/
add_action( 'admin_enqueue_scripts', function () {

    $js = plugin_dir_path( __FILE__ ) . 'js/sr-ajax.js';

    wp_enqueue_script( 'sr-ajax',
        plugin_dir_url( __FILE__ ) . 'js/sr-ajax.js',
        [ 'jquery' ],
        filemtime( $js ),
        true );

    wp_localize_script( 'sr-ajax', 'sr_vars', [
        'ajax_url'   => admin_url( 'admin-ajax.php' ),
        'geocode_key'=> SR_GEOCODE_KEY,
        'sr_nonce'   => wp_create_nonce( 'sr_nonce' ),
    ] );
} );

/*════════════════════════════════════════════
 * 3.  FORMULAIRES FAMILLE / PROFESSEUR
 *════════════════════════════════════════════*/
function sr_render_form_famille() { sr_render_generic_form( 'um_famille' ); }
function sr_render_form_prof()    { sr_render_generic_form( 'um_professeur' ); }

function sr_render_generic_form( $role ) {

    /* $fields = [ meta_key, label, type, readonly, default, required? ] */
    $fields = ( $role === 'um_famille' )
      ? [
          ['sr_rep_last',  'Nom représentant'],
          ['sr_rep_first', 'Prénom représentant'],
          ['sr_email',     'Email',             'email'],
          ['sr_addr1',     'Adresse 1'],
          ['sr_addr2',     'Adresse 2',         'text', false, '', false],
          ['sr_postcode',  'Code postal'],
          ['sr_city',      'Ville',             'text', true],
          ['sr_country',   'Pays',              'text', false, 'France'],
          ['sr_stu_last',  'Nom élève'],
          ['sr_stu_first', 'Prénom élève'],
          ['sr_level',     'Niveau'],
          ['sr_subject',   'Matière'],
          ['sr_gender',    'Sexe (garçon/fille)'],
          ['sr_freq',      'Fréquence (1/sem ou 1/15j)'],
          ['sr_duration',  'Durée séance (h:mm)'],
          ['sr_period',    'Périodes (Semaine,WE,Vacances)'],
          ['sr_start',     'Date début (jj/mm/aaaa)']
        ]
      : [
          ['sr_prof_last',    'Nom'],
          ['sr_prof_first',   'Prénom'],
          ['sr_prof_email',   'Email',            'email'],
          ['sr_prof_phone',   'Téléphone'],
          ['sr_prof_subject', 'Matière'],
          ['sr_addr1',        'Adresse 1'],
          ['sr_addr2',        'Adresse 2',        'text', false, '', false],
          ['sr_postcode',     'Code postal'],
          ['sr_city',         'Ville',            'text', true],
          ['sr_country',      'Pays',             'text', false, 'France'],
        ];

    /* --- création --------------------------------------------------- */
    if ( isset( $_POST['sr_submit'] ) && check_admin_referer( 'sr_add', 'sr_add_nonce' ) ) {

        $login = sr_unique_username( substr( $_POST[ $fields[1][0] ], 0, 1 ) . $_POST[ $fields[0][0] ] );
        $email = sanitize_email      ( $_POST[ $fields[2][0] ] );
        $first = sanitize_text_field ( $_POST[ $fields[1][0] ] );
        $last  = sanitize_text_field ( $_POST[ $fields[0][0] ] );

        $user_id = wp_insert_user( [
            'user_login' => $login,
            'user_pass'  => wp_generate_password( 12, true ),
            'user_email' => $email,
            'first_name' => $first,
            'last_name'  => $last,
            'role'       => $role
        ] );

        if ( is_wp_error( $user_id ) ) {
            echo '<div class="notice notice-error"><p>'.
                 esc_html( $user_id->get_error_message() ) .'</p></div>';
        } else {
            foreach ( $fields as $f ) {
                $k = $f[0];
                if ( ! in_array( $k, [ $fields[0][0], $fields[1][0], $fields[2][0] ], true ) ) {
                    update_user_meta( $user_id, $k, sanitize_text_field( $_POST[ $k ] ?? '' ) );
                }
            }
            sr_geocode_user( $user_id );
            echo '<div class="notice notice-success"><p>Utilisateur créé.</p></div>';
        }
    }

    /* --- affichage --------------------------------------------------- */
    echo '<div class="wrap"><h1>'.
         ( $role === 'um_famille' ? 'Ajouter une famille / élève' : 'Ajouter un professeur' )
         .'</h1><form method="post">';
    wp_nonce_field( 'sr_add', 'sr_add_nonce' );
    echo '<table class="form-table">';

    foreach ( $fields as $f ) {
        $type = $f[2] ?? 'text';
        $ro   = ! empty( $f[3] ) ? 'readonly' : '';
        $val  = esc_attr( $f[4] ?? '' );
        $req  = ( isset( $f[5] ) && $f[5] === false ) ? '' : 'required';
        printf(
            '<tr><th><label for="%1$s">%2$s</label></th>
                  <td><input id="%1$s" name="%1$s" type="%3$s"
                             class="regular-text" %4$s value="%5$s" %6$s></td></tr>',
            esc_attr( $f[0] ), esc_html( $f[1] ), esc_attr( $type ), $ro, $val, $req
        );
    }

    echo '</table><p><input type="submit" name="sr_submit"
                class="button button-primary" value="Créer l’utilisateur"></p></form></div>';
}

/* utilitaire : login unique -------------------------------------------- */
function sr_unique_username( $base ){
    $login=$base; $i=1;
    while( username_exists( $login ) ){ $login=$base.$i; $i++; }
    return $login;
}

/*════════════════════════════════════════════
 * 4.  LISTE ADMIN + MODALE ÉDITION
 *════════════════════════════════════════════*/
function sr_render_users_list() {
    if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Accès refusé' );

    echo '<div class="wrap"><h1>Tous les utilisateurs</h1>
    <table id="sr-users-table" class="widefat fixed">
      <thead><tr><th>Nom</th><th>Rôle</th><th>Adresse</th><th></th></tr></thead><tbody>';

    foreach ( get_users( [ 'role__in' => [ 'um_famille','um_professeur' ] ] ) as $u ) {
        $addr = sprintf( '%s<br>%s<br>%s %s<br>%s',
            get_user_meta( $u->ID,'sr_addr1',1 ),
            get_user_meta( $u->ID,'sr_addr2',1 ),
            get_user_meta( $u->ID,'sr_postcode',1 ),
            get_user_meta( $u->ID,'sr_city',1 ),
            get_user_meta( $u->ID,'sr_country',1 )
        );
        echo '<tr data-user="'.$u->ID.'"><td>'.$u->display_name.'</td><td>'.
             implode(', ', $u->roles ).'</td><td>'.$addr.'</td>
             <td><button class="button sr-edit">Modifier</button></td></tr>';
    }
    echo '</tbody></table>';

    /* — modale — */
    $nonce = wp_nonce_field( 'sr_nonce', 'sr_edit_nonce', true, false );

    echo '<div id="sr-modal" style="display:none;position:fixed;top:10%;left:50%;transform:translateX(-50%);
          width:600px;background:#fff;padding:24px;box-shadow:0 0 12px rgba(0,0,0,.35);z-index:1000;">
          <h2>Modifier données</h2>
          <form id="sr-edit-form">
            <table class="form-table">
              <tr><th>Adr1</th><td><input name="sr_addr1" type="text" required></td></tr>
              <tr><th>Adr2</th><td><input name="sr_addr2" type="text"></td></tr>
              <tr><th>CP</th>  <td><input name="sr_postcode" type="text" required></td></tr>
              <tr><th>Ville</th><td><input name="sr_city" type="text" readonly></td></tr>
              <tr><th>Pays</th><td><input name="sr_country" type="text" required></td></tr>

              <tr><th>Matière</th><td><input name="sr_subject" type="text"></td></tr>
              <tr><th>Niveau</th><td><input name="sr_level" type="text"></td></tr>
              <tr><th>Sexe</th><td>
                <select name="sr_gender">
                  <option value="">—</option>
                  <option value="garçon">Garçon</option>
                  <option value="fille">Fille</option>
                </select></td></tr>
              <tr><th>Fréquence</th><td><input name="sr_freq" type="text"></td></tr>
              <tr><th>Durée</th><td><input name="sr_duration" type="text"></td></tr>
              <tr><th>Périodes</th><td>
                <label><input type="checkbox" name="sr_period[]" value="Semaine"> Semaine</label>
                <label><input type="checkbox" name="sr_period[]" value="WE"> WE</label>
                <label><input type="checkbox" name="sr_period[]" value="Vacances"> Vacances</label>
              </td></tr>
              <tr><th>Début</th><td><input name="sr_start" type="text" placeholder="jj/mm/aaaa"></td></tr>
            </table>

            <p class="submit">
              <button type="button" class="button sr-geocode">CP→Ville</button>
              <button type="submit" class="button button-primary">Enregistrer</button>
              <button type="button" class="button sr-close">Fermer</button>
            </p>
            <input type="hidden" name="user_id" value="">
            '.$nonce.'
          </form></div></div>';
}

/*── AJAX : lecture métas -----------------------------------------------*/
add_action( 'wp_ajax_sr_get_user_meta', function(){
    if ( ! current_user_can( 'manage_options' )
      || ! check_ajax_referer( 'sr_nonce', '_wpnonce', false ) )
        wp_send_json_error( 'Perm' );

    $u   = intval( $_POST['user_id'] );
    $keys= [ 'sr_addr1','sr_addr2','sr_postcode','sr_city','sr_country',
             'sr_subject','sr_level','sr_gender','sr_freq','sr_duration',
             'sr_period','sr_start' ];
    $out=[];
    foreach ( $keys as $k ) $out[$k]=get_user_meta( $u,$k,1 );
    wp_send_json_success( $out );
});

/*── AJAX : sauvegarde + géocode ----------------------------------------*/
add_action( 'wp_ajax_sr_save_user', function(){
    if ( ! current_user_can( 'manage_options' )
      || ! check_ajax_referer( 'sr_nonce', 'sr_edit_nonce', false ) )
        wp_send_json_error( 'Perm' );

    $u   = intval( $_POST['user_id'] );
    $keys= [ 'sr_addr1','sr_addr2','sr_postcode','sr_city','sr_country',
             'sr_subject','sr_level','sr_gender','sr_freq','sr_duration','sr_start' ];
    foreach( $keys as $k )
        update_user_meta( $u, $k, sanitize_text_field( $_POST[$k] ?? '' ) );

    if ( isset($_POST['sr_period']) && is_array($_POST['sr_period']) )
        update_user_meta( $u,'sr_period',
            implode(',',array_map('sanitize_text_field',$_POST['sr_period'])) );

    sr_geocode_user( $u );
    wp_send_json_success();
});

/*════════════════════════════════════════════
 * 5.  GÉOCODAGE UTILISATEUR
 *════════════════════════════════════════════*/
function sr_geocode_user( $user_id ){

    $addr = implode( ', ', [
        get_user_meta($user_id,'sr_addr1',1),
        get_user_meta($user_id,'sr_postcode',1),
        get_user_meta($user_id,'sr_city',1),
        get_user_meta($user_id,'sr_country',1),
    ] );
    if ( empty( trim( $addr, ', ' ) ) ) return;

    $url  = 'https://maps.googleapis.com/maps/api/geocode/json?address='
          . urlencode( $addr ) .'&key='. SR_GEOCODE_KEY;
    $resp = wp_remote_get( $url );
    if ( is_wp_error( $resp ) ) return;

    $j = json_decode( wp_remote_retrieve_body( $resp ) );
    if ( $j && $j->status === 'OK' ) {
        $loc = $j->results[0]->geometry->location;
        update_user_meta( $user_id, 'sr_lat', $loc->lat );
        update_user_meta( $user_id, 'sr_lng', $loc->lng );
    }
}

/*════════════════════════════════════════════
 * 6.  SHORTCODE [sr_offers]  (masque familles déjà attribuées)
 *════════════════════════════════════════════*/
function sr_family_is_assigned( $family_id ){
    return (bool) get_posts( [
        'post_type'  => 'sr_request',
        'meta_query' => [
            [ 'key'=>'_sr_family','value'=>$family_id ],
            [ 'key'=>'_sr_status','value'=>'approved' ]
        ],
        'fields'     => 'ids',
        'numberposts'=> 1
    ] );
}

add_shortcode( 'sr_offers', 'sr_render_offers' );
function sr_render_offers( $atts ){

    $atts = shortcode_atts( [ 'radius'=>20 ], $atts, 'sr_offers' );
    $r    = floatval( $atts['radius'] );

    if ( ! is_user_logged_in() )
        return '<p>Veuillez vous connecter.</p>';

    $p     = wp_get_current_user();
    $lat0  = floatval( get_user_meta( $p->ID, 'sr_lat', 1 ) );
    $lng0  = floatval( get_user_meta( $p->ID, 'sr_lng', 1 ) );
    if ( ! $lat0 || ! $lng0 )
        return '<p>Adresse incomplète.</p>';

    global $wpdb;
    $rows = $wpdb->get_results(
      "SELECT u.ID,u.display_name,
              lat.meta_value AS lat,
              lng.meta_value AS lng
       FROM {$wpdb->users} u
       JOIN {$wpdb->usermeta} lat ON lat.user_id=u.ID AND lat.meta_key='sr_lat'
       JOIN {$wpdb->usermeta} lng ON lng.user_id=u.ID AND lng.meta_key='sr_lng'
       WHERE u.ID <> ".intval($p->ID)."
         AND EXISTS (SELECT 1 FROM {$wpdb->usermeta} r
                      WHERE r.user_id=u.ID AND r.meta_key='sr_level')"
    );

    $earth = 6371; $offers = [];
    foreach ( $rows as $s ) {

        if ( sr_family_is_assigned( $s->ID ) ) continue;

        $d = $earth * acos(
              cos( deg2rad($lat0) ) * cos( deg2rad($s->lat) ) *
              cos( deg2rad($s->lng) - deg2rad($lng0) ) +
              sin( deg2rad($lat0) ) * sin( deg2rad($s->lat) ) );
        if ( $d > $r ) continue;

        $id       = $s->ID;
        $offers[] = [
            'id'      => $id,
            'name'    => $s->display_name,
            'lat'     => floatval( $s->lat ),
            'lng'     => floatval( $s->lng ),
            'dist'    => round( $d, 1 ),
            'city'    => get_user_meta( $id, 'sr_city',    1 ),
            'level'   => get_user_meta( $id, 'sr_level',   1 ),
            'subject' => get_user_meta( $id, 'sr_subject', 1 ),
            'gender'  => get_user_meta( $id, 'sr_gender',  1 ),
            'freq'    => get_user_meta( $id, 'sr_freq',    1 ),
            'duration'=> get_user_meta( $id, 'sr_duration',1 ),
            'period'  => get_user_meta( $id, 'sr_period',  1 ),
            'start'   => get_user_meta( $id, 'sr_start',   1 ),
        ];
    }

    /* Assets Leaflet + front */
    wp_enqueue_style ( 'leaflet',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', [], null );
    wp_enqueue_script( 'leaflet',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', [], null, true );

    wp_enqueue_style ( 'sr-offers',
        plugin_dir_url( __FILE__ ) . 'css/sr-offers.css',
        [], filemtime( plugin_dir_path( __FILE__ ) . 'css/sr-offers.css' ) );

    wp_enqueue_script( 'sr-offers',
        plugin_dir_url( __FILE__ ) . 'js/sr-offers.js',
        [ 'jquery', 'leaflet' ],
        filemtime( plugin_dir_path( __FILE__ ) . 'js/sr-offers.js' ),
        true );

    wp_localize_script( 'sr-offers', 'sr_front', [
        'ajax_url' => admin_url( 'admin-ajax.php' ),
        'prof_id'  => $p->ID,
        'nonce'    => wp_create_nonce( 'sr_nonce' ),
    ] );

    ob_start(); ?>
    <div id="sr-offers-app">
      <div id="sr-offers-list" class="sr-offers-column"></div>
      <div id="sr-offers-map"  class="sr-offers-column"></div>
    </div>
    <script>
      window.srOffers   = <?php echo wp_json_encode( $offers ); ?>;
      window.srCenter   = [<?php echo $lat0; ?>, <?php echo $lng0; ?>];
      window.srDistance = 'km';
    </script>
    <?php
    return ob_get_clean();
}

/*════════════════════════════════════════════
 * 7.  CPT  sr_request  &  sr_course
 *════════════════════════════════════════════*/
add_action( 'init', function(){
    register_post_type( 'sr_request', [
        'label'    => 'Demandes',
        'public'   => false,
        'show_ui'  => false,
        'supports' => [ 'title', 'custom-fields' ],
    ] );
    register_post_type( 'sr_course', [
        'label'    => 'Déclarations d’heures',
        'public'   => false,
        'show_ui'  => false,
        'supports' => [ 'title', 'custom-fields' ],
    ] );
} );

/*──────── AJAX : poser une option --------------------------------------*/
add_action( 'wp_ajax_sr_send_request', 'sr_ajax_send_request' );
function sr_ajax_send_request(){

    if ( ! check_ajax_referer( 'sr_nonce', 'nonce', false ) )
        wp_send_json_error( 'nonce' );

    $fam  = intval( $_POST['family_id'] ?? 0 );
    $prof = intval( $_POST['prof_id']   ?? 0 );
    if ( ! $fam || ! $prof )
        wp_send_json_error( 'param' );

    /* pas de doublon prof/famille */
    if ( get_posts( [
            'post_type'  => 'sr_request',
            'meta_query' => [
                [ 'key'=>'_sr_prof',   'value'=>$prof ],
                [ 'key'=>'_sr_family', 'value'=>$fam  ],
            ],
            'fields'     => 'ids',
            'numberposts'=> 1,
        ] ) )
        wp_send_json_error( 'Déjà optionné' );

    $id = wp_insert_post( [
        'post_type'  => 'sr_request',
        'post_status'=> 'publish',
        'post_title' => "Demande prof {$prof} → famille {$fam}",
        'meta_input' => [
            '_sr_prof'   => $prof,
            '_sr_family' => $fam,
            '_sr_status' => 'pending',
            '_sr_date'   => current_time( 'mysql' ),
        ],
    ] );

    is_wp_error( $id ) ? wp_send_json_error( $id->get_error_message() )
                       : wp_send_json_success();
}

/*──────── page admin « Demandes » --------------------------------------*/
function sr_render_requests_page() {
    if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Accès refusé' );

    /* validation */
    if ( isset( $_GET['sr_approve'] ) ) {
        $rid = intval( $_GET['sr_approve'] );
        update_post_meta( $rid, '_sr_status', 'approved' );
        sr_notify_prof_approved(
            intval( get_post_meta( $rid, '_sr_prof',   true ) ),
            intval( get_post_meta( $rid, '_sr_family', true ) )
        );
        echo '<div class="notice notice-success"><p>Demande approuvée & mail envoyé.</p></div>';
    }

    $rq = get_posts( [
        'post_type'   => 'sr_request',
        'numberposts' => -1,
        'orderby'     => 'date',
        'order'       => 'DESC',
    ] );

    echo '<div class="wrap"><h1>Demandes</h1>
          <table class="widefat striped">
            <thead><tr><th>Date</th><th>Prof</th><th>Famille</th><th>Statut</th><th></th></tr></thead><tbody>';

    foreach ( $rq as $p ) {
        $prof = intval( get_post_meta( $p->ID, '_sr_prof',   true ) );
        $fam  = intval( get_post_meta( $p->ID, '_sr_family', true ) );
        $st   = esc_html( get_post_meta( $p->ID, '_sr_status', true ) );

        echo '<tr>
                <td>'. esc_html( $p->post_date ) .'</td>
                <td>'. esc_html( get_userdata( $prof )->display_name ) .'</td>
                <td>'. esc_html( get_userdata( $fam  )->display_name ) .'</td>
                <td>'. ucfirst( $st ) .'</td>
                <td>'. ( $st === 'pending'
                       ? '<a class="button button-primary" href="'.admin_url(
                           'admin.php?page=staff-registrar-requests&sr_approve='.$p->ID ).'">Approuver</a>'
                       : '' ) .'</td></tr>';
    }
    echo '</tbody></table></div>';
}

/*──────── notification mail prof --------------------------------------*/
function sr_notify_prof_approved( $prof_id, $fam_id ){

    $prof = get_userdata( $prof_id );
    $fam  = get_userdata( $fam_id );

    $msg  = "Bonjour {$prof->first_name},\n\n";
    $msg .= "Un cours vous a été attribué : {$fam->display_name}\n";
    $msg .= "Contact famille : {$fam->user_email}\n\n";
    $msg .= "Merci de les appeler dans les 48 h.\n\n— L’équipe";

    wp_mail( $prof->user_email, 'Nouveau cours attribué', $msg, [ 'Bcc: '.SR_BCC_AGENCE ] );
}

/*════════════════════════════════════════════
 * 8.  SHORTCODE [sr_students]  + assets + AJAX
 *════════════════════════════════════════════*/
add_shortcode( 'sr_students', 'sr_render_students' );
function sr_render_students() {

    if ( ! is_user_logged_in() ) return '<p>Veuillez vous connecter.</p>';

    $prof_id = get_current_user_id();

    /* assets */
    wp_enqueue_style ( 'leaflet',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', [], null );
    wp_enqueue_script( 'leaflet',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', [], null, true );

    wp_enqueue_script( 'sr-students',
        plugin_dir_url( __FILE__ ) . 'js/sr-students.js',
        [ 'jquery', 'leaflet' ],
        filemtime( plugin_dir_path( __FILE__ ) . 'js/sr-students.js' ),
        true );

    wp_enqueue_style( 'sr-students',
        plugin_dir_url( __FILE__ ) . 'css/sr-students.css',
        [],
        filemtime( plugin_dir_path( __FILE__ ) . 'css/sr-students.css' ) );

    wp_localize_script( 'sr-students', 'sr_students_vars', [
        'ajax_url' => admin_url( 'admin-ajax.php' ),
        'nonce'    => wp_create_nonce( 'sr_nonce' ),
        'prof_id'  => $prof_id,
    ] );

    return '<div id="sr-students-app"><p>Chargement…</p></div>';
}

/*──────── AJAX : liste élèves ------------------------------------------*/
add_action( 'wp_ajax_sr_get_students', 'sr_ajax_get_students' );
function sr_ajax_get_students() {

    if ( ! check_ajax_referer( 'sr_nonce', 'nonce', false ) )
        wp_send_json_error( 'nonce' );

    $prof = intval( $_POST['prof_id'] ?? 0 );

    $reqs = get_posts( [
        'post_type'   => 'sr_request',
        'meta_query'  => [
            [ 'key'=>'_sr_prof',   'value'=>$prof ],
            [ 'key'=>'_sr_status', 'value'=>'approved' ],
        ],
        'numberposts' => -1,
    ] );

    $out = [];
    foreach ( $reqs as $r ) {
        $fam = intval( get_post_meta( $r->ID, '_sr_family', true ) );
        $out[] = [
            'family_id' => $fam,
            'name'      => get_userdata( $fam )->display_name,
            'class'     => get_user_meta( $fam, 'sr_level',   true ),
            'subject'   => get_user_meta( $fam, 'sr_subject', true ),
            'freq'      => get_user_meta( $fam, 'sr_freq',    true ),
            'duration'  => get_user_meta( $fam, 'sr_duration',true ),
            'status'    => 'Confirmé',
            'address'   => get_user_meta( $fam, 'sr_addr1',  true ).' '.
                           get_user_meta( $fam, 'sr_postcode', true ).' '.
                           get_user_meta( $fam, 'sr_city', true ),
            'lat'       => get_user_meta( $fam, 'sr_lat', true ),
            'lng'       => get_user_meta( $fam, 'sr_lng', true ),
            'phone'     => get_user_meta( $fam, 'sr_rep_phone', true )
                           ?: get_user_meta( $fam, 'sr_prof_phone', true ),
        ];
    }
    wp_send_json_success( $out );
}

/*──────── AJAX : déclaration d’heures ---------------------------------*/
add_action( 'wp_ajax_sr_declare_hours', 'sr_ajax_declare_hours' );
function sr_ajax_declare_hours() {

    if ( ! check_ajax_referer( 'sr_nonce', 'nonce', false ) )
        wp_send_json_error( 'nonce' );

    $prof  = intval( $_POST['prof_id']   ?? 0 );
    $fam   = intval( $_POST['family_id'] ?? 0 );
    $hours = floatval( $_POST['hours']   ?? 0 );

    if ( ! $prof || ! $fam || $hours <= 0 )
        wp_send_json_error( 'data' );

    wp_insert_post( [
        'post_type'  => 'sr_course',
        'post_status'=> 'publish',
        'post_title' => "Cours {$hours}h – prof {$prof} / fam {$fam}",
        'meta_input' => [
            '_sr_prof'   => $prof,
            '_sr_family' => $fam,
            '_sr_hours'  => $hours,
            '_sr_status' => 'pending',
            '_sr_date'   => current_time( 'mysql' ),
        ],
    ] );

    wp_send_json_success();
}

/*──────── AJAX : synthèse heures --------------------------------------*/
add_action( 'wp_ajax_sr_hours_summary', 'sr_ajax_hours_summary' );
function sr_ajax_hours_summary() {

    if ( ! check_ajax_referer( 'sr_nonce', 'nonce', false ) )
        wp_send_json_error( 'nonce' );

    $prof = intval( $_POST['prof_id']   ?? 0 );
    $fam  = intval( $_POST['family_id'] ?? 0 );

    $posts = get_posts( [
        'post_type'  => 'sr_course',
        'meta_query' => [
            [ 'key'=>'_sr_prof',   'value'=>$prof ],
            [ 'key'=>'_sr_family', 'value'=>$fam  ],
        ],
        'numberposts'=> -1,
    ] );

    $sum = [ 'paid'=>0, 'advance'=>0, 'pending'=>0 ];
    foreach ( $posts as $p ) {
        $h  = floatval( get_post_meta( $p->ID, '_sr_hours',  1 ) );
        $st =          get_post_meta( $p->ID, '_sr_status', 1 );
        if     ( $st === 'paid'    ) $sum['paid']    += $h;
        elseif ( $st === 'advance' ) $sum['advance'] += $h;
        else                         $sum['pending'] += $h;
    }
    wp_send_json_success( $sum );
}

/*════════════════════════════════════════════
 * 9.  CRON : auto-validation « pending » → « paid » (48 h)
 *════════════════════════════════════════════*/
if ( ! wp_next_scheduled( 'sr_cron_autopay' ) ) {
    wp_schedule_event( time()+300, 'hourly', 'sr_cron_autopay' );
}

add_action( 'sr_cron_autopay', function () {

    $posts = get_posts( [
        'post_type'  => 'sr_course',
        'meta_query' => [ [ 'key'=>'_sr_status', 'value'=>'pending' ] ],
        'numberposts'=> -1,
        'fields'     => 'ids',
    ] );

    foreach ( $posts as $pid ) {
        $ts = strtotime( get_post_meta( $pid, '_sr_date', true ) );
        if ( $ts && time() - $ts > 48*3600 )
            update_post_meta( $pid, '_sr_status', 'paid' );
    }
});

/*════════════════════════════════════════════
 * 11.  ADMIN : « Heures déclarées »
 *════════════════════════════════════════════*/
function sr_render_hours_page() {

    if ( ! current_user_can( 'manage_options' ) )
        wp_die( 'Accès refusé' );

    /* changement de statut ------------------------------------------- */
    if ( isset( $_GET['sr_hours_id'], $_GET['sr_set'] ) ) {
        $pid = intval( $_GET['sr_hours_id'] );
        $new = sanitize_key( $_GET['sr_set'] );
        if ( in_array( $new, [ 'paid','advance','pending' ], true ) ) {
            update_post_meta( $pid, '_sr_status', $new );
            echo '<div class="notice notice-success"><p>Statut mis à jour.</p></div>';
        }
    }

    /* suppression ----------------------------------------------------- */
    if ( isset( $_GET['sr_del'] ) ) {
        wp_trash_post( intval( $_GET['sr_del'] ) );
        echo '<div class="notice notice-error"><p>Déclaration supprimée.</p></div>';
    }

    /* liste ----------------------------------------------------------- */
    $posts = get_posts( [
        'post_type'   => 'sr_course',
        'post_status' => [ 'publish', 'pending', 'draft', 'future' ],
        'numberposts' => -1,
        'orderby'     => 'date',
        'order'       => 'DESC',
    ] );

    echo '<div class="wrap"><h1>Heures déclarées</h1>
          <table class="widefat striped">
          <thead><tr>
            <th>Date</th><th>Prof</th><th>Famille</th>
            <th>Heures</th><th>Statut</th><th>Actions</th>
          </tr></thead><tbody>';

    foreach ( $posts as $p ) {

        $prof = intval( get_post_meta( $p->ID, '_sr_prof',   true ) );
        $fam  = intval( get_post_meta( $p->ID, '_sr_family', true ) );
        $h    = floatval( get_post_meta( $p->ID, '_sr_hours', true ) );
        $st   = esc_html( get_post_meta( $p->ID, '_sr_status', true ) );

        $base = admin_url( 'admin.php?page=staff-registrar-hours&sr_hours_id='.$p->ID.'&sr_set=' );
        $del  = admin_url( 'admin.php?page=staff-registrar-hours&sr_del='     .$p->ID );

        echo '<tr>
                <td>'. esc_html( $p->post_date ) .'</td>
                <td>'. esc_html( get_userdata( $prof )->display_name ) .'</td>
                <td>'. esc_html( get_userdata( $fam  )->display_name ) .'</td>
                <td>'. number_format_i18n( $h, 1 ) .'</td>
                <td>'. ucfirst( $st ) .'</td>
                <td>
                  <a class="button" href="'.$base.'paid">Payé</a>
                  <a class="button" href="'.$base.'advance">Advance</a>
                  <a class="button" href="'.$base.'pending">En&nbsp;attente</a>
                  <a class="button button-secondary" href="'.$del.'" onclick="return confirm(\'Supprimer ?\');">🗑 Supprimer</a>
                </td>
              </tr>';
    }

    echo '</tbody></table></div>';
}

/*════════════════════════════════════════════
 *  X.  Page admin « Attributions »
 *════════════════════════════════════════════*/
function sr_render_assign_page() {

    if ( ! current_user_can( 'manage_options' ) )
        wp_die( 'Accès refusé' );

    /* annulation d’une attribution ------------------------------- */
    if ( isset( $_GET['sr_unassign'] ) ) {
        $rid = intval( $_GET['sr_unassign'] );
        update_post_meta( $rid, '_sr_status', 'cancelled' );
        echo '<div class="notice notice-warning"><p>Attribution annulée.</p></div>';
    }

    /* liste des demandes approuvées ------------------------------ */
    $rows = get_posts( [
        'post_type'   => 'sr_request',
        'meta_query'  => [ [ 'key'=>'_sr_status', 'value'=>'approved' ] ],
        'numberposts' => -1,
        'orderby'     => 'date',
        'order'       => 'DESC',
    ] );

    echo '<div class="wrap"><h1>Attributions prof ↔︎ élève</h1>
          <table class="widefat striped">
            <thead><tr>
              <th>Date</th><th>Professeur</th><th>Famille / élève</th><th></th>
            </tr></thead><tbody>';

    foreach ( $rows as $r ) {
        $prof = intval( get_post_meta( $r->ID, '_sr_prof', true ) );
        $fam  = intval( get_post_meta( $r->ID, '_sr_family', true ) );

        echo '<tr>
                <td>'. esc_html( $r->post_date ) .'</td>
                <td>'. esc_html( get_userdata( $prof )->display_name ) .'</td>
                <td>'. esc_html( get_userdata( $fam  )->display_name ) .'</td>
                <td><a class="button" href="'.
                     admin_url( 'admin.php?page=staff-registrar-assign&sr_unassign='.$r->ID ).
                     '" onclick="return confirm(\'Annuler cette attribution ?\');">Annuler</a></td>
              </tr>';
    }

    echo '</tbody></table></div>';
}

/*════════════════════════════════════════════
 * 12.  SHORTCODE  [sr_acomptes]   (liste simple)
 *════════════════════════════════════════════*/
add_shortcode( 'sr_acomptes', 'sr_render_acomptes' );

function sr_render_acomptes() {

    if ( ! is_user_logged_in() ) {
        return '<p>Veuillez vous connecter.</p>';
    }
    $prof_id = get_current_user_id();

    /* charge le CSS uniquement quand la page « acomptes » est affichée */
    wp_enqueue_style(
        'sr-payments',
        plugin_dir_url( __FILE__ ) . 'css/sr-payments.css',
        [],
        filemtime( plugin_dir_path( __FILE__ ) . 'css/sr-payments.css' )
    );

    /* récupère les cours en avance ou réglés */
    $rows = get_posts( [
        'post_type'   => 'sr_course',
        'meta_query'  => [
            [ 'key' => '_sr_prof',   'value' => $prof_id ],
            [
                'key'     => '_sr_status',
                'value'   => [ 'advance', 'paid' ],
                'compare' => 'IN',
            ],
        ],
        'orderby'     => 'meta_value',
        'meta_key'    => '_sr_date',
        'order'       => 'DESC',
        'numberposts' => -1,
    ] );

    if ( ! $rows ) {
        return '<p>Aucun acompte enregistré pour le moment.</p>';
    }

    /* rendu tableau */
    ob_start(); ?>
    <table class="sr-pay-table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Famille</th>
                <th>Heures</th>
                <th>Statut</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ( $rows as $c ) :
            $fam   = intval( get_post_meta( $c->ID, '_sr_family', 1 ) );
            $date  = esc_html( get_post_meta( $c->ID, '_sr_date',   1 ) );
            $hours = esc_html( get_post_meta( $c->ID, '_sr_hours',  1 ) );
            $stat  = ucfirst( get_post_meta( $c->ID, '_sr_status', 1 ) );
        ?>
            <tr>
                <td><?php echo $date;  ?></td>
                <td><?php echo esc_html( get_userdata( $fam )->display_name ); ?></td>
                <td><?php echo $hours; ?></td>
                <td><?php echo $stat;  ?></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php
    return ob_get_clean();
}

/*════════════════════════════════════════════
 * FAMILLE –  [sr_fam_courses]
 *════════════════════════════════════════════*/
add_shortcode( 'sr_fam_courses', 'sr_render_fam_courses' );

function sr_render_fam_courses() {

    if ( ! is_user_logged_in() ) return '<p>Veuillez vous connecter.</p>';
    if ( ! current_user_can( 'um_famille' ) ) return '<p>Accès réservé aux familles.</p>';

    /* assets */
    wp_enqueue_style ( 'sr-fam-courses',
        plugin_dir_url( __FILE__ ) . 'css/sr-fam-courses.css',
        [], filemtime( plugin_dir_path( __FILE__ ) . 'css/sr-fam-courses.css' ) );

    wp_enqueue_script( 'sr-fam-courses',
        plugin_dir_url( __FILE__ ) . 'js/sr-fam-courses.js',
        [ 'jquery' ],
        filemtime( plugin_dir_path( __FILE__ ) . 'js/sr-fam-courses.js' ),
        true );

    wp_localize_script( 'sr-fam-courses', 'sr_fam_vars', [
        'ajax_url' => admin_url( 'admin-ajax.php' ),
        'nonce'    => wp_create_nonce( 'sr_nonce' ),
        'fam_id'   => get_current_user_id(),
    ] );

    return '<div id="sr-fam-courses-app"><p>Chargement…</p></div>';
}
add_action( 'wp_ajax_sr_get_family_courses', 'sr_ajax_get_family_courses' );
function sr_ajax_get_family_courses() {

    if ( ! check_ajax_referer( 'sr_nonce', 'nonce', false ) )
        wp_send_json_error( 'nonce' );

    $fam = intval( $_POST['fam_id'] ?? 0 );

    $reqs = get_posts( [
        'post_type'   => 'sr_request',
        'meta_query'  => [
            [ 'key' => '_sr_family', 'value' => $fam ],
            [ 'key' => '_sr_status', 'value' => [ 'pending', 'approved' ], 'compare'=>'IN' ]
        ],
        'numberposts' => -1
    ] );

    $out = [];
    foreach ( $reqs as $r ) {
        $prof = intval( get_post_meta( $r->ID, '_sr_prof', true ) );
        $out[] = [
            'prof'   => get_userdata( $prof )->display_name,
            'status' => get_post_meta( $r->ID, '_sr_status', true ),
            'date'   => $r->post_date
        ];
    }
    wp_send_json_success( $out );
}


/*════════════════════════════════════════════
 * 14.  SHORTCODE  [sr_family_consos]
 *════════════════════════════════════════════*/
add_shortcode( 'sr_family_consos', 'sr_family_consos_sc' );
function sr_family_consos_sc() {

    if ( ! is_user_logged_in() || ! current_user_can( 'um_famille' ) ) {
        return '<p>Veuillez vous connecter en tant que famille.</p>';
    }
    $fam = get_current_user_id();

    // Regroupement par YYYY-MM
    global $wpdb;
    $sql = $wpdb->prepare(
      "SELECT DATE_FORMAT(meta_date.meta_value,'%%Y-%%m') AS ym,
              SUM( CAST(meta_hours.meta_value AS DECIMAL(5,2)) ) AS h
       FROM {$wpdb->posts} c
       JOIN {$wpdb->postmeta} meta_fam   ON meta_fam.post_id=c.ID   AND meta_fam.meta_key='_sr_family'
       JOIN {$wpdb->postmeta} meta_date  ON meta_date.post_id=c.ID  AND meta_date.meta_key='_sr_date'
       JOIN {$wpdb->postmeta} meta_hours ON meta_hours.post_id=c.ID AND meta_hours.meta_key='_sr_hours'
       WHERE c.post_type='sr_course' AND meta_fam.meta_value=%d
       GROUP BY ym ORDER BY ym DESC",
       $fam
    );
    $rows = $wpdb->get_results( $sql );

    ob_start(); ?>
    <table class="sr-conso-table">
        <thead><tr><th>Mois</th><th>Heures</th><th>Total € (avant -50 %)</th><th>À charge €</th></tr></thead>
        <tbody>
        <?php foreach ( $rows as $r ) :
            $gross = $r->h * SR_FAMILY_HOURLY_RATE;
            $net   = $r->h * SR_FAMILY_NET_HOURLY; ?>
            <tr>
              <td><?php echo esc_html( date_i18n( 'F Y', strtotime( $r->ym.'-01' ) ) ); ?></td>
              <td><?php echo number_format_i18n( $r->h, 1 ); ?></td>
              <td><?php echo number_format_i18n( $gross, 2 ); ?> €</td>
              <td><?php echo number_format_i18n( $net,   2 ); ?> €</td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php
    /* petite feuille de style */
    wp_enqueue_style( 'sr-family-consos',
        plugin_dir_url( __FILE__ ).'css/sr-families-consos.css',
        [], filemtime( plugin_dir_path( __FILE__ ).'css/sr-families-consos.css' ) );

    return ob_get_clean();
}

/*════════════════════════════════════════════
 * 15.  SHORTCODE  [sr_family_invoices]
 *════════════════════════════════════════════*/
add_shortcode( 'sr_family_invoices', 'sr_family_invoices_sc' );
function sr_family_invoices_sc() {

    if ( ! is_user_logged_in() || ! current_user_can( 'um_famille' ) ) {
        return '<p>Veuillez vous connecter en tant que famille.</p>';
    }
    $fam = get_current_user_id();

    /* Ici on suppose que chaque post_type=sr_invoice sera créé plus tard */
    $rows = get_posts( [
        'post_type'   => 'sr_invoice',
        'meta_key'    => '_sr_period',
        'orderby'     => 'meta_value',
        'order'       => 'DESC',
        'meta_query'  => [
            [ 'key' => '_sr_family', 'value' => $fam ],
        ],
        'numberposts' => -1,
    ] );

    if ( ! $rows ) return '<p>Aucune facture disponible.</p>';

    ob_start(); ?>
    <table class="sr-inv-table">
      <thead><tr><th>Mois</th><th>Total €</th><th></th></tr></thead><tbody>
      <?php foreach ( $rows as $p ) :
        $per  = esc_html( get_post_meta( $p->ID, '_sr_period', true ) ); // ex : 2025-04
        $tot  = esc_html( get_post_meta( $p->ID, '_sr_total',  true ) ); ?>
        <tr>
          <td><?php echo date_i18n( 'F Y', strtotime( $per.'-01' ) ); ?></td>
          <td><?php echo number_format_i18n( $tot, 2 ); ?> €</td>
          <td><a class="button button-primary" href="<?php echo esc_url( wp_get_attachment_url( get_post_meta( $p->ID, '_sr_pdf', true ) ) ); ?>" target="_blank">Télécharger</a></td>
        </tr>
      <?php endforeach; ?>
      </tbody></table>
    <?php
    wp_enqueue_style( 'sr-family-invoices',
        plugin_dir_url( __FILE__ ).'css/sr-families-invoices.css',
        [], filemtime( plugin_dir_path( __FILE__ ).'css/sr-families-invoices.css' ) );

    return ob_get_clean();
}

