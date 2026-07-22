// KoncoVibe Desktop — Binary Entry Point
// Mencegah additional console window di Windows release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    koncovibe_lib::run()
}
