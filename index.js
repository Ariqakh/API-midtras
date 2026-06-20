const express = require('express');
const midtransClient = require('midtrans-client');
require('dotenv').config();

const app = express();
app.use(express.json());

let coreApi = new midtransClient.CoreApi({
    isProduction: false, 
    serverKey: process.env.MIDTRANS_SERVER_KEY, 
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

app.post('/create-transaction', async (req, res) => {
    try {
        const { orderId, amount, firstName, email, bank } = req.body;

        let parameter = {
            "payment_type": "bank_transfer",
            "transaction_details": {
                "order_id": orderId,
                "gross_amount": amount
            },
            "customer_details": {
                "first_name": firstName,
                "email": email
            }
        };

        if (bank === 'qris') {
            parameter.payment_type = "gopay";
        } else if (bank === 'mandiri') {
            parameter.payment_type = "echannel";
            parameter.echannel = { "bill_info1": "Pembayaran:", "bill_info2": "Online Store" };
        } else {
            parameter.bank_transfer = { "bank": bank };
        }

        let chargeResponse = await coreApi.charge(parameter);
        res.json(chargeResponse);
        
    } catch (error) {
        console.error("Error Midtrans:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Sandbox berjalan di port ${PORT}`));
