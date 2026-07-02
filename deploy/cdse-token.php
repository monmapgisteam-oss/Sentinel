<?php
/**
 * CDSE token proxy — Mongolia Imagery Explorer.
 *
 * The Copernicus token endpoint (Keycloak) sends no CORS headers, so the browser
 * can't call it directly. Upload this file to your existing PHP web server (the
 * one that runs WordPress), e.g. https://monmap.mn/cdse-token.php, and set the
 * app's VITE_TOKEN_PROXY_URL to that URL. The client_id/secret live here on the
 * server — never exposed to the browser.
 *
 * Requires PHP with cURL (standard on WordPress hosting).
 */

// Allow the app's origin to read the response.
header('Access-Control-Allow-Origin: https://sentinel.monmap.mn');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: content-type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// === Fill these in with your Copernicus OAuth client credentials ===
// (Do this in the copy you upload to your server — keep the repo copy as placeholders.)
$CLIENT_ID = 'YOUR_CLIENT_ID';
$CLIENT_SECRET = 'YOUR_CLIENT_SECRET';

$ch = curl_init('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'grant_type' => 'client_credentials',
    'client_id' => $CLIENT_ID,
    'client_secret' => $CLIENT_SECRET,
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($status ?: 502);
echo $response !== false ? $response : '{"error":"proxy_failed"}';
