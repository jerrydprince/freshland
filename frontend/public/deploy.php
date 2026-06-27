<?php
/**
 * Simple Secure Git Deployment Script for cPanel
 * Reference: https://docs.cpanel.net/knowledge-base/general-systems-administration/guide-to-git-set-up-deployment/
 */

// Define your secret security token here
define('DEPLOY_TOKEN', 'sparkles_secure_deploy_2026_token');

// Validate the token passed in the URL
if (!isset($_GET['token']) || $_GET['token'] !== DEPLOY_TOKEN) {
    header('HTTP/1.1 403 Forbidden');
    echo 'Access Denied: Invalid Security Token';
    exit;
}

echo "Starting Git Deployment...\n";

// Execute git commands to pull latest changes from GitHub
// We run reset --hard to discard any local permission drift on the host
// Discover repository path dynamically
$repoPath = '/home/sparkle7/public_html/test.sparklesapartments.ng/';
if (!file_exists($repoPath)) {
    $repoPath = '/home/sparkle7/Sparkles-Hotel-Booking';
}
if (!file_exists($repoPath)) {
    // Check two levels up (if running in frontend/dist/deploy.php)
    $parentRepo = dirname(dirname(__DIR__));
    if (file_exists($parentRepo . '/.git')) {
        $repoPath = $parentRepo;
    }
}
if (!file_exists($repoPath)) {
    // Check one level up (if running in public/deploy.php or similar)
    $parentRepo = dirname(__DIR__);
    if (file_exists($parentRepo . '/.git')) {
        $repoPath = $parentRepo;
    }
}
if (!file_exists($repoPath)) {
    // Check current directory
    if (file_exists(__DIR__ . '/.git')) {
        $repoPath = __DIR__;
    }
}

if (file_exists($repoPath) && chdir($repoPath)) {
    // Delete git index lock file if it exists to prevent deployment lockouts
    $lockFile = './.git/index.lock';
    if (file_exists($lockFile)) {
        if (@unlink($lockFile)) {
            $output[] = "Successfully removed stale git lock file: $lockFile";
        } else {
            $output[] = "Warning: Failed to remove stale git lock file: $lockFile";
        }
    }

    // Clean untracked files and reset any local modifications to avoid merge conflicts
    exec('git reset --hard HEAD 2>&1', $output);
    exec('git clean -fd 2>&1', $output);
    
    exec('git fetch origin main 2>&1', $output, $return_var);
    exec('git reset --hard origin/main 2>&1', $output, $return_var);
    
    if ($return_var === 0) {
        $distPath = $repoPath . '/frontend/dist';
        $deployDest = __DIR__;
        
        // If the repository's build folder is not the same as where the script is running,
        // copy the compiled assets and the hidden .htaccess to the active public directory.
        if (realpath($distPath) !== realpath($deployDest)) {
            $output[] = "Copying files from $distPath to $deployDest...";
            exec('/bin/cp -R ' . escapeshellarg($distPath) . '/* ' . escapeshellarg($deployDest) . '/ 2>&1', $output, $return_var);
            exec('/bin/cp ' . escapeshellarg($distPath) . '/.htaccess ' . escapeshellarg($deployDest) . '/ 2>&1', $output, $return_var);
        } else {
            $output[] = "Deploy directory matches build output. Skipping file copying.";
        }
    }
} else {
    $return_var = 1;
    $output[] = "Error: Could not find or chdir to repository path. Resolved path: $repoPath";
}

// If cPanel Version Control is configured, it will run .cpanel.yml automatically on pull/update
echo "\nCommand Output:\n";
echo implode("\n", $output);

if ($return_var === 0) {
    if (function_exists('opcache_reset')) {
        @opcache_reset();
    }
    echo "\n\nDeployment Completed Successfully!";
} else {
    echo "\n\nDeployment Failed with code: " . $return_var;
}
