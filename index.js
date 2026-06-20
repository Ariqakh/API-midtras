const express = require('express');
const midtransClient = require('midtrans-client');
const app = express();

app.use(express.json());

let coreApi = new midtransClient.CoreApi({
    isProduction: false, 
    serverKey: process.env.MIDTRANS_SERVER_KEY 
});

app.post('/create-transaction', async (req, res) => {
    try {
        // Ambil data tambahan: phone, address, items dari request
        const { orderId, amount, firstName, email, bank, phone, address, items } = req.body;

        if (!orderId || !amount || !bank) {
            return res.status(400).json({ error: "Data transaksi tidak lengkap" });
        }

        let parameter = {
            "transaction_details": {
                "order_id": orderId,
                "gross_amount": parseInt(amount)
            },
            // Detail pelanggan yang akan muncul di Dashboard Midtrans
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
            // Detail produk
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
        console.error("Midtrans Error Detail:", error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Sandbox berjalan di port ${PORT}`));
