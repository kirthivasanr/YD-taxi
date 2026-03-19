import fetch from 'node-fetch';

const testBooking = async () => {
  const payload = {
    tripType: "oneway",
    name: "Test User",
    mobile: "+919080609081",
    pickup: "Anna Salai",
    drop: "Saidapet",
    cabType: "sedan",
    distance: 15,
    date: "2026-01-25",
    time: "14:30",
    estimatedFare: 410
  };

  console.log('📤 Sending test booking:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('http://localhost:5000/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('\n📥 Response Status:', response.status);
    console.log('📥 Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testBooking();
