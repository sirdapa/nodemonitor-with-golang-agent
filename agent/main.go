package main

/**
 * ============================================================================
 * main.go — Entry point agent Go
 * ----------------------------------------------------------------------------
 * Agent monitoring VPS yang mengumpulkan metrik sistem dan mengirimnya
 * ke dashboard Node Monitor setiap N detik.
 *
 * Cara pakai:
 *   go build -o node-monitor-agent
 *   DASHBOARD_URL=http://your-dashboard:3000 TOKEN=changeme ./node-monitor-agent
 *
 * Environment variables:
 *   - DASHBOARD_URL  URL dashboard        (default: http://localhost:3000)
 *   - TOKEN          Token autentikasi    (default: changeme)
 *   - HOSTNAME       Nama host            (default: hostname OS)
 *   - INTERVAL_SEC   Jeda report          (default: 10)
 *   - TIMEOUT_SEC    Timeout HTTP         (default: 5)
 * ============================================================================
 */

import (
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	cfg := loadConfig()

	log.Printf("=== Node Monitor Agent (Go) ===")
	log.Printf("Dashboard: %s", cfg.DashboardURL)
	log.Printf("Interval:  %s", cfg.Interval)
	log.Printf("Timeout:   %s", cfg.Timeout)

	hostname := cfg.Hostname
	if hostname == "" {
		hostname, _ = os.Hostname()
	}
	log.Printf("Hostname:  %s", hostname)
	log.Printf("-------------------------------")

	r := newReporter(cfg)

	// Jalankan loop report di goroutine terpisah.
	go reportLoop(r)

	// Tunggu sinyal interrupt/terminate untuk shutdown graceful.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh
	log.Printf("Received signal %v, shutting down...", sig)
}
