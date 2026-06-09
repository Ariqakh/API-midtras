const express = require('express');
const midtransClient = require('midtrans-client');
const app = express();

// Middleware untuk membaca data JSON dari aplikasi Flutter
app.use(express.json());

// Menggunakan CoreApi agar bisa mendapatkan data mentah (Nomor VA / QRIS URL)
let coreApi = new midtransClient.CoreApi({
    isProduction: true, // Ubah ke false jika masih dalam tahap testing Sandbox
    serverKey: process.env.MIDTRANS_SERVER_KEY 
});

// Endpoint untuk membuat transaksi (dipanggil secara otomatis oleh Flutter)
app.post('/create-transaction', async (req, res) => {
    try {
        const { orderId, amount, firstName, email, bank } = req.body;

        // Menyusun parameter dasar transaksi
        let parameter = {
            "transaction_details": {
                "order_id": orderId,
                "gross_amount": amount
            },
            "customer_details": {
                "first_name": firstName,
                "email": email
            }
        };

        // =========================================================================
        // 🛠️ KONDISIONAL PEMBAGIAN METODE PEMBAYARAN BERDASARKAN PARAMETER BANK
        // =========================================================================
        if (bank === 'qris') {
            // Jika admin / pengguna memilih QRIS
            parameter.payment_type = "gopay"; // Midtrans menyatukan QRIS di bawah ekosistem gopay/qris terpadu
        } 
        else if (bank === 'mandiri') {
            // Khusus Mandiri menggunakan tipe echannel (Mandiri Bill Payment)
            parameter.payment_type = "echannel";
            parameter.echannel = {
                "bill_info1": "Pembayaran Toko",
                "bill_info2": "Online Store"
            };
        } 
        else if (bank === 'permata') {
            // Khusus Permata Bank transfer
            parameter.payment_type = "bank_transfer";
            parameter.bank_transfer = {
                "bank": "permata"
            };
        } 
        else {
            // Untuk Virtual Account Bank Umum: bca, bni, atau bri
            parameter.payment_type = "bank_transfer";
            parameter.bank_transfer = {
                "bank": bank 
            };
        }

        // Mengirimkan permintaan transaksi ke Core API Midtrans
        let chargeResponse = await coreApi.charge(parameter);
        
        // Mengirimkan balik seluruh objek respon (termasuk nomor VA atau URL QRIS) ke Flutter
        res.json(chargeResponse);
    } catch (error) {
        // Menangani error jika terjadi kendala pada API Midtrans atau server
        res.status(500).json({ error: error.message });
    }
});

// Port server (di Railway otomatis menggunakan port dari environment variable)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Core API terintegrasi berjalan di port ${PORT}`);
});
