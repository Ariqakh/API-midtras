const express = require('express');
const midtransClient = require('midtrans-client');
const app = express();
app.use(express.json());

let snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: 'SB-Mid-server-XXXXX' // Ganti dengan Key Anda
});

app.post('/create-transaction', async (req, res) => {
    let parameter = {
        "transaction_details": {
            "order_id": req.body.orderId,
            "gross_amount": req.body.amount
        }
    };
    let transaction = await snap.createTransaction(parameter);
    res.json({ token: transaction.token });
});

app.listen(process.env.PORT || 3000);
