<?php
// Simple logger to debug.txt
if (isset($_POST['msg'])) {
    $msg = $_POST['msg'];
    $timestamp = date('Y-m-d H:i:s');
    $entry = "[$timestamp] $msg\n";
    file_put_contents('debug.txt', $entry, FILE_APPEND);
}
?>
