const express = require('express');
const midtransClient = require('midtrans-client');
const admin = require('firebase-admin');
const app = express();

app.use(express.json());

// 1. Inisialisasi Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 2. Konfigurasi Midtrans
let coreApi = new midtransClient.CoreApi({
    isProduction: false, 
    serverKey: process.env.MIDTRANS_SERVER_KEY 
});

// 3. API Create Transaction
app.post('/create-transaction', async (req, res) => {
    try {
        const { orderId, amount, firstName, email, bank, phone, address, items } = req.body;

        if (!orderId || !amount || !bank) {
            return res.status(400).json({ error: "Data transaksi tidak lengkap" });
        }

        let parameter = {
            "transaction_details": {
                "order_id": orderId,
                "gross_amount": parseInt(amount)
            },
            // Tambahkan bagian ini untuk mengubah durasi kadaluarsa jadi 1 jam
            "custom_expiry": {
                "order_time": new Date().toISOString().split('.')[0] + " +0700",
                "expiry_duration": 60, // 60 menit = 1 jam
                "unit": "minute"
            },
            "customer_details": {
                "first_name": firstName || "Customer",
                "email": email || "email@example.com",
                "phone": phone || "08123456789", 
                "billing_address": {
                    "first_name": firstName,
                    "phone": phone,
                    "address": address || "Alamat tidak tersedia",
                    "country_code": "IDN"
                },
                "shipping_address": {
                    "first_name": firstName,
                    "phone": phone,
                    "address": address || "Alamat tidak tersedia",
                    "country_code": "IDN"
                }
            },
            "item_details": items || [] 
        };

        if (bank === 'qris') {
            parameter.payment_type = "gopay";
        } else if (bank === 'mandiri') {
            parameter.payment_type = "echannel";
            parameter.echannel = { "bill_info1": "Pembayaran:", "bill_info2": "Online Store" };
        } else {
            parameter.payment_type = "bank_transfer";
            parameter.bank_transfer = { "bank": bank };
        }

        const chargeResponse = await coreApi.charge(parameter);
        res.status(200).json(chargeResponse);
    } catch (error) {
        console.error("Midtrans Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. API Webhook
app.post('/midtrans-webhook', async (req, res) => {
    const notification = req.body;
    
    try {
        const orderId = notification.order_id;
        const transactionStatus = notification.transaction_status;

        console.log(`Webhook diterima. Order ID: ${orderId}, Status: ${transactionStatus}`);

        if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
            await db.collection('orders').doc(orderId).update({ status: 'Berhasil' });
        } else if (transactionStatus === 'expire' || transactionStatus === 'cancel' || transactionStatus === 'deny') {
            await db.collection('orders').doc(orderId).update({ status: 'Gagal' });
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send('Error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
