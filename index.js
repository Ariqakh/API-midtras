const express = require('express');
const midtransClient = require('midtrans-client');
const app = express();

app.use(express.json());

// Menggunakan CoreApi agar bisa mendapatkan nomor Virtual Account secara mentah
let coreApi = new midtransClient.CoreApi({
    isProduction: true, // Ubah ke false jika masih testing Sandbox
    serverKey: process.env.MIDTRANS_SERVER_KEY 
});

app.post('/create-transaction', async (req, res) => {
    try {
        const { orderId, amount, firstName, email, bank } = req.body;

        // Menyusun payload transaksi sesuai standar Core API Midtrans
        let parameter = {
            "payment_type": "bank_transfer",
            "transaction_details": {
                "order_id": orderId,
                "gross_amount": amount
            },
            "customer_details": {
                "first_name": firstName,
                "email": email
            },
            "bank_transfer": {
                "bank": bank // otomatis menerima 'bca', 'bni', atau 'bri' dari Flutter
            }
        };

        // Mengirim permintaan ke Core API Midtrans
        let chargeResponse = await coreApi.charge(parameter);
        
        // Mengirimkan seluruh data respons (termasuk nomor VA) ke Flutter
        res.json(chargeResponse);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Core API berjalan di port ${PORT}`);
});
