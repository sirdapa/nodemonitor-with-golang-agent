package main

/**
 * ============================================================================
 * reporter.go — Pengirim metrik ke dashboard
 * ----------------------------------------------------------------------------
 * Mengirim struct Metrics ke endpoint /api/report di dashboard via HTTP POST.
 * ============================================================================
 */

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// reporter bertanggung jawab mengirim metrik ke dashboard.
type reporter struct {
	cfg    Config
	client *http.Client
}

// newReporter membuat instance reporter baru dengan HTTP client yang sudah
// dikonfigurasi timeout.
//
// @param cfg Konfigurasi agent.
// @returns Instance reporter.
func newReporter(cfg Config) *reporter {
	return &reporter{
		cfg: cfg,
		client: &http.Client{
			Timeout: cfg.Timeout,
		},
	}
}

// send mengirim metrik ke dashboard via POST /api/report.
//
// @param m Metrik yang akan dikirim.
// @returns error jika gagal, nil jika sukses.
func (r *reporter) send(m Metrics) error {
	body, err := json.Marshal(m)
	if err != nil {
		return fmt.Errorf("marshal metrics: %w", err)
	}

	url := r.cfg.DashboardURL + "/api/report"
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("dashboard returned status %d", resp.StatusCode)
	}

	return nil
}

// reportLoop menjalankan loop pengiriman metrik secara periodik.
// Fungsi ini blocking — panggil di goroutine terpisah.
//
// @param r Instance reporter.
func reportLoop(r *reporter) {
	ticker := time.NewTicker(r.cfg.Interval)
	defer ticker.Stop()

	// Kirim langsung saat startup, lalu setiap interval.
	for {
		m := collectMetrics(r.cfg)
		if err := r.send(m); err != nil {
			log.Printf("[ERROR] Report failed: %v", err)
		} else {
			log.Printf("[OK] Reported to %s | CPU: %.1f%% | RAM: %.1f%% | Disk: %.1f%%",
				r.cfg.DashboardURL, m.CPU.Usage, m.Memory.Percent, m.Disk.Percent)
		}
		<-ticker.C
	}
}
