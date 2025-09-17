const axios = require('axios');

const paystackAPI = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
    'Content-Type': 'application/json'
  }
});

// 🚀 Initialize Payment
async function initializePayment(email, amount, reference, metadata = {}) {
  try {
    const response = await paystackAPI.post('/transaction/initialize', {
      email,
      amount: amount * 100, // convert to kobo
      reference,
      metadata
    });
    return { success: true, data: response.data.data };
  } catch (err) {
    console.error('Payment init error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.message || err.message };
  }
}

// 🔎 Verify Payment
async function verifyPayment(reference) {
  try {
    const response = await paystackAPI.get(`/transaction/verify/${reference}`);
    return { success: true, data: response.data.data };
  } catch (err) {
    console.error('Payment verify error:', err.response?.data || err.message);
    return { success: false, error: err.response?.data?.message || err.message };
  }
}

// 🧾 Process Payment (Verify & Match Amount)
async function processPayment(reference, expectedAmount) {
  const result = await verifyPayment(reference);
  if (!result.success) return { success: false, error: 'Verification failed' };

  const { status, amount } = result.data;
  if (status === 'success' && amount === expectedAmount * 100) {
    return { success: true, data: result.data };
  }
  return { success: false, error: 'Mismatch or failed payment' };
}

module.exports = { initializePayment, verifyPayment, processPayment };
