const express = require('express');
const midtransClient = require('midtrans-client');
const app = express();

// Middleware untuk membaca JSON dari request Flutter
app.use(express.json());

// Konfigurasi Core API Midtrans
// Pastikan MIDTRANS_SERVER_KEY sudah diisi di Environment Variables Railway
let coreApi = new midtransClient.CoreApi({
    isProduction: false, // WAJIB false untuk Sandbox
    serverKey: process.env.MIDTRANS_SERVER_KEY 
});

app.post('/create-transaction', async (req, res) => {
    try {
        const { orderId, amount, firstName, email, bank } = req.body;

        // Validasi input dasar
        if (!orderId || !amount || !bank) {
            return res.status(400).json({ error: "Data transaksi tidak lengkap" });
        }

        let parameter = {
            "transaction_details": {
                "order_id": orderId,
                "gross_amount": parseInt(amount)
            },
            "customer_details": {
                "first_name": firstName || "Customer",
                "email": email || "email@example.com"
            }
        };

        // Logika penentuan tipe pembayaran sesuai dokumentasi Midtrans
        if (bank === 'qris') {
            parameter.payment_type = "gopay"; // QRIS terintegrasi di Gopay
        } else if (bank === 'mandiri') {
            parameter.payment_type = "echannel";
            parameter.echannel = {
                "bill_info1": "Pembayaran:",
                "bill_info2": "Online Store"
            };
        } else {
            // Untuk BCA, BNI, BRI, Permata (bank_transfer)
            parameter.payment_type = "bank_transfer";
            parameter.bank_transfer = {
                "bank": bank // Pastikan nilai 'bank' adalah 'bca', 'bni', 'bri', atau 'permata'
            };
        }

        // Mengirim request ke Midtrans
        const chargeResponse = await coreApi.charge(parameter);
        
        // Mengirimkan respon kembali ke aplikasi Flutter
        res.status(200).json(chargeResponse);
        
    } catch (error) {
        console.error("Midtrans Error Detail:", error.message);
        res.status(500).json({ 
            error: "Gagal memproses transaksi di server",
            details: error.message 
        });
    }
});

// Port server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Sandbox berjalan di port ${PORT}`);
});
