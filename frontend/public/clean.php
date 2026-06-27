<?php
/**
 * Script to clean up stale git lock files on the server
 */
header('Content-Type: text/plain');

$repoPath = '/home/sparkle7/public_html/test.sparklesapartments.ng';
if (!file_exists($repoPath)) {
    $repoPath = '/home/sparkle7/Sparkles-Hotel-Booking';
}
if (!file_exists($repoPath)) {
    $repoPath = dirname(__DIR__);
}

if (file_exists($repoPath)) {
    $lockFile = $repoPath . '/.git/index.lock';
    if (file_exists($lockFile)) {
        if (unlink($lockFile)) {
            echo "Successfully deleted git lock file: $lockFile\n";
        } else {
            echo "Failed to delete git lock file: $lockFile\n";
        }
    } else {
        echo "No git lock file found at: $lockFile\n";
    }
} else {
    echo "Error: Repository path not found.\n";
}
