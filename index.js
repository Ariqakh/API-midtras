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

function getMidtransTime() {
    const now = new Date(); 
    const pad = (n) => n.toString().padStart(2, '0');
    
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
           `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} +0700`;
}

// 3. API Create Transaction
app.post('/create-transaction', async (req, res) => {
    try {
        const { orderId, amount, firstName, email, bank, phone, items } = req.body;

        if (!orderId || !amount || !bank) {
            return res.status(400).json({ error: "Data transaksi tidak lengkap" });
        }

        // --- Perbaikan: Pastikan item_details tidak pernah kosong untuk mencegah error 500 ---
        let formattedItems = (items || []).map(item => ({
            id: item.id || orderId,
            price: Number(item.harga) || 0, 
            quantity: Number(item.jumlah) || 1,
            name: (item.namaProduk || "Produk").substring(0, 50)
        }));

        const totalAmount = Number(amount);
        if (isNaN(totalAmount) || totalAmount <= 0) {
            return res.status(400).json({ error: "Total amount tidak valid" });
        }

        // Jika item kosong, isi dengan item default agar Midtrans tidak menolak request
        if (formattedItems.length === 0) {
            formattedItems.push({
                id: orderId,
                price: totalAmount,
                quantity: 1,
                name: "Pesanan Pembelian"
            });
        }

        let parameter = {
            "transaction_details": {
                "gross_amount": totalAmount,
                "order_id": orderId,
            },
            "customer_details": {
                "first_name": firstName || "Pembeli",
                "email": email || "customer@mail.com",
                "phone": phone || ""
            },
            "item_details": formattedItems,
            "custom_expiry": {
                "start_time": getMidtransTime(),
                "unit": "minute",
                "expiry_duration": 1440 
            }
        };

        // --- Logika Pemisahan Metode Pembayaran ---
        if (bank.toLowerCase() === 'qris') {
            parameter.payment_type = 'gopay'; 
        } else {
            parameter.payment_type = 'bank_transfer';
            parameter.bank_transfer = {
                "bank": bank.toLowerCase()
            };
        }

        console.log("Mengirim parameter ke Midtrans:", JSON.stringify(parameter));

        const chargeResponse = await coreApi.charge(parameter);
        return res.status(200).json(chargeResponse);

    } catch (error) {
        console.error("Midtrans Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// 4. API Webhook
app.post('/midtrans-webhook', async (req, res) => {
    const notification = req.body;
    
    try {
        const orderId = notification.order_id;
        const transactionStatus = notification.transaction_status;

        console.log(`Webhook diterima. Order ID: ${orderId}, Status: ${transactionStatus}`);

        const orderQuery = await db.collection('orders').where('orderId', '==', orderId).get();

        if (orderQuery.empty) {
            console.log(`Order ID ${orderId} tidak ditemukan di Firestore!`);
            return res.status(404).send('Order not found');
        }

        const orderRef = orderQuery.docs[0].ref;

        if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
            await orderRef.update({ statusPesanan: 'pembayaran berhasil' });
        } else if (transactionStatus === 'expire' || transactionStatus === 'cancel' || transactionStatus === 'deny') {
            await orderRef.update({ statusPesanan: 'Gagal' });
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send('Error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});
