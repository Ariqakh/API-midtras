const express = require('express');

const midtransClient = require('midtrans-client');

const app = express();



// Middleware untuk membaca data JSON dari aplikasi Flutter

app.use(express.json());



// Konfigurasi Midtrans

// process.env.SERVER_KEY mengambil data dari Environment Variables di Render

let snap = new midtransClient.Snap({

    isProduction: false, // Gunakan false untuk Sandbox, true untuk live

    serverKey: process.env.MIDTRANS_SERVER_KEY 

});



// Endpoint untuk membuat transaksi (dipanggil oleh Flutter)

app.post('/create-transaction', async (req, res) => {

    try {

        let parameter = {

            "transaction_details": {

                "order_id": req.body.orderId, // ID Order dari Flutter

                "gross_amount": req.body.amount // Total bayar dari Flutter

            },

            "customer_details": {

                "first_name": req.body.firstName,

                "email": req.body.email

            }

        };



        // Meminta token ke Midtrans

        let transaction = await snap.createTransaction(parameter);

        

        // Mengirim balik token ke aplikasi Flutter

        res.json({ token: transaction.token });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



// Port server (di Render otomatis menggunakan port 3000 atau sesuai sistem)

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server berjalan di port ${PORT}`);

}); 

