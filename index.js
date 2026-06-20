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

// =============================================================================
// PERBAIKAN UTAMA: Memastikan objek Date dibuat dengan benar di dalam fungsi 
// agar tidak menghasilkan eror TypeError saat runtime.
// =============================================================================
function getMidtransTime() {
    const now = new Date(); // Memastikan instance Date dibuat setiap kali fungsi dipanggil
    const pad = (n) => n.toString().padStart(2, '0');
    
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
           `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} +0700`;
}

// 3. API Create Transaction
app.post('/create-transaction', async (req, res) => {
    try {
        const { orderId, amount, firstName, email, bank, phone, address, items } = req.body;

        if (!orderId || !amount || !bank) {
            return res.status(400).json({ error: "Data transaksi tidak lengkap" });
        }

        // Memetakan struktur item pesanan belanja ke format standard komparasi item Midtrans
        const formattedItems = (items || []).map(item => ({
            id: item.id || orderId,
            price: parseInt(item.harga) || amount,
            quantity: parseInt(item.jumlah) || 1,
            name: (item.namaProduk || "Produk").substring(0, 50)
        }));

        let parameter = {
            "payment_type": "bank_transfer",
            "transaction_details": {
                "gross_amount": parseInt(amount),
                "order_id": orderId,
            },
            "bank_transfer": {
                "bank": bank.toLowerCase()
            },
            "customer_details": {
                "first_name": firstName || "Pembeli",
                "email": email || "customer@mail.com",
                "phone": phone || ""
            },
            "item_details": formattedItems,
            "custom_expiry": {
                "start_time": getMidtransTime(), // Memanggil fungsi penentu batas kedaluwarsa bayar
                "unit": "minute",
                "duration": 60
            }
        };

        console.log("Mengirim parameter ke Midtrans:", JSON.stringify(parameter));

        const chargeResponse = await coreApi.charge(parameter);
        return res.status(200).json(chargeResponse);

    } catch (error) {
        console.error("Midtrans Error:", error);
        return res.status(500).json({ error: error.message });
    }
});

// 4. API Webhook (Sinkron dengan OrderModel.dart)
app.post('/midtrans-webhook', async (req, res) => {
    const notification = req.body;
    
    try {
        const orderId = notification.order_id;
        const transactionStatus = notification.transaction_status;

        console.log(`Webhook diterima. Order ID: ${orderId}, Status: ${transactionStatus}`);

        // Cari dokumen di Firestore berdasarkan field 'orderId'
        const orderQuery = await db.collection('orders').where('orderId', '==', orderId).get();

        if (orderQuery.empty) {
            console.log(`Order ID ${orderId} tidak ditemukan di Firestore!`);
            return res.status(404).send('Order not found');
        }

        const orderRef = orderQuery.docs[0].ref;

        // Menggunakan 'statusPesanan' agar sesuai dengan Flutter App Anda
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
