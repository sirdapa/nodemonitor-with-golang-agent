package main

/**
 * ============================================================================
 * config.go — Konfigurasi agent
 * ----------------------------------------------------------------------------
 * Semua konfigurasi dibaca dari environment variables dengan nilai default.
 * ============================================================================
 */

import (
	"os"
	"strconv"
	"time"
)

// Config menyimpan semua konfigurasi agent.
type Config struct {
	// DashboardURL adalah URL tujuan dashboard (wajib).
	DashboardURL string
	// Token adalah token autentikasi yang harus cocok dengan server.
	Token string
	// Hostname adalah nama host yang dilaporkan. Kosong = otomatis dari OS.
	Hostname string
	// Interval adalah jeda antar report.
	Interval time.Duration
	// Timeout adalah timeout HTTP request.
	Timeout time.Duration
}

// loadConfig memuat konfigurasi dari environment variables.
//
// Environment variables:
//   - DASHBOARD_URL  (default: http://localhost:3000)
//   - TOKEN          (default: changeme)
//   - HOSTNAME       (default: hostname OS)
//   - INTERVAL_SEC   (default: 10)
//   - TIMEOUT_SEC    (default: 5)
//
// @returns Config yang sudah terisi.
func loadConfig() Config {
	intervalSec, _ := strconv.Atoi(getEnv("INTERVAL_SEC", "10"))
	timeoutSec, _ := strconv.Atoi(getEnv("TIMEOUT_SEC", "5"))

	return Config{
		DashboardURL: getEnv("DASHBOARD_URL", "http://localhost:3000"),
		Token:        getEnv("TOKEN", "changeme"),
		Hostname:     getEnv("HOSTNAME", ""),
		Interval:     time.Duration(intervalSec) * time.Second,
		Timeout:      time.Duration(timeoutSec) * time.Second,
	}
}

// getEnv membaca environment variable, return fallback jika kosong.
//
// @param key      Nama env var.
// @param fallback Nilai default jika env var tidak diset atau kosong.
// @returns Nilai env var atau fallback.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
