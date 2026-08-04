package main

/**
 * ============================================================================
 * metrics.go — Pengumpul metrik sistem
 * ----------------------------------------------------------------------------
 * Mengumpulkan CPU, memory, disk, network, dan docker stats menggunakan
 * library gopsutil. Semua metrik dikumpulkan dalam struct Metrics.
 * ============================================================================
 */

import (
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/docker"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// CPUMetrics menyimpan metrik CPU.
type CPUMetrics struct {
	Usage float64 `json:"usage"` // Persentase 0-100
}

// MemoryMetrics menyimpan metrik memory dalam MB.
type MemoryMetrics struct {
	Used    float64 `json:"used"`    // MB
	Total   float64 `json:"total"`   // MB
	Percent float64 `json:"percent"` // Persentase 0-100
}

// DiskMetrics menyimpan metrik disk dalam GB.
type DiskMetrics struct {
	Used    float64 `json:"used"`    // GB
	Total   float64 `json:"total"`   // GB
	Percent float64 `json:"percent"` // Persentase 0-100
}

// NetworkMetrics menyimpan metrik network dalam bytes/sec.
type NetworkMetrics struct {
	RX float64 `json:"rx"` // bytes/sec received
	TX float64 `json:"tx"` // bytes/sec transmitted
}

// DockerMetrics menyimpan metrik Docker containers.
type DockerMetrics struct {
	Containers int `json:"containers"` // Total container
	Running    int `json:"running"`    // Container yang running
}

// Metrics adalah payload lengkap yang dikirim ke dashboard.
type Metrics struct {
	Token     string        `json:"token"`
	Hostname  string        `json:"hostname"`
	OS        string        `json:"os"`
	Platform  string        `json:"platform"`
	Uptime    uint64        `json:"uptime"`
	CPU       CPUMetrics    `json:"cpu"`
	Memory    MemoryMetrics `json:"memory"`
	Disk      DiskMetrics   `json:"disk"`
	Network   NetworkMetrics `json:"network"`
	Docker    DockerMetrics  `json:"docker"`
}

// collectMetrics mengumpulkan semua metrik sistem dan mengembalikan struct
// Metrics yang siap dikirim ke dashboard.
//
// Jika suatu metrik gagal dikumpulkan, nilai default (0) digunakan dan
// error diabaikan agar agent tetap berjalan.
//
// @param cfg Konfigurasi agent (untuk token & hostname).
// @returns Metrics yang sudah terisi.
func collectMetrics(cfg Config) Metrics {
	hostname := cfg.Hostname
	if hostname == "" {
		hostname, _ = os.Hostname()
	}

	m := Metrics{
		Token:    cfg.Token,
		Hostname: hostname,
		OS:       fmt.Sprintf("%s %s", runtime.GOOS, getOSVersion()),
		Platform: runtime.GOOS,
	}

	// Uptime sistem.
	if uptime, err := host.Uptime(); err == nil {
		m.Uptime = uptime
	}

	// CPU — persentase usage (blocking call, sample 1 detik).
	if percent, err := cpu.Percent(time.Second, false); err == nil && len(percent) > 0 {
		m.CPU.Usage = roundFloat(percent[0])
	}

	// Memory.
	if vm, err := mem.VirtualMemory(); err == nil {
		m.Memory.Used = roundFloat(float64(vm.Used) / 1024 / 1024)       // MB
		m.Memory.Total = roundFloat(float64(vm.Total) / 1024 / 1024)     // MB
		m.Memory.Percent = roundFloat(vm.UsedPercent)
	}

	// Disk — ambil partisi root atau pertama.
	if parts, err := disk.Partitions(false); err == nil && len(parts) > 0 {
		if usage, err := disk.Usage(parts[0].Mountpoint); err == nil {
			m.Disk.Used = roundFloat(float64(usage.Used) / 1024 / 1024 / 1024)   // GB
			m.Disk.Total = roundFloat(float64(usage.Total) / 1024 / 1024 / 1024) // GB
			m.Disk.Percent = roundFloat(usage.UsedPercent)
		}
	}

	// Network — ambil interface pertama.
	if io, err := net.IOCounters(false); err == nil && len(io) > 0 {
		m.Network.RX = roundFloat(float64(io[0].BytesRecv))
		m.Network.TX = roundFloat(float64(io[0].BytesSent))
	}

	// Docker — best effort, abaikan jika Docker tidak tersedia.
	m.Docker = collectDocker()

	return m
}

// collectDocker mengumpulkan statistik container Docker.
// Return struct kosong jika Docker tidak tersedia atau error.
//
// @returns DockerMetrics.
func collectDocker() DockerMetrics {
	containers, err := docker.GetContainers()
	if err != nil {
		return DockerMetrics{}
	}

	running := 0
	for _, c := range containers {
		if c.State == "running" {
			running++
		}
	}

	return DockerMetrics{
		Containers: len(containers),
		Running:    running,
	}
}

// roundFloat membulatkan float64 ke 2 desimal.
//
// @param v Nilai yang akan dibulatkan.
// @returns Nilai yang sudah dibulatkan.
func roundFloat(v float64) float64 {
	return float64(int(v*100)) / 100
}

// getOSVersion mencoba membaca versi OS dari /etc/os-release (Linux)
// atau memakai runtime info untuk platform lain.
//
// @returns String versi OS.
func getOSVersion() string {
	// Untuk Linux, coba baca /etc/os-release.
	if runtime.GOOS == "linux" {
		if data, err := os.ReadFile("/etc/os-release"); err == nil {
			lines := string(data)
			for _, line := range splitLines(lines) {
				if len(line) > 5 && line[:5] == "PRETTY" {
					// PRETTY_NAME="Ubuntu 24.04 LTS"
					val := line[12:]
					if len(val) >= 2 && val[0] == '"' {
						val = val[1 : len(val)-1]
					}
					return val
				}
			}
		}
	}
	return runtime.GOARCH
}

// splitLines memecah string menjadi slice baris-baris.
//
// @param s String input.
// @returns Slice baris.
func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}
