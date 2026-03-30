(function () {
  const config = {
    businessName: "YD TAXI",
    baseCity: "Chennai",
    siteUrl: "",
    whatsappNumber: "919080609081",
    phoneNumber: "+919080609081",
    contactEmail: "support@ydtaxi.example",
    googleMapsApiKey: "AIzaSyCGXDFH4ZuXHD57bIo9t8a6HacWBGHhSuo",
    enableMapsAutocomplete: false,
    ...(window.YD_TAXI_CONFIG || {})
  };

  const rates = {
    oneway: { sedan: 14, etios: 14, suv: 19, innova: 20, minKm: 130 },
    round: { sedan: 13, etios: 13, suv: 18, innova: 19, minKm: 250 }
  };

  const cabCapacities = {
    sedan: 4,
    etios: 4,
    suv: 5,
    innova: 8
  };

  const driverBata = 400;

  const state = {
    tripType: "oneway",
    estimate: null,
    pickupPlace: null,
    dropPlace: null,
    mapsReady: false,
    mapsRequested: false
  };

  const form = document.getElementById("bookingForm");
  const fareSummary = document.getElementById("fareSummary");
  const statusBanner = document.getElementById("statusBanner");
  const mapsStatus = document.getElementById("mapsStatus");
  const distanceHelp = document.getElementById("distanceHelp");
  const cabCapacityText = document.getElementById("cabCapacityText");
  const tripButtons = Array.from(document.querySelectorAll("[data-trip]"));
  const tripFields = Array.from(document.querySelectorAll("[data-trip-mode]"));
  const nav = document.getElementById("site-nav");
  const menuToggle = document.querySelector(".menu-toggle");

  const fields = {
    pickup: document.getElementById("pickup"),
    drop: document.getElementById("drop"),
    distance: document.getElementById("distance"),
    cabType: document.getElementById("cabType"),
    date: document.getElementById("date"),
    time: document.getElementById("time"),
    startDate: document.getElementById("startDate"),
    startTime: document.getElementById("startTime"),
    returnDate: document.getElementById("returnDate"),
    returnTime: document.getElementById("returnTime"),
    name: document.getElementById("name"),
    countryCode: document.getElementById("countryCode"),
    mobile: document.getElementById("mobile"),
    passengers: document.getElementById("passengers"),
    luggage: document.getElementById("luggage"),
    notes: document.getElementById("notes")
  };

  function init() {
    applyContactConfig();
    setMinDates();
    setTripMode("oneway");
    updateCabCapacity();
    bindEvents();
    initReveal();
    initSectionObserver();
    maybeLoadGoogleMaps();
  }

  function applyContactConfig() {
    const phoneDisplay = config.phoneNumber || `+${config.whatsappNumber}`;
    const whatsappLink = `https://wa.me/${cleanNumber(config.whatsappNumber)}?text=${encodeURIComponent(`Hi ${config.businessName}, I would like to book a ride.`)}`;

    document.title = `${config.businessName} | ${config.baseCity} Intercity Taxi Booking`;

    document.querySelectorAll("[data-phone-link]").forEach((node) => {
      node.href = `tel:${phoneDisplay}`;
    });

    document.querySelectorAll("[data-phone-display]").forEach((node) => {
      node.textContent = formatDisplayPhone(phoneDisplay);
    });

    document.querySelectorAll("[data-whatsapp-link]").forEach((node) => {
      node.href = whatsappLink;
    });

    document.querySelectorAll("[data-email-link]").forEach((node) => {
      node.href = `mailto:${config.contactEmail}`;
    });

    document.querySelectorAll("[data-email-display]").forEach((node) => {
      node.textContent = config.contactEmail;
    });
  }

  function bindEvents() {
    tripButtons.forEach((button) => {
      button.addEventListener("click", function () {
        setTripMode(button.dataset.trip);
      });
    });

    menuToggle.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a[href^='#']").forEach((link) => {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });

    fields.cabType.addEventListener("change", function () {
      updateCabCapacity();
      invalidateEstimate();
    });

    fields.countryCode.addEventListener("change", invalidateEstimate);
    fields.passengers.addEventListener("input", enforcePassengerLimit);
    fields.startDate.addEventListener("change", syncReturnMinDate);

    Object.values(fields).forEach((field) => {
      field.addEventListener("input", function () {
        clearFieldError(field.id);
        invalidateEstimate();
      });
      field.addEventListener("change", function () {
        clearFieldError(field.id);
        invalidateEstimate();
      });
    });

    document.getElementById("estimateButton").addEventListener("click", function () {
      const result = calculateEstimate({ showErrors: true });
      if (result) {
        showStatus("Fare estimated successfully. Review the summary before sending to WhatsApp.", "success");
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = calculateEstimate({ showErrors: true });
      if (!result) {
        showStatus("Please fix the form errors before sending the booking.", "error");
        return;
      }

      const bookingRef = result.bookingRef;
      const message = buildWhatsAppMessage(result);
      const url = `https://wa.me/${cleanNumber(config.whatsappNumber)}?text=${encodeURIComponent(message)}`;
      const popup = window.open(url, "_blank", "noopener,noreferrer");

      if (!popup) {
        window.location.href = url;
      }

      showStatus(`WhatsApp opened with booking reference ${bookingRef}.`, "success");
    });
  }

  function setTripMode(mode) {
    state.tripType = mode;
    tripButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.trip === mode);
    });

    tripFields.forEach((field) => {
      const isMatch = field.dataset.tripMode === mode;
      field.classList.toggle("is-hidden", !isMatch);
      const input = field.querySelector("input");
      if (input) {
        input.disabled = !isMatch;
      }
    });

    invalidateEstimate();
  }

  function setMinDates() {
    const iso = new Date().toISOString().split("T")[0];
    fields.date.min = iso;
    fields.startDate.min = iso;
    fields.returnDate.min = iso;
  }

  function syncReturnMinDate() {
    fields.returnDate.min = fields.startDate.value || fields.startDate.min;
    invalidateEstimate();
  }

  function updateCabCapacity() {
    const cabType = fields.cabType.value;
    const limit = cabCapacities[cabType] || 4;
    fields.passengers.max = String(limit);
    cabCapacityText.textContent = `Seats up to ${limit} passengers.`;

    if (fields.passengers.value && Number(fields.passengers.value) > limit) {
      fields.passengers.value = String(limit);
    }
  }

  function enforcePassengerLimit() {
    if (!fields.passengers.value) {
      return;
    }

    const limit = Number(fields.passengers.max);
    const value = Number(fields.passengers.value);
    if (Number.isNaN(value)) {
      return;
    }

    if (value < 1) {
      fields.passengers.value = "1";
    } else if (value > limit) {
      fields.passengers.value = String(limit);
    }
  }

  function maybeLoadGoogleMaps() {
    const key = String(config.googleMapsApiKey || "").trim();
    const enabled = Boolean(config.enableMapsAutocomplete && key);

    if (!enabled) {
      mapsStatus.textContent = "Manual distance entry enabled";
      distanceHelp.textContent = "Enter the distance manually if route lookup is unavailable.";
      fields.distance.readOnly = false;
      return;
    }

    if (state.mapsRequested) {
      return;
    }

    state.mapsRequested = true;
    mapsStatus.textContent = "Loading Google Maps";

    window.__ydTaxiInitMaps = function () {
      state.mapsReady = true;
      setupAutocomplete();
      mapsStatus.textContent = "Maps autocomplete enabled";
      distanceHelp.textContent = "Distance is auto-calculated after you select both locations from the suggestions.";
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=__ydTaxiInitMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = function () {
      mapsStatus.textContent = "Maps failed to load";
      distanceHelp.textContent = "Route lookup is unavailable right now, so you can still enter the distance manually.";
      fields.distance.readOnly = false;
    };
    document.head.appendChild(script);
  }

  function setupAutocomplete() {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      mapsStatus.textContent = "Maps unavailable";
      return;
    }

    const pickupAutocomplete = new google.maps.places.Autocomplete(fields.pickup, {
      fields: ["formatted_address", "geometry", "name"]
    });
    const dropAutocomplete = new google.maps.places.Autocomplete(fields.drop, {
      fields: ["formatted_address", "geometry", "name"]
    });

    pickupAutocomplete.addListener("place_changed", function () {
      const place = pickupAutocomplete.getPlace();
      state.pickupPlace = place && place.geometry ? place : null;
      if (state.pickupPlace) {
        fields.pickup.value = place.formatted_address || place.name || fields.pickup.value;
      }
      maybeCalculateDistanceFromMaps();
    });

    dropAutocomplete.addListener("place_changed", function () {
      const place = dropAutocomplete.getPlace();
      state.dropPlace = place && place.geometry ? place : null;
      if (state.dropPlace) {
        fields.drop.value = place.formatted_address || place.name || fields.drop.value;
      }
      maybeCalculateDistanceFromMaps();
    });

    fields.pickup.addEventListener("input", function () {
      state.pickupPlace = null;
      fields.distance.readOnly = false;
    });

    fields.drop.addEventListener("input", function () {
      state.dropPlace = null;
      fields.distance.readOnly = false;
    });
  }

  function maybeCalculateDistanceFromMaps() {
    if (!state.mapsReady || !state.pickupPlace || !state.dropPlace) {
      return;
    }

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: state.pickupPlace.geometry.location,
        destination: state.dropPlace.geometry.location,
        travelMode: google.maps.TravelMode.DRIVING
      },
      function (result, status) {
        if (status !== "OK" || !result.routes || !result.routes[0] || !result.routes[0].legs[0]) {
          mapsStatus.textContent = "Distance lookup failed";
          fields.distance.readOnly = false;
          return;
        }

        const meters = result.routes[0].legs[0].distance.value;
        const kilometers = (meters / 1000).toFixed(1);
        fields.distance.value = kilometers;
        fields.distance.readOnly = true;
        mapsStatus.textContent = "Distance auto-calculated";
        clearFieldError("distance");
        invalidateEstimate();
      }
    );
  }

  function calculateEstimate(options) {
    if (!validateForm(options.showErrors)) {
      state.estimate = null;
      renderEmptyFare();
      return null;
    }

    const bookingRef = buildBookingReference();
    const tripType = state.tripType;
    const cabType = fields.cabType.value;
    const distance = Number(fields.distance.value);
    const rateConfig = rates[tripType];
    const rate = rateConfig[cabType];

    let chargeableKm = distance;
    let minimumKm = rateConfig.minKm;
    let days = 1;
    let driverCharge = driverBata;

    if (tripType === "round") {
      days = getRoundTripDays(fields.startDate.value, fields.returnDate.value);
      minimumKm = rateConfig.minKm * days;
      chargeableKm = Math.max(distance, minimumKm);
      driverCharge = driverBata * days;
    } else {
      chargeableKm = Math.max(distance, minimumKm);
    }

    const fareAmount = chargeableKm * rate;
    const total = fareAmount + driverCharge;

    state.estimate = {
      bookingRef,
      tripType,
      cabType,
      distance,
      rate,
      chargeableKm,
      minimumKm,
      fareAmount,
      driverCharge,
      total,
      days,
      passengers: fields.passengers.value ? Number(fields.passengers.value) : null,
      luggage: fields.luggage.value || "Not specified",
      notes: fields.notes.value.trim() || "None",
      name: fields.name.value.trim(),
      mobile: `${fields.countryCode.value}${sanitizeDigits(fields.mobile.value)}`,
      pickup: fields.pickup.value.trim(),
      drop: fields.drop.value.trim(),
      date: fields.date.value,
      time: fields.time.value,
      startDate: fields.startDate.value,
      startTime: fields.startTime.value,
      returnDate: fields.returnDate.value,
      returnTime: fields.returnTime.value
    };

    renderFare(state.estimate);
    return state.estimate;
  }

  function validateForm(showErrors) {
    const errors = {};
    const cabType = fields.cabType.value;
    const passengerLimit = cabCapacities[cabType] || 4;
    const pickup = fields.pickup.value.trim();
    const drop = fields.drop.value.trim();
    const name = fields.name.value.trim();
    const mobileDigits = sanitizeDigits(fields.mobile.value);
    const distance = Number(fields.distance.value);

    if (!pickup) {
      errors.pickup = "Pickup location is required.";
    }

    if (!drop) {
      errors.drop = "Drop location is required.";
    }

    if (!Number.isFinite(distance) || distance <= 0) {
      errors.distance = "Distance must be greater than 0 km.";
    }

    if (!name || name.length < 2) {
      errors.name = "Enter a valid customer name.";
    }

    if (!mobileDigits) {
      errors.mobile = "Mobile number is required.";
    } else if (fields.countryCode.value === "+91" && !/^[6-9]\d{9}$/.test(mobileDigits)) {
      errors.mobile = "Enter a valid 10-digit Indian mobile number.";
    } else if (fields.countryCode.value !== "+91" && !/^\d{6,14}$/.test(mobileDigits)) {
      errors.mobile = "Enter a valid mobile number.";
    }

    if (fields.passengers.value) {
      const passengers = Number(fields.passengers.value);
      if (!Number.isInteger(passengers) || passengers < 1 || passengers > passengerLimit) {
        errors.passengers = `Passengers must be between 1 and ${passengerLimit} for ${cabType.toUpperCase()}.`;
      }
    }

    if (state.tripType === "oneway") {
      if (!fields.date.value) {
        errors.date = "Travel date is required.";
      }
      if (!fields.time.value) {
        errors.time = "Pickup time is required.";
      }
    } else {
      if (!fields.startDate.value) {
        errors.startDate = "Start date is required.";
      }
      if (!fields.startTime.value) {
        errors.startTime = "Start time is required.";
      }
      if (!fields.returnDate.value) {
        errors.returnDate = "Return date is required.";
      }
      if (!fields.returnTime.value) {
        errors.returnTime = "Return time is required.";
      }

      if (fields.startDate.value && fields.returnDate.value) {
        const start = new Date(`${fields.startDate.value}T${fields.startTime.value || "00:00"}`);
        const end = new Date(`${fields.returnDate.value}T${fields.returnTime.value || "00:00"}`);
        if (end < start) {
          errors.returnDate = "Return trip must be after the start trip.";
        }
      }
    }

    if (!showErrors) {
      return Object.keys(errors).length === 0;
    }

    Object.keys(fields).forEach(clearFieldError);
    Object.entries(errors).forEach(([fieldName, message]) => {
      setFieldError(fieldName, message);
    });

    return Object.keys(errors).length === 0;
  }

  function renderFare(estimate) {
    const tripLabel = estimate.tripType === "oneway" ? "One Way" : "Round Trip";
    const schedule = estimate.tripType === "oneway"
      ? `${estimate.date || "Date pending"} at ${estimate.time || "Time pending"}`
      : `${estimate.startDate || "Start date pending"} ${estimate.startTime || ""} to ${estimate.returnDate || "Return date pending"} ${estimate.returnTime || ""}`.trim();

    fareSummary.innerHTML = `
      <div class="fare-summary-top">
        <div>
          <p class="fare-title">${tripLabel} estimate</p>
          <p class="fare-note">${schedule}</p>
        </div>
        <span class="fare-reference">${estimate.bookingRef}</span>
      </div>
      <div class="fare-grid">
        <div class="fare-row"><span>Cab type</span><strong>${estimate.cabType.toUpperCase()}</strong></div>
        <div class="fare-row"><span>Actual distance</span><strong>${estimate.distance.toFixed(1)} km</strong></div>
        <div class="fare-row"><span>Chargeable distance</span><strong>${estimate.chargeableKm.toFixed(1)} km</strong></div>
        <div class="fare-row"><span>Minimum rule</span><strong>${estimate.minimumKm} km${estimate.tripType === "round" ? ` (${estimate.days} day${estimate.days > 1 ? "s" : ""})` : ""}</strong></div>
        <div class="fare-row"><span>Rate</span><strong>Rs ${estimate.rate}/km</strong></div>
        <div class="fare-row"><span>Fare amount</span><strong>Rs ${formatNumber(estimate.fareAmount)}</strong></div>
        <div class="fare-row"><span>Driver bata</span><strong>Rs ${formatNumber(estimate.driverCharge)}</strong></div>
        <div class="fare-row total"><span>Total estimate</span><strong>Rs ${formatNumber(estimate.total)}</strong></div>
      </div>
      <p class="fare-note">Toll, parking, and state tax are extra. The WhatsApp message will include this fare breakdown.</p>
    `;
  }

  function renderEmptyFare() {
    fareSummary.innerHTML = `
      <div class="fare-card-empty">
        <p class="fare-title">Fare estimate</p>
        <p>Your fare summary will appear here after validation.</p>
      </div>
    `;
  }

  function invalidateEstimate() {
    if (!state.estimate) {
      return;
    }

    state.estimate = null;
    renderEmptyFare();
  }

  function buildWhatsAppMessage(estimate) {
    const routeBlock = `Pickup: ${estimate.pickup}\nDrop: ${estimate.drop}`;
    const scheduleBlock = estimate.tripType === "oneway"
      ? `Date: ${estimate.date}\nTime: ${estimate.time}`
      : `Start: ${estimate.startDate} ${estimate.startTime}\nReturn: ${estimate.returnDate} ${estimate.returnTime}`;

    return [
      `${config.businessName} booking request`,
      "",
      `Booking ref: ${estimate.bookingRef}`,
      `Name: ${estimate.name}`,
      `Mobile: ${estimate.mobile}`,
      "",
      routeBlock,
      "",
      `Trip type: ${estimate.tripType === "oneway" ? "One Way" : "Round Trip"}`,
      scheduleBlock,
      `Cab type: ${estimate.cabType.toUpperCase()}`,
      `Passengers: ${estimate.passengers || "Not specified"}`,
      `Luggage: ${estimate.luggage}`,
      "",
      `Actual distance: ${estimate.distance.toFixed(1)} km`,
      `Chargeable distance: ${estimate.chargeableKm.toFixed(1)} km`,
      `Rate: Rs ${estimate.rate}/km`,
      `Fare amount: Rs ${formatNumber(estimate.fareAmount)}`,
      `Driver bata: Rs ${formatNumber(estimate.driverCharge)}`,
      `Estimated total: Rs ${formatNumber(estimate.total)}`,
      "",
      `Notes: ${estimate.notes}`
    ].join("\n");
  }

  function buildBookingReference() {
    return `YD-${Date.now().toString(36).toUpperCase()}`;
  }

  function showStatus(message, type) {
    statusBanner.textContent = message;
    statusBanner.className = `status-banner is-visible ${type === "success" ? "is-success" : "is-error"}`;
  }

  function setFieldError(fieldName, message) {
    const field = fields[fieldName];
    if (field) {
      field.classList.add("is-invalid");
    }

    const errorNode = document.querySelector(`[data-error-for="${fieldName}"]`);
    if (errorNode) {
      errorNode.textContent = message;
    }
  }

  function clearFieldError(fieldName) {
    const field = fields[fieldName];
    if (field) {
      field.classList.remove("is-invalid");
    }

    const errorNode = document.querySelector(`[data-error-for="${fieldName}"]`);
    if (errorNode) {
      errorNode.textContent = "";
    }
  }

  function getRoundTripDays(startDate, returnDate) {
    const start = new Date(startDate);
    const end = new Date(returnDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  }

  function formatNumber(value) {
    return Number(value).toLocaleString("en-IN", {
      maximumFractionDigits: 0
    });
  }

  function sanitizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function cleanNumber(value) {
    return String(value || "").replace(/[^\d]/g, "");
  }

  function formatDisplayPhone(value) {
    const digits = cleanNumber(value);
    if (digits.startsWith("91") && digits.length === 12) {
      return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    return value;
  }

  function initReveal() {
    const revealNodes = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    revealNodes.forEach(function (node) {
      observer.observe(node);
    });
  }

  function initSectionObserver() {
    const sections = ["booking", "fleet", "pricing", "routes", "faq", "contact"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const navLinks = Array.from(nav.querySelectorAll("a[href^='#']"));
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }

          navLinks.forEach(function (link) {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
          });
        });
      },
      { threshold: 0.45 }
    );

    sections.forEach((section) => {
      observer.observe(section);
    });
  }

  renderEmptyFare();
  init();
})();
