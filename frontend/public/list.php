<?php
$dir = __DIR__ . '/';
echo "Directory listing for: $dir\n\n";

if (is_dir($dir)) {
    $files = scandir($dir);
    foreach ($files as $file) {
        $filePath = $dir . $file;
        $size = is_file($filePath) ? filesize($filePath) . " bytes" : "[DIR]";
        $perms = sprintf('%o', fileperms($filePath));
        echo sprintf("%-40s %-15s %s\n", $file, $size, $perms);
    }
} else {
    echo "Error: Directory does not exist.";
}
