import { useState, useEffect, useCallback, useRef } from 'react';
import { useJsApiLoader, GoogleMap, Marker, Autocomplete, DirectionsRenderer } from '@react-google-maps/api';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '919080609081';
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCGXDFH4ZuXHD57bIo9t8a6HacWBGHhSuo';

const libraries = ['places'];
const MAPS_ENABLED = true; // Google Maps enabled

if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
  console.error('⚠️ Google Maps API Key is missing! Please set VITE_GOOGLE_MAPS_API_KEY in your environment variables.');
} else {
  console.log('✓ Google Maps API Key loaded');
}

function useRevealOnScroll(selector = ".reveal") {
  useEffect(() => {
    const els = document.querySelectorAll(selector);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector]);
}

const rates = {
  oneway: { sedan: 14, etios: 14, suv: 19, innova: 20, minKm: 130 },
  round: { sedan: 13, etios: 13, suv: 18, innova: 19, minKm: 250 },
};
const DRIVER_BATA = 400;
const CAB_SEAT_CAPACITY = { sedan: 4, etios: 4, suv: 5, innova: 8 };

const getSeatCapacity = (cabType) => CAB_SEAT_CAPACITY[cabType] || 4;

function Header({ active }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="nav reveal">
      <div className="brand">
        <img src="/logo.svg" alt="YD TAXI" className="logo" />
        <div>
          <div className="brand-title gold">YD TAXI</div>
          <div className="tag">Ride Royal. Arrive Royal.</div>
        </div>
      </div>
      <nav className="links">
        <a className={active === 'booking' ? 'active' : ''} href="#booking">Book</a>
        <a className={active === 'cabs' ? 'active' : ''} href="#cabs">Fleet</a>
        <a className={active === 'prices' ? 'active' : ''} href="#prices">Prices</a>
        <a className={active === 'services' ? 'active' : ''} href="#services">Services</a>
        <a className={active === 'cities' ? 'active' : ''} href="#cities">Cities</a>
        <a className={active === 'testimonials' ? 'active' : ''} href="#testimonials">Reviews</a>
        <a className={active === 'contact' ? 'active' : ''} href="#contact">Contact</a>
        <a className="btn primary" href={`tel:+${WHATSAPP_NUMBER}`}>Call</a>
      </nav>
      <button
        className={`menu-toggle ${open ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
      >
        <span className="hamburger-line line1"></span>
        <span className="hamburger-line line2"></span>
        <span className="hamburger-line line3"></span>
      </button>
      {open && (
        <nav className="links mobile" onClick={() => setOpen(false)}>
          <a className={active === 'booking' ? 'active' : ''} href="#booking">📍 Book a Ride</a>
          <a className={active === 'cabs' ? 'active' : ''} href="#cabs">🚗 Our Fleet</a>
          <a className={active === 'prices' ? 'active' : ''} href="#prices">💰 Pricing</a>
          <a className={active === 'services' ? 'active' : ''} href="#services">⚙️ Services</a>
          <a className={active === 'cities' ? 'active' : ''} href="#cities">🏙️ Coverage</a>
          <a className={active === 'testimonials' ? 'active' : ''} href="#testimonials">⭐ Reviews</a>
          <a className={active === 'contact' ? 'active' : ''} href="#contact">📞 Contact</a>
          <a className="btn primary" href={`tel:+${WHATSAPP_NUMBER}`}>📞 Call Now</a>
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="hero grid-2">
      <div className="bg-orb orb1"></div>
      <div className="bg-orb orb2"></div>
      <div className="bg-orb orb3"></div>
      <div className="reveal">
        <h1 className="gold">Premium Rides, Royal Service</h1>
        <p className="muted">
          YD TAXI gives you comfortable, safe and luxury rides across the city.
        </p>
        <div className="actions">
          <a className="btn primary" href="#booking">Quick Book</a>
          <a className="btn ghost" href="#contact">Contact</a>
        </div>
      </div>
      <BookingCard />
    </section>
  );
}

function BookingCard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [tripType, setTripType] = useState("oneway");
  const [form, setForm] = useState({
    name: "",
    countryCode: "+91",
    mobile: "",
    pickup: "",
    drop: "",
    date: "",
    time: "",
    startDate: "",
    startTime: "",
    returnDate: "",
    returnTime: "",
    cabType: "sedan",
    distance: "",
    passengers: "",
    luggage: "",
    notes: "",
  });
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [errors, setErrors] = useState({});
  const [focusedField, setFocusedField] = useState('');
  const [progress, setProgress] = useState(0);

  // Google Maps states
  const [showMap, setShowMap] = useState(false);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords, setDropCoords] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [selecting, setSelecting] = useState(null); // 'pickup' or 'drop'
  const pickupAutocompleteRef = useRef(null);
  const dropAutocompleteRef = useRef(null);
  const selectedCabSeats = getSeatCapacity(form.cabType);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_ENABLED ? GOOGLE_MAPS_API_KEY : undefined,
    libraries: MAPS_ENABLED ? libraries : undefined,
  });

  // Calculate distance automatically when both locations selected
  useEffect(() => {
    if (MAPS_ENABLED && pickupCoords && dropCoords && isLoaded) {
      calculateRoute();
    }
  }, [pickupCoords, dropCoords, isLoaded]);

  const calculateRoute = async () => {
    if (!MAPS_ENABLED || !pickupCoords || !dropCoords) {
      console.warn('❌ Cannot calculate route: MAPS_ENABLED=' + MAPS_ENABLED + ', pickupCoords=' + !!pickupCoords + ', dropCoords=' + !!dropCoords);
      return;
    }

    try {
      console.log('🚀 Calculating route from', pickupCoords, 'to', dropCoords);
      const directionsService = new google.maps.DirectionsService();
      const results = await directionsService.route({
        origin: pickupCoords,
        destination: dropCoords,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      console.log('✅ Route calculated successfully');
      setDirectionsResponse(results);
      const distanceInMeters = results.routes[0].legs[0].distance.value;
      const distanceInKm = (distanceInMeters / 1000).toFixed(1);

      console.log('📏 Distance:', distanceInKm, 'km');
      setForm(f => ({ ...f, distance: distanceInKm }));
      setTimeout(() => setProgress(calculateProgress()), 100);
    } catch (error) {
      console.error('❌ Route calculation error:', error.message || error);
    }
  };

  const onPickupPlaceChanged = () => {
    if (!MAPS_ENABLED || !pickupAutocompleteRef.current) return;

    const place = pickupAutocompleteRef.current.getPlace();
    if (place.geometry) {
      setForm(f => ({ ...f, pickup: place.formatted_address || place.name }));
      setPickupCoords({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      });
      if (errors.pickup) {
        setErrors((prev) => ({ ...prev, pickup: '' }));
      }
    }
  };

  const onDropPlaceChanged = () => {
    if (!MAPS_ENABLED || !dropAutocompleteRef.current) return;

    const place = dropAutocompleteRef.current.getPlace();
    if (place.geometry) {
      setForm(f => ({ ...f, drop: place.formatted_address || place.name }));
      setDropCoords({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      });
      if (errors.drop) {
        setErrors((prev) => ({ ...prev, drop: '' }));
      }
    }
  };

  // Reverse geocode coordinates to address
  const reverseGeocode = async (lat, lng, type) => {
    if (!MAPS_ENABLED) return;
    const geocoder = new google.maps.Geocoder();
    try {
      const results = await geocoder.geocode({ location: { lat, lng } });
      if (results.results[0]) {
        const address = results.results[0].formatted_address;
        if (type === 'pickup') {
          setForm(f => ({ ...f, pickup: address }));
          setPickupCoords({ lat, lng });
          if (errors.pickup) setErrors((prev) => ({ ...prev, pickup: '' }));
        } else {
          setForm(f => ({ ...f, drop: address }));
          setDropCoords({ lat, lng });
          if (errors.drop) setErrors((prev) => ({ ...prev, drop: '' }));
        }
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
  };

  // Handle map click
  const onMapClick = (e) => {
    if (!MAPS_ENABLED) return;
    if (selecting) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      reverseGeocode(lat, lng, selecting);
      setSelecting(null);
    }
  };

  // Calculate form progress
  const calculateProgress = () => {
    const requiredFields = ['name', 'mobile', 'pickup', 'drop', 'distance'];
    const filledFields = requiredFields.filter(field => form[field]?.toString().trim());
    return (filledFields.length / requiredFields.length) * 100;
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const onChange = (e) => {
    const { id, value } = e.target;

    let nextValue = value;
    if (id === 'passengers') {
      if (value === '') {
        nextValue = '';
      } else {
        const numericValue = Number(value);
        const clampedValue = Math.min(Math.max(numericValue, 1), selectedCabSeats);
        nextValue = String(clampedValue);
      }
    }

    setForm((f) => ({ ...f, [id]: nextValue }));
    // Clear error for this field when user starts typing
    if (errors[id]) {
      setErrors((prev) => ({ ...prev, [id]: '' }));
    }
    // Update progress
    setTimeout(() => setProgress(calculateProgress()), 100);
  };

  const handleCabTypeChange = (cabType) => {
    const maxSeats = getSeatCapacity(cabType);

    setForm((f) => {
      let nextPassengers = f.passengers;
      if (nextPassengers && Number(nextPassengers) > maxSeats) {
        nextPassengers = String(maxSeats);
      }

      return {
        ...f,
        cabType,
        passengers: nextPassengers,
      };
    });

    setErrors((prev) => {
      if (!prev.passengers) return prev;
      const next = { ...prev };
      if (form.passengers && Number(form.passengers) > maxSeats) {
        next.passengers = `Maximum ${maxSeats} passengers allowed for ${cabType.toUpperCase()}`;
      } else {
        next.passengers = '';
      }
      return next;
    });
  };

  // Step validation
  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      // Step 1: Location validation
      if (!form.pickup.trim()) {
        newErrors.pickup = 'Pickup location is required';
      }
      if (!form.drop.trim()) {
        newErrors.drop = 'Drop location is required';
      }
    } else if (step === 2) {
      // Step 2: Trip details and personal info validation
      if (!form.name.trim()) {
        newErrors.name = 'Name is required';
      } else if (form.name.trim().length < 2) {
        newErrors.name = 'Name must be at least 2 characters';
      }

      if (!form.mobile.trim()) {
        newErrors.mobile = 'Mobile number is required';
      } else if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) {
        newErrors.mobile = 'Enter valid 10-digit mobile number';
      }

      if (tripType === 'oneway') {
        if (!form.date) newErrors.date = 'Date is required';
        if (!form.time) newErrors.time = 'Time is required';
      } else {
        if (!form.startDate) newErrors.startDate = 'Start date is required';
        if (!form.startTime) newErrors.startTime = 'Start time is required';
        if (!form.returnDate) newErrors.returnDate = 'Return date is required';
        if (!form.returnTime) newErrors.returnTime = 'Return time is required';
      }
    } else if (step === 3) {
      // Step 3: Vehicle and distance validation
      if (!form.distance || form.distance <= 0) {
        newErrors.distance = 'Distance is required and must be positive';
      }

      if (form.passengers && Number(form.passengers) > selectedCabSeats) {
        newErrors.passengers = `Maximum ${selectedCabSeats} passengers allowed for ${form.cabType.toUpperCase()}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation handlers
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateForm = () => {
    const newErrors = {};

    // Name validation
    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (form.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Mobile validation
    if (!form.mobile.trim()) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) {
      newErrors.mobile = 'Enter valid 10-digit mobile number';
    }

    // Pickup validation
    if (!form.pickup.trim()) {
      newErrors.pickup = 'Pickup location is required';
    }

    // Drop validation
    if (!form.drop.trim()) {
      newErrors.drop = 'Drop location is required';
    }

    // Distance validation
    if (!form.distance || form.distance <= 0) {
      newErrors.distance = 'Distance is required and must be positive';
    }

    // Passenger count validation based on selected cab
    if (form.passengers && Number(form.passengers) > selectedCabSeats) {
      newErrors.passengers = `Maximum ${selectedCabSeats} passengers allowed for ${form.cabType.toUpperCase()}`;
    }

    if (Object.keys(newErrors).length > 0) {
      console.warn('❌ Validation errors:', newErrors);
    } else {
      console.log('✅ All validation checks passed');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEstimate = () => {
    if (!validateForm()) {
      return;
    }

    const cfg = tripType === "oneway" ? rates.oneway : rates.round;
    const distance = Number(form.distance) || 0;
    const rate = cfg[form.cabType] || cfg.sedan;

    let fareKm, driverBata, total, days = 1, includedKm = 0, extraKm = 0, chargeableKm = 0;

    if (tripType === "round" && form.startDate && form.returnDate) {
      // Calculate number of days
      const start = new Date(form.startDate);
      const end = new Date(form.returnDate);
      days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day

      // 250 km per day minimum
      includedKm = 250 * days;

      // Charge for minimum 250 km/day or actual distance, whichever is higher
      chargeableKm = Math.max(distance, includedKm);
      extraKm = Math.max(0, distance - includedKm);

      // Driver bata: 400 per day
      driverBata = 400 * days;

      // Fare: charge for minimum 250 km/day or actual distance
      fareKm = chargeableKm * rate;
      total = fareKm + driverBata;
    } else {
      // One way trip
      chargeableKm = distance;
      fareKm = distance * rate;
      driverBata = DRIVER_BATA;
      total = fareKm + driverBata;
    }

    setEstimate({
      tripType,
      distance,
      rate,
      fareKm,
      total,
      days,
      includedKm,
      extraKm,
      driverBata,
    });
  };

  const handleBooking = async () => {
    // Validate form first
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    try {
      setLoading(true);
      setSuccess(false);
      const cfg = tripType === "oneway" ? rates.oneway : rates.round;
      const distance = Number(form.distance) || 0;
      const rate = cfg[form.cabType] || cfg.sedan;

      let fareKm, total;

      if (tripType === "round" && form.startDate && form.returnDate) {
        // Calculate number of days
        const start = new Date(form.startDate);
        const end = new Date(form.returnDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        // 250 km per day minimum
        const includedKm = 250 * days;

        // Charge for minimum 250 km/day or actual distance, whichever is higher
        const chargeableKm = Math.max(distance, includedKm);

        // Driver bata: 400 per day
        const driverBata = 400 * days;

        // Fare: charge for minimum 250 km/day or actual distance
        fareKm = chargeableKm * rate;
        total = fareKm + driverBata;
      } else {
        // One way trip
        fareKm = distance * rate;
        total = fareKm + DRIVER_BATA;
      }

      const payload = {
        tripType,
        ...form,
        mobile: `${form.countryCode}${form.mobile}`,
        distance,
        estimatedFare: total,
      };

      console.log('Sending booking payload:', payload);

      const response = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data:', data);

      if (!response.ok) {
        const errorDetails = data.errors?.map(e => `${e.field}: ${e.message}`).join('\n') || data.message;
        throw new Error(errorDetails);
      }
      console.log('Booking created:', data);
      setSuccess(true);
      setBookingRef(data.booking.bookingRef);
      setTimeout(() => {
        setForm({
          name: "",
          countryCode: "+91",
          mobile: "",
          pickup: "",
          drop: "",
          date: "",
          time: "",
          startDate: "",
          startTime: "",
          returnDate: "",
          returnTime: "",
          cabType: "sedan",
          distance: "",
        });
        setEstimate(null);
        setBookingRef('');
        setSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('❌ Booking error:', error);
      console.error('Error message:', error.message);
      console.error('Full error stack:', error.stack);

      // Show user-friendly error message
      const userMessage = error.message.includes('\n')
        ? error.message
        : error.message || 'Unknown error occurred';

      alert(`❌ Booking Failed\n\n${userMessage}\n\nCheck browser console (F12) for details.\n\nOr call us directly.`);
    } finally {
      setLoading(false);
    }
  };

  const toWhatsApp = () => {
    // Validate required fields
    if (!form.name || !form.pickup || !form.drop) {
      setErrors({
        name: !form.name ? 'Name is required' : '',
        pickup: !form.pickup ? 'Pickup is required' : '',
        drop: !form.drop ? 'Drop is required' : '',
      });
      return;
    }

    const WA_NUMBER = WHATSAPP_NUMBER;
    const payload = {
      name: form.name,
      mobile: `${form.countryCode}${form.mobile}`,
      pickup: form.pickup,
      drop: form.drop,
      tripType,
      date: tripType === 'oneway' ? form.date : form.startDate,
      time: tripType === 'oneway' ? form.time : form.startTime,
      carType: form.cabType,
      passengers: form.passengers || 'Not specified',
      luggage: form.luggage || 'Not specified',
      notes: form.notes || 'None',
    };
    const message = [
      '🚖 YD TAXI BOOKING REQUEST',
      '',
      `👤 Name: ${payload.name}`,
      `📞 Mobile: ${payload.mobile}`,
      '',
      `📍 From: ${payload.pickup}`,
      `📍 To: ${payload.drop}`,
      '',
      `🔄 Trip Type: ${payload.tripType.toUpperCase()}`,
      `📅 Date: ${payload.date || 'Not specified'}`,
      `🕐 Time: ${payload.time || 'Not specified'}`,
      '',
      `🚗 Car Type: ${payload.carType.toUpperCase()}`,
      `👥 Passengers: ${payload.passengers}`,
      `🧳 Luggage: ${payload.luggage}`,
      '',
      `📝 Notes: ${payload.notes}`,
    ].join('\n');
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <aside id="booking" className="card booking reveal">
      <h3 className="gold">✨ Quick Booking</h3>

      {/* Step Indicator */}
      <div className="step-indicator">
        <div className="step-item">
          <div className={`step-circle ${currentStep >= 1 ? 'active' : ''}`}>1</div>
          <div className="step-label">Location</div>
        </div>
        <div className="step-line"></div>
        <div className="step-item">
          <div className={`step-circle ${currentStep >= 2 ? 'active' : ''}`}>2</div>
          <div className="step-label">Trip Details</div>
        </div>
        <div className="step-line"></div>
        <div className="step-item">
          <div className={`step-circle ${currentStep >= 3 ? 'active' : ''}`}>3</div>
          <div className="step-label">Confirm</div>
        </div>
      </div>



      <form className="form" onSubmit={(e) => e.preventDefault()}>

        {/* STEP 1: Location & Trip Type */}
        {currentStep === 1 && (
          <div className="form-section">
            {/* Trip Type Segment */}
            <div className="seg" style={{ marginBottom: '20px' }}>
              <button
                className={"seg-btn " + (tripType === "oneway" ? "active" : "")}
                onClick={() => {
                  setTripType("oneway");
                  setEstimate(null);
                }}
              >
                <span className="seg-icon">→</span>
                <span>One Way</span>
              </button>
              <button
                className={"seg-btn " + (tripType === "round" ? "active" : "")}
                onClick={() => {
                  setTripType("round");
                  setEstimate(null);
                }}
              >
                <span className="seg-icon">↔</span>
                <span>Round Trip</span>
              </button>
            </div>

            <div className="section-title">
              <span className="section-icon">📍</span>
              Journey Details
            </div>

            <div className="field-group">
              <label className={`floating-label ${form.pickup || focusedField === 'pickup' ? 'active' : ''}`}>
                <span className="label-icon">📍</span> Pickup Location
              </label>
              {MAPS_ENABLED && isLoaded ? (
                <Autocomplete
                  onLoad={(autocomplete) => (pickupAutocompleteRef.current = autocomplete)}
                  onPlaceChanged={onPickupPlaceChanged}
                >
                  <input
                    id="pickup"
                    value={form.pickup}
                    onChange={onChange}
                    onFocus={() => setFocusedField('pickup')}
                    onBlur={() => setFocusedField('')}
                    className={errors.pickup ? 'error' : ''}
                  />
                </Autocomplete>
              ) : (
                <input
                  id="pickup"
                  value={form.pickup}
                  onChange={onChange}
                  onFocus={() => setFocusedField('pickup')}
                  onBlur={() => setFocusedField('')}
                  className={errors.pickup ? 'error' : ''}
                />
              )}
              {errors.pickup && <span className="error-msg">⚠️ {errors.pickup}</span>}
            </div>

            <div className="field-group">
              <label className={`floating-label ${form.drop || focusedField === 'drop' ? 'active' : ''}`}>
                <span className="label-icon">🎯</span> Drop Location
              </label>
              {MAPS_ENABLED && isLoaded ? (
                <Autocomplete
                  onLoad={(autocomplete) => (dropAutocompleteRef.current = autocomplete)}
                  onPlaceChanged={onDropPlaceChanged}
                >
                  <input
                    id="drop"
                    value={form.drop}
                    onChange={onChange}
                    onFocus={() => setFocusedField('drop')}
                    onBlur={() => setFocusedField('')}
                    className={errors.drop ? 'error' : ''}
                  />
                </Autocomplete>
              ) : (
                <input
                  id="drop"
                  value={form.drop}
                  onChange={onChange}
                  onFocus={() => setFocusedField('drop')}
                  onBlur={() => setFocusedField('')}
                  className={errors.drop ? 'error' : ''}
                />
              )}
              {errors.drop && <span className="error-msg">⚠️ {errors.drop}</span>}
            </div>

            {/* Map View Toggle and Display */}
            {MAPS_ENABLED && (pickupCoords || dropCoords) && (
              <div className="field-group">
                <button
                  type="button"
                  className="map-toggle-btn"
                  onClick={() => setShowMap(!showMap)}
                >
                  {showMap ? '🗺️ Hide Map' : '🗺️ Show Route on Map'}
                </button>
              </div>
            )}

            {MAPS_ENABLED && showMap && isLoaded && (
              <div className="map-container">
                <div className="map-instructions">
                  <p>💡 Click the map to set {selecting ? `${selecting} location` : 'locations'}</p>
                  <div className="location-select-buttons">
                    <button
                      type="button"
                      className={`location-btn ${selecting === 'pickup' ? 'active' : ''}`}
                      onClick={() => setSelecting(selecting === 'pickup' ? null : 'pickup')}
                    >
                      📍 {selecting === 'pickup' ? 'Cancel' : 'Set Pickup'}
                    </button>
                    <button
                      type="button"
                      className={`location-btn ${selecting === 'drop' ? 'active' : ''}`}
                      onClick={() => setSelecting(selecting === 'drop' ? null : 'drop')}
                    >
                      🎯 {selecting === 'drop' ? 'Cancel' : 'Set Drop'}
                    </button>
                  </div>
                </div>
                <GoogleMap
                  center={pickupCoords || dropCoords || { lat: 13.0827, lng: 80.2707 }}
                  zoom={12}
                  mapContainerStyle={{ width: '100%', height: '400px', borderRadius: '12px' }}
                  options={{
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    cursor: selecting ? 'crosshair' : 'default',
                  }}
                  onClick={onMapClick}
                >
                  {pickupCoords && <Marker position={pickupCoords} label="A" />}
                  {dropCoords && <Marker position={dropCoords} label="B" />}
                  {directionsResponse && <DirectionsRenderer directions={directionsResponse} />}
                </GoogleMap>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Trip Details & Personal Info */}
        {currentStep === 2 && (
          <>
            <div className="form-section">
              <div className="section-title">
                <span className="section-icon">👤</span>
                Personal Information
              </div>

              <div className="field-group">
                <label className={`floating-label ${form.name || focusedField === 'name' ? 'active' : ''}`}>
                  <span className="label-icon">👤</span> Name
                </label>
                <input
                  id="name"
                  value={form.name}
                  onChange={onChange}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField('')}
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="error-msg">⚠️ {errors.name}</span>}
              </div>

              <div className="field-group">
                <div className="mobile-number-wrapper">
                  <div className="phone-input-container">
                    <select
                      id="countryCode"
                      value={form.countryCode}
                      onChange={onChange}
                      className="country-code-select"
                      title="Select country code"
                      onFocus={() => setFocusedField('mobile')}
                      onBlur={() => setFocusedField('')}
                    >
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+971">🇦🇪 +971</option>
                      <option value="+65">🇸🇬 +65</option>
                    </select>
                    <div className="phone-input-wrapper">
                      <input
                        id="mobile"
                        type="tel"
                        value={form.mobile}
                        onChange={onChange}
                        onFocus={() => setFocusedField('mobile')}
                        onBlur={() => setFocusedField('')}
                        className={errors.mobile ? 'error phone-input' : 'phone-input'}
                        maxLength="10"
                        placeholder=" "
                      />
                      <label htmlFor="mobile" className={`phone-floating-label ${form.mobile || focusedField === 'mobile' ? 'active' : ''}`}>
                        <span className="label-icon">📱</span> Mobile Number
                      </label>
                      <span className="char-counter">{form.mobile.length}/10</span>
                    </div>
                  </div>
                </div>
                {errors.mobile && <span className="error-msg">⚠️ {errors.mobile}</span>}
              </div>
            </div>

            <div className="form-section">
              <div className="section-title">
                <span className="section-icon">📅</span>
                Date & Time
              </div>

              {tripType === "oneway" ? (
                <div className="date-time-group">
                  <div className="field-group">
                    <label className="floating-label active">
                      <span className="label-icon">📅</span> Date
                    </label>
                    <input
                      id="date"
                      type="date"
                      value={form.date}
                      onChange={onChange}
                      min={getMinDate()}
                      className={errors.date ? 'error' : ''}
                    />
                    {errors.date && <span className="error-msg">⚠️ {errors.date}</span>}
                  </div>
                  <div className="field-group">
                    <label className="floating-label active">
                      <span className="label-icon">🕐</span> Time
                    </label>
                    <input
                      id="time"
                      type="time"
                      value={form.time}
                      onChange={onChange}
                      className={errors.time ? 'error' : ''}
                    />
                    {errors.time && <span className="error-msg">⚠️ {errors.time}</span>}
                  </div>
                </div>
              ) : (
                <>
                  <div className="journey-label">Departure</div>
                  <div className="date-time-group">
                    <div className="field-group">
                      <label className="floating-label active">
                        <span className="label-icon">📅</span> Date
                      </label>
                      <input
                        id="startDate"
                        type="date"
                        value={form.startDate}
                        onChange={onChange}
                        min={getMinDate()}
                        className={errors.startDate ? 'error' : ''}
                      />
                      {errors.startDate && <span className="error-msg">⚠️ {errors.startDate}</span>}
                    </div>
                    <div className="field-group">
                      <label className="floating-label active">
                        <span className="label-icon">🕐</span> Time
                      </label>
                      <input
                        id="startTime"
                        type="time"
                        value={form.startTime}
                        onChange={onChange}
                        className={errors.startTime ? 'error' : ''}
                      />
                      {errors.startTime && <span className="error-msg">⚠️ {errors.startTime}</span>}
                    </div>
                  </div>
                  <div className="journey-label">Return</div>
                  <div className="date-time-group">
                    <div className="field-group">
                      <label className="floating-label active">
                        <span className="label-icon">📅</span> Date
                      </label>
                      <input
                        id="returnDate"
                        type="date"
                        value={form.returnDate}
                        onChange={onChange}
                        min={form.startDate || getMinDate()}
                        className={errors.returnDate ? 'error' : ''}
                      />
                      {errors.returnDate && <span className="error-msg">⚠️ {errors.returnDate}</span>}
                    </div>
                    <div className="field-group">
                      <label className="floating-label active">
                        <span className="label-icon">🕐</span> Time
                      </label>
                      <input
                        id="returnTime"
                        type="time"
                        value={form.returnTime}
                        onChange={onChange}
                        className={errors.returnTime ? 'error' : ''}
                      />
                      {errors.returnTime && <span className="error-msg">⚠️ {errors.returnTime}</span>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* STEP 3: Vehicle Selection & Confirm */}
        {currentStep === 3 && (
          <>
            <div className="form-section">
              <div className="section-title">
                <span className="section-icon">🚗</span>
                Vehicle Selection
              </div>

              <div className="vehicle-cards">
                <div
                  className={`vehicle-card ${form.cabType === 'sedan' ? 'selected' : ''}`}
                  onClick={() => handleCabTypeChange('sedan')}
                >
                  <div className="vehicle-icon">🚘</div>
                  <div className="vehicle-name">Sedan</div>
                  <div className="vehicle-rate">₹14/km</div>
                </div>
                <div
                  className={`vehicle-card ${form.cabType === 'etios' ? 'selected' : ''}`}
                  onClick={() => handleCabTypeChange('etios')}
                >
                  <div className="vehicle-icon">🚙</div>
                  <div className="vehicle-name">Etios</div>
                  <div className="vehicle-rate">₹14/km</div>
                </div>
                <div
                  className={`vehicle-card ${form.cabType === 'suv' ? 'selected' : ''}`}
                  onClick={() => handleCabTypeChange('suv')}
                >
                  <div className="vehicle-icon">🚙</div>
                  <div className="vehicle-name">SUV</div>
                  <div className="vehicle-rate">₹19/km</div>
                </div>
                <div
                  className={`vehicle-card ${form.cabType === 'innova' ? 'selected' : ''}`}
                  onClick={() => handleCabTypeChange('innova')}
                >
                  <div className="vehicle-icon">🚐</div>
                  <div className="vehicle-name">Innova</div>
                  <div className="vehicle-rate">₹20/km</div>
                </div>
              </div>

              <div className="field-group">
                <label className={`floating-label ${form.distance || focusedField === 'distance' ? 'active' : ''}`}>
                  <span className="label-icon">📏</span> Distance (km)
                </label>
                <input
                  id="distance"
                  type="number"
                  min="1"
                  value={form.distance}
                  onChange={onChange}
                  onFocus={() => setFocusedField('distance')}
                  onBlur={() => setFocusedField('')}
                  className={errors.distance ? 'error' : ''}
                  readOnly={MAPS_ENABLED && pickupCoords && dropCoords}
                  placeholder={MAPS_ENABLED ? "Auto-calculated from route" : "Enter distance"}
                  title={MAPS_ENABLED && pickupCoords && dropCoords ? "Automatically calculated from Google Maps" : ""}
                />
                {errors.distance && <span className="error-msg">⚠️ {errors.distance}</span>}
              </div>
            </div>

            <div className="passengers-luggage-group">
              <div className="field-group">
                <label className="floating-label active">
                  <span className="label-icon">👥</span> Passengers
                </label>
                <input
                  id="passengers"
                  type="number"
                  min="1"
                  max={selectedCabSeats}
                  value={form.passengers}
                  onChange={onChange}
                  className={errors.passengers ? 'error' : ''}
                  title={`Number of passengers (1-${selectedCabSeats})`}
                />
                {errors.passengers && <span className="error-msg">⚠️ {errors.passengers}</span>}
              </div>
              <div className="field-group">
                <label className="floating-label active">
                  <span className="label-icon">🧳</span> Luggage
                </label>
                <select id="luggage" value={form.luggage} onChange={onChange} title="Select luggage size">
                  <option value="">Select</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>

            <div className="field-group">
              <label className={`floating-label ${form.notes || focusedField === 'notes' ? 'active' : ''}`}>
                <span className="label-icon">📝</span> Additional Notes
              </label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                onFocus={() => setFocusedField('notes')}
                onBlur={() => setFocusedField('')}
                className="text"
                rows="3"
              />
            </div>

            {/* Action Buttons */}
            <div className="fare-note">Price may varies based on distance</div>
            <div className="action-buttons">
              <button
                type="button"
                className="btn primary btn-estimate"
                onClick={handleEstimate}
              >
                <span className="btn-icon">💰</span>
                <span>Calculate Fare</span>
              </button>
            </div>
          </>
        )}

        {/* Step Navigation */}
        <div className="step-navigation">
          {currentStep > 1 && (
            <button type="button" className="btn-back" onClick={handleBack}>
              ← Back
            </button>
          )}
          {currentStep < 3 && (
            <button type="button" className="btn-next" onClick={handleNext}>
              Next →
            </button>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="estimate success-box slide-in">
            <div className="success-icon">✓</div>
            <div className="success-title">Booking Confirmed!</div>
            <div className="booking-ref">
              <span className="ref-label">Reference:</span>
              <span className="ref-value">{bookingRef}</span>
            </div>
            <div className="success-message">We will call you shortly to confirm details.</div>
          </div>
        )}

        {/* Estimate Box */}
        {estimate && !success && (
          <div className="estimate estimate-box slide-in">
            <div className="estimate-header">
              <span className="estimate-icon">💰</span>
              <span>Fare Breakdown</span>
            </div>
            <div className="estimate-row">
              <span>Trip Type:</span>
              <span className="estimate-value">{estimate.tripType === 'oneway' ? 'One Way' : 'Round Trip'}</span>
            </div>
            {estimate.tripType === 'round' && estimate.days && (
              <div className="estimate-row">
                <span>Number of Days:</span>
                <span className="estimate-value">{estimate.days} {estimate.days > 1 ? 'days' : 'day'}</span>
              </div>
            )}
            <div className="estimate-row">
              <span>Distance:</span>
              <span className="estimate-value">{estimate.distance} km</span>
            </div>
            {estimate.tripType === 'round' && estimate.includedKm > 0 && (
              <>
                <div className="estimate-row">
                  <span>Included Distance:</span>
                  <span className="estimate-value">{estimate.includedKm} km ({estimate.days} days × 250 km)</span>
                </div>
                <div className="estimate-row">
                  <span>Extra Distance:</span>
                  <span className="estimate-value">{estimate.extraKm} km</span>
                </div>
              </>
            )}
            <div className="estimate-row">
              <span>Rate per km:</span>
              <span className="estimate-value">₹{estimate.rate}</span>
            </div>
            <div className="estimate-row">
              <span>{estimate.tripType === 'round' && estimate.extraKm > 0 ? 'Extra Distance Fare:' : 'Base Fare:'}</span>
              <span className="estimate-value">₹{estimate.fareKm.toLocaleString()}</span>
            </div>
            <div className="estimate-row">
              <span>Driver Bata:</span>
              <span className="estimate-value">₹{estimate.driverBata || DRIVER_BATA}{estimate.tripType === 'round' && estimate.days > 1 ? ` (${estimate.days} days × ₹400)` : ''}</span>
            </div>
            <div className="estimate-divider"></div>
            <div className="estimate-row estimate-total">
              <span>Total Estimate:</span>
              <span className="estimate-value">₹{estimate.total.toLocaleString()}</span>
            </div>
            <div className="estimate-note">
              <span className="note-icon">ℹ️</span>
              {estimate.tripType === 'round' ? 'Includes 250 km/day. Toll, parking & state tax excluded' : 'Toll, parking & state tax excluded'}
            </div>
            <div className="estimate-actions">
              <button
                className="btn primary"
                onClick={toWhatsApp}
                disabled={loading || Object.keys(errors).some(key => errors[key])}
              >
                <span className="btn-icon">✓</span>
                <span>Confirm Booking</span>
              </button>
            </div>
          </div>
        )}

        <div className="form-footer">
          <span className="footer-icon">💡</span>
          <span>We'll call to confirm. Toll & taxes are extra. Driver Bata: ₹400</span>
        </div>
      </form>
    </aside>
  );
}

function Fleet() {
  const vehicles = [
    {
      icon: '🚘',
      title: "Sedan",
      desc: "Perfect for city travels",
      rate: "₹14/km",
      features: ['AC', '4 Seater', 'Music System'],
      passengers: 4,
      luggage: 'Small'
    },
    {
      icon: '🚙',
      title: "Etios",
      desc: "Smooth & fuel-efficient",
      rate: "₹14/km",
      features: ['AC', '4 Seater', 'Spacious'],
      passengers: 4,
      luggage: 'Medium'
    },
    {
      icon: '🚙',
      title: "SUV",
      desc: "Premium comfort & space",
      rate: "₹19/km",
      features: ['Premium AC', '5 Seater', 'Advanced'],
      passengers: 5,
      luggage: 'Large'
    },
    {
      icon: '🚐',
      title: "Innova",
      desc: "Best for groups & trips",
      rate: "₹20/km",
      features: ['Dual AC', '8 Seater', 'Extra Luggage'],
      passengers: 8,
      luggage: 'Extra Large'
    },
  ];

  return (
    <section id="cabs" className="section">
      <h2 className="gold reveal text-center">Our Fleet</h2>
      <p className="section-subtitle reveal text-center">Modern, well-maintained vehicles for your comfort</p>
      <div className="fleet-grid reveal">
        {vehicles.map((vehicle) => (
          <div key={vehicle.title} className="fleet-card">
            <div className="fleet-icon">{vehicle.icon}</div>
            <h3 className="fleet-title">{vehicle.title}</h3>
            <p className="fleet-desc">{vehicle.desc}</p>
            <div className="fleet-rate">{vehicle.rate}</div>
            <div className="fleet-specs">
              <div className="spec">
                <span className="spec-icon">👥</span>
                <span className="spec-text">{vehicle.passengers} Passengers</span>
              </div>
              <div className="spec">
                <span className="spec-icon">🧳</span>
                <span className="spec-text">{vehicle.luggage}</span>
              </div>
            </div>
            <div className="fleet-features">
              {vehicle.features.map((feature) => (
                <span key={feature} className="feature-tag">{feature}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Prices() {
  const oneWayPrices = [
    { type: 'Sedan', rate: '₹14/km' },
    { type: 'Etios', rate: '₹14/km' },
    { type: 'SUV', rate: '₹19/km' },
    { type: 'Innova', rate: '₹20/km' },
  ];
  const roundTripPrices = [
    { type: 'Sedan', rate: '₹13/km' },
    { type: 'Etios', rate: '₹13/km' },
    { type: 'SUV', rate: '₹18/km' },
    { type: 'Innova', rate: '₹19/km' },
  ];

  return (
    <section id="prices" className="section">
      <h3 className="gold reveal text-center">Price Chart</h3>
      <div className="prices-container reveal">
        {/* One Way */}
        <div className="price-card">
          <div className="price-card-title">One Way Trip</div>
          <div className="price-card-subtitle">Minimum 130 km</div>
          <table className="price-table">
            <tbody>
              {oneWayPrices.map((p) => (
                <tr key={p.type} className="price-row">
                  <td className="price-type">{p.type}</td>
                  <td className="price-amount">{p.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Round Trip */}
        <div className="price-card">
          <div className="price-card-title">Round Trip</div>
          <div className="price-card-subtitle">Minimum 250 km</div>
          <table className="price-table">
            <tbody>
              {roundTripPrices.map((p) => (
                <tr key={p.type} className="price-row">
                  <td className="price-type">{p.type}</td>
                  <td className="price-amount">{p.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Services() {
  const items = [
    { title: 'Oneway Trip', desc: 'Pay only for the drop — perfect for intercity travel.' },
    { title: 'Outstation', desc: 'Comfortable round trips with transparent per‑km pricing.' },
    { title: 'Hourly Rental', desc: 'Flexible local rentals — multiple stops, wait as you need.' },
  ];
  return (
    <section id="services" className="section">
      <h3 className="gold reveal text-center">Services</h3>
      <div className="grid-3">
        {items.map((it) => (
          <div key={it.title} className="card reveal hoverable text-center">
            <div className="card-title">{it.title}</div>
            <div className="muted small mt-1">{it.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Cities() {
  const cities = ['Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem', 'Erode', 'Tirupur', 'Vellore', 'Hosur', 'Tirunelveli', 'Karur', 'Pollachi'];
  return (
    <section id="cities" className="section">
      <h3 className="gold reveal text-center">Serviceable Cities</h3>
      <div className="chips reveal">
        {cities.map((c) => (
          <span key={c} className="chip">{c}</span>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const data = [
    { name: 'Praveen', text: 'Only cab service I trust. Professional drivers and on-time rides.' },
    { name: 'Pavitra', text: 'Clean cars, clear pricing, and prompt pickups every time.' },
    { name: 'Aswath', text: 'Excellent service — courteous drivers and well-maintained vehicles.' },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % data.length), 3500);
    return () => clearInterval(t);
  }, []);
  const t = data[idx];
  return (
    <section id="testimonials" className="section">
      <h3 className="gold reveal">What Riders Say</h3>
      <div className="card reveal testimonial">
        <div className="quote">“{t.text}”</div>
        <div className="by">— {t.name}</div>
        <div className="dots">
          {data.map((_, i) => (
            <span key={i} className={i === idx ? 'dot active' : 'dot'} onClick={() => setIdx(i)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQs() {
  const faqs = [
    { q: 'Which cities do you serve?', a: 'We are Chennai-based and serve all Tamil Nadu + intercity trips to Bangalore, Pondicherry, Tirupati, and more.' },
    { q: 'How do you calculate fare?', a: 'Transparent per-km rates by car type + driver bata. Tolls, parking, state taxes are extra.' },
    { q: 'Do you offer round trips?', a: 'Yes. Select round trip in booking and provide return date/time.' },
    { q: 'Can I book via WhatsApp?', a: 'Yes. Use the WhatsApp button to send details instantly.' },
    { q: 'Are cars sanitized?', a: 'Yes. Clean, well-maintained cars with professional drivers.' },
    { q: 'What payment methods are accepted?', a: 'UPI, cash, and bank transfer. Ask if you need invoices.' },
    { q: 'Do you provide airport pickups?', a: 'Yes. Add flight number in notes; we track arrival and adjust.' },
    { q: 'Is night travel allowed?', a: 'Yes. Night charges may apply based on route/time.' },
    { q: 'Can I reschedule?', a: 'Free rescheduling subject to driver availability. Contact support.' },
    { q: 'Do you have SUVs and Innovas?', a: 'Yes. Select SUV or Innova in booking form.' },
    { q: 'Is driver bata included?', a: 'Driver bata is separate (typically ₹400); shown in booking note.' },
    { q: 'Minimum distance rules?', a: 'One-way min ~130 km, round trip min ~250 km for intercity.' },
    { q: 'Can I hire for hourly local?', a: 'Yes. Ask via WhatsApp for local hourly packages.' },
    { q: 'Do you provide receipts?', a: 'Yes, digital receipts are available on request.' },
    { q: 'How fast do you confirm?', a: 'We reply on WhatsApp within minutes and call to confirm.' }
  ];
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="section">
      <h3 className="gold reveal text-center">Frequently Asked Questions</h3>
      <div className="faq-container reveal">
        {faqs.map((f, i) => (
          <div key={i} className={`faq-item ${openIndex === i ? 'open' : ''}`} onClick={() => toggleFAQ(i)}>
            <div className="faq-question">
              <span>{f.q}</span>
              <span className="faq-icon">{openIndex === i ? '−' : '+'}</span>
            </div>
            {openIndex === i && (
              <div className="faq-answer fade-in">{f.a}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyUs() {
  const items = [
    { icon: "⏱️", title: "Punctual", desc: "On-time pickups & dropoffs." },
    { icon: "🛡️", title: "Secure", desc: "Background-checked drivers." },
    { icon: "💺", title: "Comfort", desc: "Luxury vehicles & clean interiors." },
  ];
  return (
    <section className="section">
      <h3 className="gold reveal">Why Choose YD TAXI</h3>
      <div className="grid-3">
        {items.map((it) => (
          <div key={it.title} className="card text-center reveal">
            <div className="icon-xl">{it.icon}</div>
            <div className="card-title mt-2">{it.title}</div>
            <div className="muted small mt-1">{it.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PopularRoutes() {
  const routes = [
    'Chennai → Pondicherry', 'Chennai → Vellore', 'Chennai → Tirupati', 'Chennai → Bangalore',
    'Chennai → Kanchipuram', 'Chennai → Mahabalipuram', 'Chennai → Madurai', 'Chennai → Trichy',
    'Chennai → Coimbatore', 'Chennai → Salem', 'Chennai → Erode', 'Chennai → Hosur',
    'Chennai → Tirunelveli', 'Chennai → Kodaikanal', 'Chennai → Yercaud', 'Chennai → Ooty'
  ];
  return (
    <section id="routes" className="section">
      <h3 className="gold reveal text-center">Popular Routes from Chennai</h3>
      <div className="chips reveal">
        {routes.map((r) => (<span key={r} className="chip" title={r}>{r}</span>))}
      </div>
      <div className="muted small mt text-center">Transparent fares, clean cars, and experienced drivers for intercity travel</div>
    </section>
  );
}

function MapEmbed() {
  return (
    <section id="map" className="section">
      <h3 className="gold reveal text-center">Service Area</h3>
      <div className="reveal map-container">
        <iframe title="YD TAXI Chennai Service Area" loading="lazy"
          src="https://www.google.com/maps?q=Chennai&output=embed"
          style={{ width: '100%', height: '400px', border: 0, borderRadius: '24px' }} />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contact" className="footer section">
      <h2 className="gold reveal text-center" style={{ marginBottom: '40px' }}>Get in Touch</h2>
      <div className="contact-grid reveal">
        {/* Phone Contact */}
        <div className="contact-card">
          <div className="contact-icon">📞</div>
          <div className="contact-title">Call Us</div>
          <div className="contact-subtitle">Available 24/7</div>
          <a href={`tel:+${WHATSAPP_NUMBER}`} className="contact-link">
            +91 {WHATSAPP_NUMBER.slice(2)}
          </a>
        </div>

        {/* WhatsApp Contact */}
        <div className="contact-card">
          <div className="contact-icon">💬</div>
          <div className="contact-title">WhatsApp</div>
          <div className="contact-subtitle">Quick replies</div>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hi%20YD%20TAXI`} target="_blank" rel="noreferrer" className="contact-link">
            Chat with us
          </a>
        </div>

        {/* Email Contact */}
        <div className="contact-card">
          <div className="contact-icon">✉️</div>
          <div className="contact-title">Email</div>
          <div className="contact-subtitle">We'll respond soon</div>
          <a href="mailto:support@ydtaxi.example" className="contact-link">
            support@ydtaxi.example
          </a>
        </div>
      </div>

      <div className="footer-divider"></div>

      {/* Brand Info */}
      <div className="footer-info reveal">
        <div className="brand-info">
          <div className="brand-title gold">YD TAXI</div>
          <div className="tag">Ride Royal. Arrive Royal.</div>
          <div className="footer-desc">Premium cab service for comfortable and reliable travel</div>
        </div>
      </div>

      <div className="copyright">© 2026 YD TAXI. All rights reserved. | Ride with confidence.</div>
    </footer>
  );
}

function FloatingCTA() {
  const waText = encodeURIComponent("Hi YD TAXI, I would like to book a ride.");
  return (
    <>
      <div className="cta-bar">
        <a href={`tel:+${WHATSAPP_NUMBER}`} className="btn primary">Call</a>
        <a href="#booking" className="btn primary">Book</a>
      </div>
      <a
        className="fab-whatsapp"
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 32 32" fill="currentColor" width="28" height="28">
          <path d="M16.002 0C7.164 0 0 7.163 0 16c0 2.828.738 5.482 2.03 7.784L.697 30.464l6.848-1.797A15.923 15.923 0 0 0 16.002 32C24.84 32 32 24.837 32 16S24.84 0 16.002 0zm9.38 22.772c-.392.988-1.948 1.81-3.184 2.045-.838.157-1.932.283-5.612-1.208-4.714-1.906-7.755-6.65-7.99-6.955-.228-.305-1.905-2.535-1.905-4.838 0-2.304 1.206-3.438 1.635-3.905.427-.466.933-.583 1.244-.583.312 0 .622.001.896.015.286.014.668-.109 1.046.795.39.934 1.332 3.244 1.447 3.48.114.235.19.51.038.816-.15.305-.227.496-.453.762-.227.266-.476.595-.68.798-.227.233-.463.484-.2.95.263.46 1.17 1.93 2.513 3.126 1.73 1.54 3.187 2.016 3.638 2.245.452.23.714.192.977-.115.263-.307 1.13-1.317 1.432-1.768.302-.452.604-.376.016.874.316 1.25.316 2.323-.076 3.31z" />
        </svg>
      </a>
    </>
  );
}

function App() {
  useRevealOnScroll();
  const [active, setActive] = useState('booking');
  useEffect(() => {
    const ids = ['booking', 'cabs', 'prices', 'services', 'cities', 'testimonials', 'contact'];
    const secs = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { threshold: [0.4, 0.6] });
    secs.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="wrap">
      <Header active={active} />
      <Hero />
      <Fleet />
      <Prices />
      <Services />
      <Cities />
      <WhyUs />
      <PopularRoutes />
      <MapEmbed />
      <FAQs />
      <Testimonials />
      <Footer />
      <a href="#root" className="to-top" aria-label="Back to top">↑</a>
      <FloatingCTA />
    </div>
  );
}

export default App;
