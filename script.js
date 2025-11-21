// Kunci untuk Local Storage
const STORAGE_KEY = 'kasKelasTransactions';

// Variable global untuk instance Chart.js
let chartInstance; 

// ===============================================
// === 1. BACKEND SERVICE (Layer Data & Logika) ===
// Berfungsi sebagai "Database" Lokal (Non-Real-Time).
// ===============================================
const BackendService = {
    // FUNGSI CRUD
    getAll: function() {
        const data = localStorage.getItem(STORAGE_KEY);
        try {
            const transactions = data ? JSON.parse(data) : [];
            // Memastikan data valid
            return transactions.filter(t => t && t.id).map(t => ({...t, id: t.id || Date.now() + Math.random()}));
        } catch (e) {
            console.error("Error parsing transactions from localStorage:", e);
            return []; 
        }
    },

    add: function(newTransaction) {
        const transactions = this.getAll();
        transactions.push(newTransaction);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    },

    deleteById: function(idToDelete) {
        let transactions = this.getAll();
        const filteredTransactions = transactions.filter(t => t.id !== idToDelete);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredTransactions));
    },

    // FUNGSI LOGIKA INTI
    calculateTotal: function(transactions) {
        let total = 0;
        for (const t of transactions) {
            const amount = Number(t.amount); 
            if (isNaN(amount)) continue; 

            if (t.type === 'setor') {
                total += amount;
            } else if (t.type === 'keluar') {
                total -= amount;
            }
        }
        return total;
    },

    getMonthlyData: function(transactions) {
        const monthlyData = {};
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

        transactions.forEach(t => {
            const date = new Date(t.date);
            if (isNaN(date)) return;

            const monthYear = `${months[date.getMonth()]} ${date.getFullYear()}`;
            const amount = Number(t.amount);

            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = { setor: 0, keluar: 0 };
            }

            if (t.type === 'setor') {
                monthlyData[monthYear].setor += amount;
            } else if (t.type === 'keluar') {
                monthlyData[monthYear].keluar += amount;
            }
        });
        
        // Sorting
        const sortedKeys = Object.keys(monthlyData).sort((a, b) => {
            const dateA = new Date(a.replace(/(\w{3})\s(\d{4})/, '$1 1, $2'));
            const dateB = new Date(b.replace(/(\w{3})\s(\d{4})/, '$1 1, $2'));
            return dateA - dateB;
        });

        const labels = sortedKeys;
        const setoran = sortedKeys.map(key => monthlyData[key].setor);
        const pengeluaran = sortedKeys.map(key => monthlyData[key].keluar);

        return { labels, setoran, pengeluaran };
    }
};

// ===============================================
// === 2. FRONTEND CONTROLLER (Layer UI & Interaksi) ===
// Bertanggung jawab memanipulasi DOM dan merespon input pengguna.
// ===============================================
const FrontendController = {
    // Ambil elemen-elemen DOM
    form: document.getElementById('transactionForm'),
    totalKasElement: document.getElementById('totalKas'),
    lastUpdateElement: document.getElementById('lastUpdate'),
    tableBody: document.querySelector('#transactionTable tbody'),

    // FUNGSI UTILITY
    formatRupiah: function(number, type = 'netral') {
        const prefix = (type === 'setor' ? '+' : (type === 'keluar' ? '-' : ''));
        const absoluteNumber = Math.abs(number);
        return prefix + 'Rp ' + absoluteNumber.toLocaleString('id-ID', { minimumFractionDigits: 0 });
    },

    // FUNGSI RENDERING
    renderChart: function(transactions) {
        const { labels, setoran, pengeluaran } = BackendService.getMonthlyData(transactions);
        const ctx = document.getElementById('kasChart').getContext('2d');

        if (chartInstance) {
            chartInstance.destroy(); 
        }

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: labels,
                datasets: [
                    { label: 'Kas Masuk (Setoran)', data: setoran, backgroundColor: 'rgba(40, 167, 69, 0.7)', borderWidth: 1 },
                    { label: 'Kas Keluar (Pengeluaran)', data: pengeluaran, backgroundColor: 'rgba(220, 53, 69, 0.7)', borderWidth: 1 }
                ]
            },
            options: {
                 responsive: true,
                 maintainAspectRatio: false,
                 scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Nominal (Rupiah)' },
                        ticks: {
                            callback: function(value) { return 'Rp ' + value.toLocaleString('id-ID'); }
                        }
                    }
                }
            }
        });
    },

    renderApp: function() {
        const transactions = BackendService.getAll();
        const total = BackendService.calculateTotal(transactions);

        // Render Total Kas
        this.totalKasElement.textContent = this.formatRupiah(total);
        // Ubah warna teks berdasarkan saldo (hijau untuk positif, merah untuk negatif)
        this.totalKasElement.style.color = total >= 0 ? '#10B981' : '#EF4444'; // Tailwind colors equivalent
        this.lastUpdateElement.textContent = new Date().toLocaleString('id-ID');

        // Render Tabel
        this.tableBody.innerHTML = '';
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (transactions.length === 0) {
            const row = this.tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.textContent = "Belum ada transaksi yang dicatat.";
            cell.classList.add('text-center', 'py-4', 'text-gray-500');
        } else {
            transactions.forEach(t => {
                const row = this.tableBody.insertRow();
                // Tambahkan kelas Tailwind untuk styling baris
                row.classList.add('hover:bg-gray-50', 'transition', 'duration-100');
                
                // Isi Sel Tabel
                row.insertCell().textContent = new Date(t.date).toLocaleDateString('id-ID');
                row.insertCell().textContent = t.name;
                
                const amountCell = row.insertCell();
                amountCell.textContent = this.formatRupiah(t.amount, t.type);
                amountCell.style.color = t.type === 'setor' ? '#10B981' : '#EF4444'; // Warna Nominal
                
                const actionCell = row.insertCell();
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Hapus';
                // Kelas Tailwind untuk tombol hapus
                deleteBtn.className = 'bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded transition duration-150';
                deleteBtn.onclick = () => this.handleDelete(t.id); 
                actionCell.appendChild(deleteBtn);
            });
        }

        // Render Grafik
        this.renderChart(transactions);
    },

    // FUNGSI HANDLER (Input Pengguna)
    handleAdd: function(event) {
        event.preventDefault();

        const type = document.getElementById('type').value;
        const name = document.getElementById('name').value.trim();
        const amount = Number(document.getElementById('amount').value);
        
        if (name === '' || amount <= 0 || isNaN(amount)) {
            alert('Data transaksi tidak valid! Pastikan nama terisi dan nominal adalah angka yang lebih dari Rp 0.');
            return;
        }

        const newTransaction = {
            id: Date.now() + Math.random(), 
            date: new Date().toISOString(),
            type: type,
            name: name,
            amount: amount
        };

        BackendService.add(newTransaction);

        this.renderApp();
        this.form.reset();
    },

    handleDelete: function(idToDelete) {
        if (!idToDelete) return; 

        if (!confirm("Yakin ingin menghapus transaksi ini?")) {
            return;
        }
        
        BackendService.deleteById(idToDelete);
        
        this.renderApp();
    },

    // FUNGSI INISIALISASI
    init: function() {
        this.form.addEventListener('submit', (e) => this.handleAdd(e));
        this.renderApp();
    }
};

// ===============================================
// === INISIALISASI APLIKASI ===
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
    FrontendController.init();
});